import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        Automatic Answer Sheet Evaluation System
      </Link>
      {user && (
        <div className="navbar-user">
          <span className="navbar-user-name">Welcome, {user.name}!</span>
          <button onClick={logout} className="navbar-logout-btn">
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;