const express = require('express');
const router = express.Router();
const {
  gradeStudentSubmission,
  getSubmissionsForCourse,
  deleteSubmission,
  getSubmissionById,       // <-- NEW
  updateSubmissionMarks,   // <-- NEW
} = require('../controllers/submissionController.js');
const { protect } = require('../middleware/authMiddleware.js');

// Routes related to a Course (Get all submissions, Create new submission)
router.route('/course/:courseId')
  .post(protect, gradeStudentSubmission)
  .get(protect, getSubmissionsForCourse);

// Routes related to a single Submission (Get one, Update one)
router.route('/submission/:id')
  .get(protect, getSubmissionById)
  .put(protect, updateSubmissionMarks)
  .delete(protect, deleteSubmission);

module.exports = router;