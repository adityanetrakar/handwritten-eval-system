
const CoreService = require('../services/CoreService.js');
const Course = require('../models/Course.js');
const fs = require('fs-extra'); // We need fs-extra to delete temp files
const path = require('path');
// @desc    Create a new course
// @route   POST /api/courses
// @access  Private (Needs 'protect' middleware)
const createCourse = async (req, res) => {
  try {
    const { courseName, courseCode } = req.body;

    // Create a new course and assign the logged-in user as the teacher
    const course = new Course({
      courseName,
      courseCode,
      teacher: req.user._id, // We get req.user from the 'protect' middleware
    });

    const createdCourse = await course.save();
    res.status(201).json(createdCourse);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc    Get all courses for the logged-in teacher
// @route   GET /api/courses
// @access  Private
const getMyCourses = async (req, res) => {
  try {
    // Find all courses where the 'teacher' field matches the logged-in user's ID
    const courses = await Course.find({ teacher: req.user._id });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc    Get a single course by its ID
// @route   GET /api/courses/:id
// @access  Private
const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (course) {
      // **Security Check:** Make sure the logged-in user is the teacher
      if (course.teacher.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'Not authorized' });
      }
      res.json(course);
    } else {
      res.status(404).json({ message: 'Course not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc    Delete a course
// @route   DELETE /api/courses/:id
// @access  Private
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (course) {
      // **Security Check:** Make sure the logged-in user is the teacher
      if (course.teacher.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'Not authorized' });
      }
      await course.deleteOne();
      res.json({ message: 'Course removed' });
    } else {
      res.status(404).json({ message: 'Course not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

const processModelAnswer = async (req, res) => {
  try {
    const { filePath } = req.body; // e.g., "uploads/123-abc.pdf"
    if (!filePath) {
      return res.status(400).json({ message: 'filePath is required' });
    }

    const course = await Course.findById(req.params.id);

    // 1. Security Check: Ensure user owns this course
    if (!course || course.teacher.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const fullPdfPath = path.join(__dirname, '..', filePath);

    // 2. Call Gemini Service: PDF -> Images
    const imagePaths = await CoreService.convertPdfToImages(fullPdfPath);

    // 3. Call Gemini Service: Images -> Text
    let allExtractedText = '';
    for (const imgPath of imagePaths) {
      const text = await CoreServiceService.extractTextFromImage(imgPath);
      allExtractedText += text + '\n\n'; // Add newlines to separate pages
    }

    // 4. Clean up temporary image files
    for (const imgPath of imagePaths) {
      await fs.unlink(imgPath);
    }

    if (allExtractedText.trim().length === 0) {
      return res.status(400).json({ message: 'Could not extract any text from the PDF.' });
    }

    // 5. Call Gemini Service: Raw Text -> Structured JSON
    const structuredAnswerKey = await CoreService.parseTextToModelAnswer(allExtractedText);

    if (structuredAnswerKey.length === 0) {
      return res.status(400).json({ 
        message: 'AI failed to parse the document into a structured answer key.',
        rawText: allExtractedText // Send back text for debugging
      });
    }

    // 6. Save the new answer key to the course
    course.modelAnswerKey = structuredAnswerKey;
    const updatedCourse = await course.save();

    res.json(updatedCourse);

  } catch (error) {
    console.error('Error in processModelAnswer:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Now update the module.exports at the bottom
module.exports = {
  createCourse,
  getMyCourses,
  getCourseById,
  deleteCourse,
  processModelAnswer, // <-- ADD THIS
};