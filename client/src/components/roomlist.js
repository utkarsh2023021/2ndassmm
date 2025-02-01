import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "./roomlist.css";

const socket = io("http://localhost:5000");

const RoomList = () => {
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(""); // Store the room ID input value
  const [newRoomId, setNewRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [userName, setUserName] = useState(""); // Store the logged-in user's name
  const [showRoomIdInput, setShowRoomIdInput] = useState(null); // Track the roomId input state for each room
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch rooms from backend
    fetch("http://localhost:5000/rooms")
      .then((response) => response.json())
      .then((data) => setRooms(data))
      .catch((error) => console.error("Error fetching room list:", error));

    // Fetch the logged-in user's name from the backend
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

    // Listen for updates to the room list
    socket.on("room list", (updatedRooms) => {
      console.log("Updated Room List:", updatedRooms); // Debugging log
      setRooms(updatedRooms);
    });

    return () => {
      socket.off("room list");
    };
  }, []);

  const handleJoinRoom = (roomIdInput, roomId) => {
    if (roomIdInput !== roomId) {
      alert("Incorrect Room ID. Please try again.");
      return;
    }

    // If the entered roomId matches the selected roomId
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
    <div className="room-list">
      <h1>Available Rooms</h1>
      <ul>
        {rooms.map((room) => (
          <li key={room.roomId}>
            Room ID: {room.roomId}, Room Name: {room.roomName}, Users: {room.users}

            {/* Show input field for roomId only when clicked */}
            {showRoomIdInput === room.roomId ? (
              <>
                <input
                  type="text"
                  placeholder="Enter Room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
                <button onClick={() => handleJoinRoom(roomId, room.roomId)}>Join Room</button>
                <button onClick={() => setShowRoomIdInput(null)}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setShowRoomIdInput(room.roomId)}>Join Room</button>
            )}
          </li>
        ))}
      </ul>

      <div className="create-room">
        <h3>Create a New Room</h3>
        <input
          type="text"
          placeholder="Enter Room ID"
          value={newRoomId}
          onChange={(e) => setNewRoomId(e.target.value)}
        />
        <input
          type="text"
          placeholder="Enter Room Name"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
        />
        <button onClick={handleCreateRoom}>Create Room</button>
      </div>
    </div>
  );
};

export default RoomList;
