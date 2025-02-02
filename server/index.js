const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const User = require("./model/user");
const Room = require("./model/room");
const Message = require("./model/message");
require("dotenv").config(); 

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true, // Allow cookies for session handling
}));

// Session middleware configuration
app.use(
    session({
      secret: "your-secret-key",  // Secret key for signing the session ID cookie
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: true,  // `secure: false` should be used in development (when not using HTTPS)
        httpOnly: true, // Helps prevent client-side JS from accessing the cookie
        maxAge: 1000 * 60 * 60 * 24 // 1 day (optional, based on your session needs)
      },
    })
  );
  
const io = socketio(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true, // Allow cookies for session handling
  }
});

const port = 5000;

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection failed:", err));

app.use(express.json());
app.use(express.static(path.join(__dirname, "client/build")));

// Authentication endpoints
app.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (user && password === user.password) {
        req.session.userId = user._id;  // Store the user ID in the session
        console.log("User ID set in session:", req.session.userId);  // Log for debugging
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });
  

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }
    const newUser = new User({ name, email, password });
    await newUser.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get logged-in user's name
app.get("/get-user-name", async (req, res) => {
  console.log("Session data:", req.session);  // Debugging log
  if (!req.session.userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const user = await User.findById(req.session.userId);
  if (user) {
    res.json({ name: user.name });
  } else {
    res.status(404).json({ error: "User not found" });
  }
});


// Room creation endpoint
app.post("/create-room", async (req, res) => {
  try {
    const { roomId, roomName } = req.body;
    const existingRoom = await Room.findOne({ roomId });
    if (existingRoom) {
      return res.status(400).json({ error: "Room ID already exists" });
    }
    const newRoom = new Room({ roomId, roomName, users: 0 });
    await newRoom.save();
    io.emit("room list", await Room.find());  // Emit updated room list to all clients
    res.json({ success: true, room: newRoom });
  } catch (error) {
    res.status(500).json({ error: "Error creating room" });
  }
});

// Get all rooms
app.get("/rooms", async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: "Error fetching room list" });
  }
});

// Endpoint to fetch room-specific messages
app.get("/messages/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ roomId }).sort({ timestamp: -1 }).limit(100); // Limit to the latest 100 messages
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Error fetching messages" });
  }
});

// WebSocket server handling
io.on("connection", (socket) => {
    console.log("New user connected");
  
    // Handle joining a room
    socket.on("join room", async ({ roomId, name }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit("error", { message: "Room does not exist" });
          return;
        }
  
        // Increment user count for the room
        room.users++;
        await room.save();
  
        // Join the room and set socket's roomId and name
        socket.join(roomId);
        socket.roomId = roomId;
        socket.name = name;
  
        // Get the last 100 messages from the room
        const history = await Message.find({ roomId }).sort({ timestamp: 1 }).limit(100); // Oldest first
        socket.emit("chat history", history);
  
        // Emit room joined event to the client
        socket.emit("room joined");
  
        // Fetch and emit updated user list in the room
        const usersInRoom = (await io.in(roomId).fetchSockets()).map(s => s.name || "Anonymous");
        io.to(roomId).emit("user list", usersInRoom);
  
        // Notify others in the room that a new user has joined
        io.to(roomId).emit("user joined", { name, users: room.users });
      } catch (error) {
        console.error("Error joining room:", error);
      }
    });
  
    // Handle sending a chat message
    socket.on("chat message", async ({ roomId, msg }) => {
      try {
        const name = socket.name || "Anonymous";
        if (!roomId || !msg || !name) {
          socket.emit("error", { message: "Missing required fields: roomId, msg, or user name" });
          return;
        }
  
        // Create and save the new message in the database
        const message = new Message({ roomId, name, msg });
        await message.save();
  
        // Emit the new message to the room
        io.to(roomId).emit("chat message", { name, msg, timestamp: message.timestamp });
      } catch (error) {
        console.error("Error saving message:", error);
      }
    });

    // Handle user typing
socket.on("typing", (roomId, name) => {
    socket.to(roomId).emit("user typing", name);
  });
  
  // Handle stop typing
  socket.on("stop typing", (roomId) => {
    socket.to(roomId).emit("user stopped typing");
  });
  
  
    // Handle leaving a room
    socket.on("leave room", async () => {
      try {
        const roomId = socket.roomId;
        if (!roomId) return;
  
        const room = await Room.findOne({ roomId });
        if (room) {
          room.users = Math.max(0, room.users - 1); // Ensure the user count doesn't go negative
          await room.save();
  
          socket.leave(roomId);
          
          // Emit room updates after a user leaves
          io.to(roomId).emit("user left", { name: socket.name, users: room.users });
  
          // If there are no users left, you can choose to delete the room (optional)
        //   if (room.users === 0) {
        //     await Room.deleteOne({ roomId });
        //   }
  
          // Emit updated room list to all clients
          io.emit("room list", await Room.find());
        }
      } catch (error) {
        console.error("Error leaving room:", error);
      }
    });
  
    // Handle user disconnect
    socket.on("disconnect", async () => {
      const roomId = socket.roomId;
      if (roomId) {
        try {
          const room = await Room.findOne({ roomId });
          if (room) {
            room.users = Math.max(0, room.users - 1); // Decrement user count
            await room.save();
  
            // Emit user left message to the room
            io.to(roomId).emit("user left", { name: socket.name, users: room.users });
  
            // Optionally, delete the room if no users remain
            // if (room.users === 0) {
            //   await Room.deleteOne({ roomId });
            // }
  
            // Emit updated room list to all clients
            io.emit("room list", await Room.find());
          }
        } catch (error) {
          console.error("Error during user disconnect:", error);
        }
      }
    });
  });
  
server.listen(port, () => console.log(`Server started at: http://localhost:${port}`));
