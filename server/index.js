const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const User = require("./model/user");
const Room = require("./model/room");
const Message = require("./model/message");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

const io = socketio(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

const port = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection failed:", err));

app.use(express.json());
app.use(express.static(path.join(__dirname, "client/build")));

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && password === user.password) {
      res.json({ success: true, name: user.name });
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

app.get("/get-user-name/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (user) {
      res.json({ name: user.name });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/create-room", async (req, res) => {
  try {
    const { roomId, roomName } = req.body;
    const existingRoom = await Room.findOne({ roomId });
    if (existingRoom) {
      return res.status(400).json({ error: "Room ID already exists" });
    }
    const newRoom = new Room({ roomId, roomName, users: 0 });
    await newRoom.save();
    io.emit("room list", await Room.find());
    res.json({ success: true, room: newRoom });
  } catch (error) {
    res.status(500).json({ error: "Error creating room" });
  }
});

app.get("/rooms", async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: "Error fetching room list" });
  }
});

app.get("/rooms/:roomId/users", async (req, res) => {
    try {
      const { roomId } = req.params;
      const sockets = await io.in(roomId).fetchSockets();
      const users = sockets.map(s => s.name || "Anonymous");
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Error fetching users in room" });
    }
  });
  

app.get("/messages/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ roomId }).sort({ timestamp: -1 }).limit(100);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Error fetching messages" });
  }
});

io.on("connection", (socket) => {
    console.log("New user connected");
  
  
    socket.on("join room", async ({ roomId, name }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit("error", { message: "Room does not exist" });
          return;
        }
  
       
        room.users++;
        await room.save();
  
  
        socket.join(roomId);
        socket.roomId = roomId;
        socket.name = name;
  
   
        const history = await Message.find({ roomId })
          .sort({ timestamp: 1 })
          .limit(100);
        socket.emit("chat history", history);
  
     
        socket.emit("room joined");
  
        const usersInRoom = (await io.in(roomId).fetchSockets()).map(s => s.name || "Anonymous");
        io.to(roomId).emit("user list", usersInRoom);
  
        io.to(roomId).emit("user joined", { name, users: room.users });
      } catch (error) {
        console.error("Error joining room:", error);
      }
    });
    socket.on("leave room", async () => {
      try {
        const roomId = socket.roomId;
        if (!roomId) return;
  
        const room = await Room.findOne({ roomId });
        if (room) {
       
          room.users = Math.max(0, room.users - 1);
          await room.save();
  
          socket.leave(roomId);
  
       
          io.to(roomId).emit("user left", { name: socket.name, users: room.users });
  
   
          io.emit("room list", await Room.find());
        }
      } catch (error) {
        console.error("Error leaving room:", error);
      }
    });
  
    
    socket.on("disconnect", async () => {
      const roomId = socket.roomId;
      if (roomId) {
        try {
          const room = await Room.findOne({ roomId });
          if (room) {
         
            room.users = Math.max(0, room.users - 1);
            await room.save();
  
       
            io.to(roomId).emit("user left", { name: socket.name, users: room.users });
  
           
            io.emit("room list", await Room.find());
          }
        } catch (error) {
          console.error("Error during user disconnect:", error);
        }
      }
    });
  
    
    socket.on("chat message", async ({ roomId, msg }) => {
      try {
        const name = socket.name || "Anonymous";
        if (!roomId || !msg || !name) {
          socket.emit("error", { message: "Missing required fields: roomId, msg, or user name" });
          return;
        }
  
       
        const message = new Message({ roomId, name, msg });
        await message.save();
  
       
        io.to(roomId).emit("chat message", { name, msg, timestamp: message.timestamp });
      } catch (error) {
        console.error("Error saving message:", error);
      }
    });
  
  
    socket.on("typing", (roomId, name) => {
      socket.to(roomId).emit("user typing", name);
    });
  
 
    socket.on("stop typing", (roomId) => {
      socket.to(roomId).emit("user stopped typing");
    });
  });
  
  

server.listen(port, () => console.log(`Server started at: http://localhost:${port}`));
