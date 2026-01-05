const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  usn: {
    type: String,
    required: true,
    unique: true, // Ensures no two students have the same USN
    trim: true,
    uppercase: true, // Standardizes USNs to uppercase
  },
  name: {
    type: String,
    required: true,
  },
  // You can add more fields here later, like 'email' or 'class'
}, { timestamps: true });

module.exports = mongoose.model('Student', StudentSchema);