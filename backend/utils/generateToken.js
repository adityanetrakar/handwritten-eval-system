const jwt = require('jsonwebtoken');

// This function creates a secure token that we can give to the user
// It signs the user's ID with your secret key
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d', // The token will expire in 30 days
  });
};

module.exports = generateToken;