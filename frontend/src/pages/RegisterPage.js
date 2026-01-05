import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './LoginPage.css'; // Reusing the login page CSS

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Get the 'register' function from our AuthContext
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      await register(name, email, password);
      // Navigation happens inside the 'register' function on success
    } catch (err) {
      // If registration fails, the error is thrown
      setError('Failed to register. This email might already be in use.');
      console.error(err);
    }
  };

  return (
    <div className="login-container"> {/* Reusing 'login-container' style */}
      <form onSubmit={handleSubmit}>
        <h2>Create Teacher Account</h2>
        {error && <p className="login-error">{error}</p>}
        <div className="login-form-group">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
            minLength="6"
            required
          />
        </div>
        <button type="submit" className="login-btn">
          Register
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
};

export default RegisterPage;