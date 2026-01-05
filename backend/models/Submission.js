const mongoose = require('mongoose');

// This is a "sub-document" schema.
// It defines the structure for a single graded question.
const GradedAnswerSchema = new mongoose.Schema({
  questionNumber: {
    type: String,
    required: true, // e.g., "1a"
  },
  maxMarks: {
    type: Number,
    required: true, // Max marks for this question
  },
  studentAnswerText: {
    type: String,
    default: '', // The text extracted from the student's PDF
  },
  aiMark: {
    type: Number,
    required: true, // The mark given by Gemini
  },
  aiFeedback: {
    type: String,
    default: '', // The feedback from Gemini
  },
  // This is the final mark, which the teacher can edit.
  // It defaults to the AI's mark.
  teacherMark: {
    type: Number,
    required: true,
  },
});

const SubmissionSchema = new mongoose.Schema({
  // Link to the course
  course: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Course',
  },
  // Link to the student
  student: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Student',
  },
  // An array of all graded answers for this submission
  gradedAnswers: [GradedAnswerSchema],
  
  totalMarks: {
    type: Number,
    required: true,
    default: 0,
  },
  // We can store the path to the original student PDF for reference
  originalPdfPath: {
    type: String,
    required: false,
  },
}, { timestamps: true });

// Before saving a new submission, calculate the totalMarks
// by summing up the 'teacherMark' of all graded answers.
SubmissionSchema.pre('save', function (next) {
  this.totalMarks = this.gradedAnswers.reduce((acc, answer) => {
    return acc + (answer.teacherMark || 0);
  }, 0);
  next();
});

module.exports = mongoose.model('Submission', SubmissionSchema);