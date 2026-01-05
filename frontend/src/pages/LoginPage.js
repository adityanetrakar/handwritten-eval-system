import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Our custom hook
import './LoginPage.css'; // Import the CSS
import { Link } from 'react-router-dom';


const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Get the 'login' function from our AuthContext
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      await login(email, password);
      // Navigation happens inside the 'login' function on success
    } catch (err) {
      // If login fails, the error is thrown
      setError('Failed to log in. Please check your email and password.');
      console.error(err);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit}>
        <h2>Teacher Login</h2>
        {error && <p className="login-error">{error}</p>}
        <div className="login-form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="login-form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login-btn">
          Login
        </button>
      </form>
      {/* TODO: Add a link to a registration page */}
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        Don't have an account? <Link to="/register">Register here</Link>
      </p>
    </div>
  );
};

export default LoginPage;