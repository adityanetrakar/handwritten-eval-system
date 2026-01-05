const jwt = require('jsonwebtoken');
const User = require('../models/User.js');

const protect = async (req, res, next) => {
  let token;

  // Check if the request has an 'Authorization' header and it starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // 1. Get the token from the header (e.g., "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // 2. Verify the token is valid using your JWT_SECRET
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Find the user from the token's ID and attach them to the request
      // We exclude the password from the user object
      req.user = await User.findById(decoded.id).select('-password');

      // 4. Move on to the next function (the actual route controller)
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };