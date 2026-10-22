import { useState, useEffect } from 'react';
import axios from 'axios';
import './Manager.css';

export default function Manager() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    try {
      // Ensure this URL matches your deployed backend URL in production
      const response = await axios.get('http://localhost:5173/api/menu');
      setMenuItems(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching menu:", err);
      setError('Failed to load menu items. Please check your connection.');
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading menu items...</div>;
  if (error) return <div className="error-text">{error}</div>;

  return (
    <div className="manager-container">
      <h2>Menu Management</h2>
      <div className="table-wrapper">
        <table className="menu-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Type</th>
              <th>Price</th>
              <th>Available</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map((item) => (
              <tr key={item.menu_item_id}>
                <td>{item.menu_item_id}</td>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.item_type}</td>
                {/* Convert cents to dollars */}
                <td>${(item.price_cents / 100).toFixed(2)}</td>
                <td>
                  <span className={`status-badge ${item.is_available ? 'active' : 'inactive'}`}>
                    {item.is_available ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  <button className="edit-btn">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}