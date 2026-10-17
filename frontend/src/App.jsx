import { useState } from 'react';
import Login from './Login';
import Manager from './Manager';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="app-container">
      {!currentUser ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="dashboard-layout">
          <header className="dashboard-header">
            <h2>Welcome, {currentUser.name} ({currentUser.role})</h2>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </header>
          
          <main className="dashboard-content">
            {/* Conditional rendering based on role can be added here */}
            {currentUser.role.toLowerCase() === 'manager' ? (
              <Manager />
            ) : (
              <div className="cashier-view">
                <h3>Cashier POS System coming soon...</h3>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}