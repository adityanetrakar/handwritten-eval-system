const Course = require('../models/Course.js');
const Student = require('../models/Student.js');
const Submission = require('../models/Submission.js');
const CoreService = require('../services/CoreService.js');
const fs = require('fs-extra');
const path = require('path');

// @desc    Upload, process, and grade a single student answer sheet
// @route   POST /api/submissions/:courseId
// @access  Private



const gradeStudentSubmission = async (req, res) => {
  console.log("=== Incoming Upload ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  console.log("File:", req.file);
  console.log("Files:", req.files);
  console.log("=======================");
  const { courseId } = req.params;
  const { filePath } = req.body; // Path to the uploaded student PDF

  if (!filePath) {
    return res.status(400).json({ message: 'filePath is required' });
  }

  let tempImagePaths = []; // To store paths for cleanup

  try {
    // 1. Find the course and its model answer key
    const course = await Course.findById(courseId);
    if (!course || course.modelAnswerKey.length === 0) {
      return res.status(400).json({ message: 'Course not found or model answer key is not processed.' });
    }
    
    // 2. Convert PDF to Images
    const fullPdfPath = path.join(__dirname, '..', filePath);
    tempImagePaths = await CoreService.convertPdfToImages(fullPdfPath);
    if (tempImagePaths.length === 0) {
      return res.status(400).json({ message: 'Could not convert PDF to images.' });
    }

    // 3. Extract USN from the first page
    let usn = await CoreService.extractUsnFromImage(tempImagePaths[0]);
    if (usn === 'UNKNOWN') {
      // console.log("⚠️ USN could not be extracted. Continuing with DEFAULT USN.");
      // generate fallback USN
      const randomId = "TEMP-" + Math.floor(Math.random() * 1000000);
      usn = randomId;
    }

    // 4. Find or Create Student record
    // We use a dummy name for now, as we only have the USN
    let student = await Student.findOneAndUpdate(
      { usn: usn },
      { $setOnInsert: { usn: usn, name: `Student ${usn}` } },
      { upsert: true, new: true } // 'upsert' creates if not found
    );

    // 5. Check for existing submission (to prevent duplicates)
    let existingSubmission = await Submission.findOne({ course: courseId, student: student._id });
    if (existingSubmission) {
      // For now, we'll just return the existing one.
      // You could also choose to delete and re-grade it.
      return res.status(409).json({ message: 'A submission for this student and course already exists.', submission: existingSubmission });
    }

    // 6. Extract raw text from all *other* pages (assuming page 1 is cover)
    let rawAnswerText = '';
    for (let i = 1; i < tempImagePaths.length; i++) {
      const text = await CoreService.extractTextFromImage(tempImagePaths[i]);
      rawAnswerText += text + '\n\n';
    }

    // 7. Parse student's text into a structured object
    const modelQuestionNumbers = course.modelAnswerKey.map(q => q.questionNumber);
    const studentAnswers = await CoreService.parseStudentAnswers(rawAnswerText, modelQuestionNumbers);

    // 8. Grade each answer
    const gradedAnswers = [];
    for (const modelQuestion of course.modelAnswerKey) {
      const { questionNumber, maxMarks, modelAnswerText } = modelQuestion;
      
      // Get the student's answer for this question
      const studentAnswerText = studentAnswers[questionNumber] || "";

      // grading
      const grade = await CoreService.gradeAnswerSemantically(
        modelAnswerText,
        studentAnswerText,
        maxMarks
      );

      gradedAnswers.push({
        questionNumber,
        maxMarks,
        studentAnswerText,
        aiMark: grade.score,
        aiFeedback: grade.feedback,
        teacherMark: grade.score, 
      });
    }

    // 9. Create and save the new Submission
    const newSubmission = new Submission({
      course: courseId,
      student: student._id,
      gradedAnswers: gradedAnswers,
      originalPdfPath: filePath,
      // The totalMarks will be auto-calculated by the 'pre-save' hook in the model
    });

    const savedSubmission = await newSubmission.save();
    
    // 10. Populate student info before sending
    await savedSubmission.populate('student', 'usn name');
    
    res.status(201).json(savedSubmission);

  } catch (error) {
    console.error('Error in gradeStudentSubmission:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  } finally {
    // 11. Clean up temporary image files
    for (const imgPath of tempImagePaths) {
      await fs.unlink(imgPath);
    }
  }
};

const getSubmissionsForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Find all submissions for the course and populate the 'student' field
    // We only select the 'usn' and 'name' from the student model
    const submissions = await Submission.find({ course: courseId })
      .populate('student', 'usn name')
      .sort({ createdAt: -1 }); // Show newest first

    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

const getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('student', 'usn name')
      .populate({
        path: 'course',
        select: 'teacher courseName totalMarks' // Select only fields we need
      });
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Security check: Ensure the logged-in user is the teacher
    if (submission.course.teacher.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc    Update marks for a submission
// @route   PUT /api/submissions/submission/:id
// @access  Private
const updateSubmissionMarks = async (req, res) => {
  try {
    const { gradedAnswers } = req.body; // Expecting the full, updated array
    
    const submission = await Submission.findById(req.params.id)
      .populate('course', 'teacher'); // Need course for security check

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Security check
    if (submission.course.teacher.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Update the submission's answers
    submission.gradedAnswers = gradedAnswers;
    
    // The 'pre-save' hook in your model will automatically recalculate 'totalMarks'
    const updatedSubmission = await submission.save();

    // Repopulate student/course info for the response
    await updatedSubmission.populate('student', 'usn name');
    await updatedSubmission.populate('course', 'courseName');
            
    res.json(updatedSubmission);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

const deleteSubmission = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('course', 'teacher'); // Need course for security check

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Security check: Make sure logged-in user is the teacher
    if (submission.course.teacher.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // TODO: Optionally, delete the physical PDF file from your /uploads folder
    // For now, we'll just delete the database record.
    // if (submission.originalPdfPath) {
    //   await fs.unlink(path.join(__dirname, '..', submission.originalPdfPath));
    // }

    await submission.deleteOne();

    res.json({ message: 'Submission removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// --- Now, update the module.exports at the bottom ---
module.exports = {
  gradeStudentSubmission,
  getSubmissionsForCourse,
  getSubmissionById,
  updateSubmissionMarks,
  deleteSubmission,       // <-- ADD THIS
};