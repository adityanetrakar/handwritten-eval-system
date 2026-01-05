import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom'; // Import Link
import courseService from '../services/courseService';
import uploadService from '../services/uploadService';
import submissionService from '../services/submissionService'; // <-- NEW
import './CoursePage.css'; // We'll add new styles to this


const CoursePage = () => {
  const { id: courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [submissions, setSubmissions] = useState([]); // <-- NEW: To store submissions list
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // States for Model Answer uploader
  const [modelFile, setModelFile] = useState(null);
  const [modelUploadStatus, setModelUploadStatus] = useState('');

  // --- NEW: States for Student Submission uploader ---
  const [studentFiles, setStudentFiles] = useState(null); // Can hold multiple files
  const [studentUploadStatus, setStudentUploadStatus] = useState('');
  const [isGrading, setIsGrading] = useState(false);

  // Fetch all course data AND submission data on load
  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch in parallel
        const [courseData, submissionsData] = await Promise.all([
          courseService.getCourseById(courseId),
          submissionService.getSubmissionsForCourse(courseId)
        ]);
        
        setCourse(courseData);
        setSubmissions(submissionsData);
      } catch (err) {
        setError('Failed to fetch page data.');
      } finally {
        setLoading(false);
      }
    };
    loadPageData();
  }, [courseId]);

  // --- Handler for Model Answer Upload ---
  const handleModelFileChange = (e) => {
    setModelFile(e.target.files[0]);
    setModelUploadStatus('');
  };

  const handleModelUploadSubmit = async (e) => {
    e.preventDefault();
    if (!modelFile) {
      setModelUploadStatus('Please select a PDF file first.');
      return;
    }
    try {
      setModelUploadStatus('Uploading PDF...');
      const { filePath } = await uploadService.uploadPdf(modelFile);

      setModelUploadStatus('Processing with AI... This may take a moment.');
      const updatedCourse = await courseService.processModelAnswer(courseId, filePath);
      
      setCourse(updatedCourse);
      setModelUploadStatus('Model answer processed and saved!');
      setModelFile(null);
    } catch (err) {
      console.error(err);
      setModelUploadStatus(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  // --- NEW: Handler for Student Submissions ---
  const handleStudentFileChange = (e) => {
    setStudentFiles(e.target.files); // e.target.files is a FileList
    setStudentUploadStatus('');
  };

  const handleStudentUploadSubmit = async (e) => {
    e.preventDefault();
    if (!studentFiles || studentFiles.length === 0) {
      setStudentUploadStatus('Please select one or more PDF files.');
      return;
    }

    setIsGrading(true);
    let successCount = 0;
    let errorCount = 0;
    const newSubmissionsList = [...submissions];

    for (const file of studentFiles) {
      try {
        setStudentUploadStatus(`Uploading "${file.name}"...`);
        const { filePath } = await uploadService.uploadPdf(file);

        setStudentUploadStatus(`Grading "${file.name}"...`);
        const newSubmission = await submissionService.gradeSubmission(courseId, filePath);
        
        // Add new submission to the top of our list
        newSubmissionsList.unshift(newSubmission);
        successCount++;
        
      } catch (err) {
        console.error(`Failed to process ${file.name}:`, err);
        errorCount++;
        setStudentUploadStatus(`Error on ${file.name}: ${err.response?.data?.message || 'Failed'}`);
      }
    }

    setSubmissions(newSubmissionsList); // Update state with all new submissions
    setStudentUploadStatus(`Batch complete: ${successCount} graded, ${errorCount} failed.`);
    setStudentFiles(null);
    e.target.reset(); // Reset the file input form
    setIsGrading(false);
  };

  const handleDeleteSubmission = async (submissionId) => {
    // Ask for confirmation before deleting
    if (!window.confirm('Are you sure you want to permanently delete this submission?')) {
      return;
    }

    try {
      await submissionService.deleteSubmission(submissionId);
      // On success, remove the submission from the state to update the UI
      setSubmissions(prevSubmissions => 
        prevSubmissions.filter(sub => sub._id !== submissionId)
      );
    } catch (err) {
      console.error(err);
      // Use the student upload status to display delete errors
      setStudentUploadStatus(`Error: ${err.response?.data?.message || 'Failed to delete'}`);
    }
  };

  if (loading) return <p>Loading course details...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!course) return <p>Course not found.</p>;

  return (
    <div className="course-page-container">
      <header className="course-header">
        <h2>{course.courseName}</h2>
        <p>{course.courseCode}</p>
      </header>

      {/* --- MODEL ANSWER & STUDENT UPLOADERS --- */}
      <div className="course-upload-grid">
        {/* Model Answer Uploader */}
        <section className="course-section">
          <h3>Model Answer Sheet</h3>
          <form className="uploader-form" onSubmit={handleModelUploadSubmit}>
            <label htmlFor="model-answer-upload">
              {course.modelAnswerKey && course.modelAnswerKey.length > 0
                ? 'Re-upload to overwrite Answer Key'
                : 'Upload Model Answer PDF'}
            </label>
            <input
              type="file"
              id="model-answer-upload"
              accept="application/pdf"
              onChange={handleModelFileChange}
            />
            <button
              type="submit"
              className="upload-btn"
              disabled={!modelFile || modelUploadStatus.includes('...')}
            >
              {modelUploadStatus.includes('...') ? 'Processing...' : 'Upload & Process'}
            </button>
            {modelUploadStatus && <p className="upload-status">{modelUploadStatus}</p>}
          </form>
        </section>

        {/* NEW: Student Submissions Uploader */}
        <section className="course-section">
          <h3>Student Answer Sheets</h3>
          <form className="uploader-form" onSubmit={handleStudentUploadSubmit}>
            <label htmlFor="student-sheets-upload">
              Upload Student PDFs (Batch)
            </label>
            <input
              type="file"
              id="student-sheets-upload"
              accept="application/pdf"
              onChange={handleStudentFileChange}
              multiple // <-- Allows multiple file selection
            />
            <button
              type="submit"
              className="upload-btn student"
              disabled={!studentFiles || isGrading}
            >
              {isGrading ? 'Grading...' : 'Upload & Grade All'}
            </button>
            {studentUploadStatus && <p className="upload-status">{studentUploadStatus}</p>}
          </form>
        </section>
      </div>

      {/* --- NEW: SUBMISSIONS TABLE --- */}
      <section className="course-section submissions-table-section">
        <h3>Student Submissions</h3>
        <div className="table-container">
          <table className="submissions-table">
            <thead>
              <tr>
                <th>USN</th>
                <th>Student Name</th>
                <th>Total Marks</th>
                <th>Graded On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length > 0 ? (
                submissions.map((sub) => (
                  <tr key={sub._id}>
                    <td>{sub.student?.usn || 'N/A'}</td>
                    <td>{sub.student?.name || 'N/A'}</td>
                    <td>{sub.totalMarks} / {course.modelAnswerKey.reduce((acc, q) => acc + q.maxMarks, 0)}</td>
                    <td>{new Date(sub.createdAt).toLocaleString()}</td>
                    <td>
                      <Link to={`/submission/${sub._id}`} className="table-action-btn">
                        View & Edit
                      </Link>
                      <button 
                        onClick={() => handleDeleteSubmission(sub._id)}
                        className="table-action-btn delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center' }}>
                    No submissions have been graded for this course yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- MODEL ANSWER KEY (Moved to bottom) --- */}
      <section className="course-section">
        <h3>Processed Answer Key</h3>
        {course.modelAnswerKey && course.modelAnswerKey.length > 0 ? (
          <div className="answer-key-list">
            {course.modelAnswerKey.map((item, index) => (
              <div key={index} className="answer-key-item">
                <div className="key-header">
                  <span className="key-q-num">Q: {item.questionNumber}</span>
                  <span className="key-marks">{item.maxMarks} Marks</span>
                </div>
                <pre className="key-answer-text">{item.modelAnswerText}</pre>
              </div>
            ))}
          </div>
        ) : (
          <p>Answer key is empty. Upload a model answer PDF.</p>
        )}
      </section>
    </div>
  );
};

export default CoursePage;