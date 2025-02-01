const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  roomName: { type: String, required: true },
  users: { type: Number, default: 0 }, // Track the number of users in the room
});

const Room = mongoose.model("Room", roomSchema);

module.exports = Room;
