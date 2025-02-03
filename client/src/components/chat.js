import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "./chat.css";

const Chat = () => {
  const { roomId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [users, setUsers] = useState([]);
  const [showUsers, setShowUsers] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail");
    if (!storedEmail) {
      navigate("/login");
      return;
    }

    fetch(`http://localhost:5000/get-user-name/${storedEmail}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.name) {
          setUserName(data.name);
        } else {
          navigate("/login");
        }
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  useEffect(() => {
    socketRef.current = io("http://localhost:5000/");

    socketRef.current.on("chat history", (history) => {
      setMessages(history);
      setLoading(false);
    });

    socketRef.current.on("chat message", (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    socketRef.current.on("user list", (userList) => {
      setUsers(userList || []);
    });

    socketRef.current.on("user typing", (name) => setTypingUser(name));
    socketRef.current.on("user stopped typing", () => setTypingUser(""));
    socketRef.current.on("error", (error) => {
      alert(error.message);
      setJoined(false);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (roomId && joined) {
      socketRef.current.emit("join room", { roomId, name: userName });

      fetch(`http://localhost:5000/rooms/${roomId}/users`)
        .then((response) => response.json())
        .then((data) => setUsers(data.users || []))
        .catch(() => setUsers([]));
    }
  }, [roomId, joined]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleJoinRoom = () => {
    if (userName.trim()) {
      setJoined(true);
      socketRef.current.emit("join room", { roomId, name: userName });
    } else {
      alert("Please enter a valid name to join the room.");
    }
  };

  const handleSendMessage = () => {
    if (!joined) {
      alert("You must join the room before sending messages!");
      return;
    }

    if (newMessage.trim()) {
      socketRef.current.emit("chat message", { roomId, msg: newMessage });
      setNewMessage("");
      socketRef.current.emit("stop typing", roomId);
    }
  };

  const handleTyping = () => {
    if (newMessage.trim()) {
      socketRef.current.emit("typing", roomId, userName);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit("stop typing", roomId);
      }, 1000);
    } else {
      socketRef.current.emit("stop typing", roomId);
    }
  };

  const handleLeaveRoom = () => {
    if (!joined) return;

    socketRef.current.emit("leave room");
    setJoined(false);
    setUsers([]);
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

          {typingUser && typingUser !== userName && (
            <div className="typing-status">{typingUser} is typing...</div>
          )}

          <div className="message-input">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Type a message"
            />
            <button onClick={handleSendMessage} disabled={!newMessage.trim()}>
              Send
            </button>
          </div>

          <div className="user-count" onClick={() => setShowUsers(!showUsers)}>
            🟢 {users?.length || 0}
          </div>

          {showUsers && (
            <div className="user-list">
              <h3>Online Users</h3>
              <ul>
                {users?.length > 0 ? (
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

          {joined && (
            <div className="leave-room">
              <button onClick={handleLeaveRoom}>Leave Room</button>
            </div>
          )}

          <div ref={messageEndRef} />
        </>
      )}
    </div>
  );
};

export default Chat;
