const mongoose = require('mongoose');

// This is a "sub-document" schema.
// It defines the structure of a single question in the answer key.
const QuestionSchema = new mongoose.Schema({
  questionNumber: {
    type: String,
    required: true, // e.g., "1a", "2", "3b"
  },
  maxMarks: {
    type: Number,
    required: true,
  },
  modelAnswerText: {
    type: String,
    required: true, // This is the text extracted from the model PDF
  },
});

const CourseSchema = new mongoose.Schema({
  courseName: {
    type: String,
    required: [true, 'Please provide a course name'],
  },
  courseCode: {
    type: String,
    required: [true, 'Please provide a course code'],
  },
  // This creates a relationship between this Course and a User
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User', // This refers to the 'User' model we just created
  },
  // We embed the array of model answer questions directly into the course
  modelAnswerKey: [QuestionSchema],
}, { timestamps: true }); // Adds createdAt and updatedAt fields

module.exports = mongoose.model('Course', CourseSchema);