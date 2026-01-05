import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { useNavigate } from 'react-router-dom';

// 1. Create the context
const AuthContext = createContext();

// 2. Create the provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // On initial app load, check if user is already logged in (in local storage)
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      const userData = await authService.login(email, password);
      setUser(userData);
      navigate('/dashboard'); // Redirect to dashboard on success
    } catch (error) {
      console.error('Login failed:', error);
      // Re-throw error so the login page can display it
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    authService.logout();
    setUser(null);
    navigate('/login'); // Redirect to login page
  };
  
  // Register function
  const register = async (name, email, password) => {
     try {
      const userData = await authService.register(name, email, password);
      setUser(userData);
      navigate('/dashboard'); // Redirect to dashboard on success
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  // The 'value' is what all child components can access
  const value = {
    user,
    loading,
    login,
    logout,
    register,
  };

  // Return the provider, wrapping the app's children
  // We don't render until we've checked local storage
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 3. Create a custom "hook" to make it easy to use the context
export const useAuth = () => {
  return useContext(AuthContext);
};