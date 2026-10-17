import { useState } from 'react';
import axios from 'axios';
import './Login.css'; // Add your CSS here to match the Java DenseList styling

export default function Login({ onLoginSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (pin.length !== 6) {
      setError('PIN must be 6 digits.');
      return;
    }
    try {
      // Call the Python backend
      const response = await axios.post(`http://localhost:8000/api/login?pin=${pin}`);
      onLoginSuccess(response.data); // Passes user data (id, name, role) to main app
    } catch (err) {
      setError('Invalid PIN.');
      setPin('');
    }
  };

  return (
    <div className="login-container">
      <h1>Boba Bops</h1>
      <p>Enter your 6-digit PIN</p>
      
      <div className="pin-display">
        {/* Render dots representing PIN length just like PinDots in Login.java */}
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={i < pin.length ? 'dot filled' : 'dot empty'}></span>
        ))}
      </div>
      
      {error && <p className="error-text">{error}</p>}

      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button key={num} onClick={() => setPin(pin + num)}>{num}</button>
        ))}
        <button onClick={() => setPin('')}>Clear</button>
        <button onClick={() => setPin(pin + 0)}>0</button>
        <button onClick={handleLogin}>Enter</button>
      </div>
    </div>
  );
}