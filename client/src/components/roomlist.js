import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "./roomlist.css";

const socket = io("http://localhost:5000");

const RoomList = () => {
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [newRoomId, setNewRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [userName, setUserName] = useState("");
  const [showRoomIdInput, setShowRoomIdInput] = useState(null);
  const [errorMessage, setErrorMessage] = useState(""); // State for error message
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/rooms")
      .then((response) => response.json())
      .then((data) => setRooms(data))
      .catch((error) => console.error("Error fetching room list:", error));

    fetch("http://localhost:5000/get-user-name", {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => setUserName(data.name))
      .catch((error) => console.error("Error fetching user name:", error));

    socket.on("room list", (updatedRooms) => {
      setRooms(updatedRooms);
    });

    return () => {
      socket.off("room list");
    };
  }, []);

  const handleJoinRoom = (roomIdInput, roomId) => {
    if (roomIdInput !== roomId) {
      setErrorMessage("Oops! Incorrect Room ID. Please try again.");
      setTimeout(() => setErrorMessage(""), 3000); // Hide the error after 3 seconds
      return;
    }

    navigate(`/chat/${roomId}?name=${userName}`);
  };

  const handleCreateRoom = () => {
    if (!newRoomId.trim() || !newRoomName.trim()) return;

    fetch("http://localhost:5000/create-room", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ roomId: newRoomId, roomName: newRoomName }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setNewRoomId("");
          setNewRoomName("");
        } else {
          console.error("Error creating room:", data.error);
        }
      })
      .catch((error) => console.error("Error creating room:", error));
  };

  return (
    <div className="room-list-container">
      <div className="room-list-box">
        <h1 className="room-list-title">Available Rooms</h1>

        {/* Error message */}
        {errorMessage && <div className="error-notification">{errorMessage}</div>}

        <ul className="room-list">
          {rooms.map((room) => (
            <li key={room.roomId}>
              <div className="room-info">
                Room Name: {room.roomName}, Users: {room.users}
              </div>

              {showRoomIdInput === room.roomId ? (
                <div className="room-id-input-visible">
                  <input
                    className="room-input"
                    type="text"
                    placeholder="Enter Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                  />
                  <button className="room-button" onClick={() => handleJoinRoom(roomId, room.roomId)}>
                    Join Room
                  </button>
                  <button className="cancel-btn" onClick={() => setShowRoomIdInput(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="room-button" onClick={() => setShowRoomIdInput(room.roomId)}>
                  Join Room
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="create-room">
          <h3>Create a New Room</h3>
          <input
            className="room-input"
            type="text"
            placeholder="Enter Room ID"
            value={newRoomId}
            onChange={(e) => setNewRoomId(e.target.value)}
          />
          <input
            className="room-input"
            type="text"
            placeholder="Enter Room Name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
          <button className="room-button" onClick={handleCreateRoom}>
            Create Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomList;
