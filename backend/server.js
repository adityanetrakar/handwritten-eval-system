// Load environment variables from .env file
 // <-- ADD THIS
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const userRoutes = require('./routes/userRoutes.js');
const courseRoutes = require('./routes/courseRoutes.js');
const uploadRoutes = require('./routes/uploadRoutes.js');
const submissionRoutes = require('./routes/submissionRoutes.js');

// Initialize the Express app
const app = express();

// --- Middlewares ---
// Enable Cross-Origin Resource Sharing (CORS)
// This allows your React frontend (on a different port) to send requests
app.use(cors());

// Enable Express to parse JSON in request bodies
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Backend is running successfully 🚀',
    timestamp: new Date().toISOString()
  });
});

// --- Database Connection ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB successfully connected!');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

connectDB();

// --- Basic API Route ---
// A simple test route to make sure the server is working
app.get('/', (req, res) => {
  res.send('API is running...');
});
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/submissions', submissionRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// --- Start the Server ---
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});