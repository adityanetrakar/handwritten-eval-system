const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/userController.js');

// When a POST request hits /api/users/register, run the registerUser function
router.post('/register', registerUser);

// When a POST request hits /api/users/login, run the loginUser function
router.post('/login', loginUser);

module.exports = router;