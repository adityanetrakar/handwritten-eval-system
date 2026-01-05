const express = require('express');
const router = express.Router();
const {
  createCourse,
  getMyCourses,
  getCourseById,
  deleteCourse,
  processModelAnswer,
} = require('../controllers/courseController.js');
const { protect } = require('../middleware/authMiddleware.js');

// We apply the 'protect' middleware to all these routes.
// This means a user MUST be logged in to access them.

// /api/courses
router.route('/')
  .post(protect, createCourse) // Create a new course
  .get(protect, getMyCourses);  // Get all of my courses

// /api/courses/:id
router.route('/:id')
  .get(protect, getCourseById)    // Get one course
  .delete(protect, deleteCourse); // Delete one course


router.route('/:id/process-model-answer')
  .post(protect, processModelAnswer);
  
module.exports = router;