import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    try {
      const response = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ email, password }),
        credentials: "include" // Make sure to send cookies for session management
      });
  
      const data = await response.json();
  
      if (response.ok) {
        // Redirect to the room list if login is successful
        navigate("/rooms");
      } else {
        // Handle error messages
        if (data.error) {
          setError(data.error);
        }
      }
    } catch (err) {
      setError("An error occurred while trying to log in.");
      console.error("Error during login:", err);
    }
  };

  return (
    <div>
      {error && <div>{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Login;
