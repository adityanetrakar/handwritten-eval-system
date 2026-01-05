import axios from 'axios';

// The URL of your running backend server
const API_URL = 'http://localhost:5001/api/users';

/**
 * Makes an API call to log the user in.
 * @param {string} email
 * @param {string} password
 * @returns {object} The user data and token from the backend
 */
const login = async (email, password) => {
  const response = await axios.post(`${API_URL}/login`, {
    email,
    password,
  });

  // If the login is successful, store the user's data (including the token)
  // in the browser's local storage. This keeps them logged in.
  if (response.data) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }

  return response.data;
};

/**
 * Logs the user out by removing their data from local storage.
 */
const logout = () => {
  localStorage.removeItem('user');
};

/**
 * Makes an API call to register a new user.
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {object} The new user data and token
 */
const register = async (name, email, password) => {
  const response = await axios.post(`${API_URL}/register`, {
    name,
    email,
    password,
  });

  if (response.data) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }

  return response.data;
};

const authService = {
  login,
  logout,
  register,
};

export default authService;