import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Signup from "./components/signup";
import Login from "./components/login";
import RoomList from "./components/roomlist";
import Chat from "./components/chat";



const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/rooms" element={<RoomList />} />
        <Route path="/chat/:roomId" element={<Chat />} /> 
      </Routes>
    </Router>
  );
};

export default App;
