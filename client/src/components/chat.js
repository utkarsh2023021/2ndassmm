import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "./chat.css";

const socket = io("http://localhost:5000");

const Chat = () => {
  const { roomId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState(""); // Store the logged-in user's name
  const [joined, setJoined] = useState(false);
  const [users, setUsers] = useState([]); // Store list of online users
  const [showUsers, setShowUsers] = useState(false); // Toggle for user list popup
  const [typingUser, setTypingUser] = useState(""); // Track who's typing
  const messageEndRef = useRef(null); // Reference to the end of the message list
  const typingTimeoutRef = useRef(null); // Reference for the typing timeout
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/get-user-name", {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => setUserName(data.name))
      .catch((error) => {
        console.error("Error fetching user name:", error);
        navigate("/login");
      });

    if (!roomId || !userName) return;

    setLoading(true);
    socket.emit("join room", { roomId, name: userName });

    socket.on("chat history", (history) => {
      setMessages(history); // Directly set the history from the backend
      setLoading(false);
    });

    socket.on("chat message", (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]); // Append new message to the list
    });

    socket.on("user list", (userList) => {
      setUsers(userList);
    });

    socket.on("user typing", (name) => {
      setTypingUser(name); // Show who is typing
    });

    socket.on("user stopped typing", () => {
      setTypingUser(""); // Clear typing user status
    });

    socket.on("error", (error) => {
      alert(error.message);
      setJoined(false);
    });

    return () => {
      socket.emit("leave room", { roomId });
      socket.off("chat history");
      socket.off("chat message");
      socket.off("user list");
      socket.off("user typing");
      socket.off("user stopped typing");
      socket.off("error");
    };
  }, [roomId, userName]);

  // Scroll to the bottom whenever the messages change
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!joined) {
      alert("You must join the room before sending messages!");
      return;
    }

    if (newMessage.trim()) {
      socket.emit("chat message", { roomId, msg: newMessage });
      setNewMessage(""); // Clear input after sending
      socket.emit("stop typing", roomId); // Emit stop typing when message is sent
    }
  };

  const handleJoinRoom = () => {
    if (userName.trim()) {
      setJoined(true);
    } else {
      alert("Please enter a valid name to join the room.");
    }
  };

  const handleTyping = () => {
    if (newMessage.trim()) {
      socket.emit("typing", roomId, userName); // Emit typing when user is typing

      // Clear the previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set a new timeout to emit stop typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stop typing", roomId); // Emit stop typing after delay
      }, 1000);
    } else {
      socket.emit("stop typing", roomId); // Emit stop typing if no text
    }
  };

  return (
    <div className="chat">
      <h1>Room: {roomId}</h1>

      {!joined && userName ? (
        <div className="username-input">
          <button onClick={handleJoinRoom}>Join Room</button>
        </div>
      ) : (
        <>
          {loading ? (
            <p>Loading messages...</p>
          ) : (
            <div className="messages">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message ${msg.name === userName ? "sent" : "received"}`}
                >
                  <div className="message-content">
                    <strong>{msg.name}:</strong> {msg.msg}
                    <span className="timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Display typing status */}
          {typingUser && typingUser !== userName && (
            <div className="typing-status">{typingUser} is typing...</div>
          )}

          <div className="message-input">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping(); // Emit typing status when the user types
              }}
              placeholder="Type a message"
            />
            <button onClick={handleSendMessage} disabled={!newMessage.trim()}>
              Send
            </button>
          </div>

          {/* Floating User Count Button */}
          <div className="user-count" onClick={() => setShowUsers(!showUsers)}>
            🟢 {users.length}
          </div>

          {/* User List Popup */}
          {showUsers && (
            <div className="user-list">
              <h3>Online Users</h3>
              <ul>
                {users.length > 0 ? (
                  users.map((user, index) => <li key={index}>{user}</li>)
                ) : (
                  <li>No users online</li>
                )}
              </ul>
              <button className="close-btn" onClick={() => setShowUsers(false)}>
                Close
              </button>
            </div>
          )}

          {/* Scroll to the bottom of the chat */}
          <div ref={messageEndRef} />
        </>
      )}
    </div>
  );
};

export default Chat;
