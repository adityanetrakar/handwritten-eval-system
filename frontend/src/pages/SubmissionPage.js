import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import submissionService from '../services/submissionService';
import './SubmissionPage.css';

const SubmissionPage = () => {
  const { id: submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  // We need a separate state for the answers so we can edit them
  const [gradedAnswers, setGradedAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch data on load
  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        setLoading(true);
        const data = await submissionService.getSubmissionById(submissionId);
        setSubmission(data);
        setGradedAnswers(data.gradedAnswers); // Set the editable state
      } catch (err) {
        setError('Failed to fetch submission details.');
      } finally {
        setLoading(false);
      }
    };
    fetchSubmission();
  }, [submissionId]);

  // Handle changes to the mark input fields
  const handleMarkChange = (e, questionNumber) => {
    // Get the new mark, ensuring it's a number and not above max
    const newMark = parseFloat(e.target.value);
    
    setGradedAnswers(prevAnswers =>
      prevAnswers.map(ans => {
        if (ans.questionNumber === questionNumber) {
          // Don't allow marks > maxMarks or < 0
          if (newMark > ans.maxMarks) return { ...ans, teacherMark: ans.maxMarks };
          if (newMark < 0) return { ...ans, teacherMark: 0 };
          return { ...ans, teacherMark: newMark };
        }
        return ans;
      })
    );
  };

  // Recalculate total marks locally for immediate feedback
  const localTotalMarks = gradedAnswers.reduce(
    (acc, ans) => acc + (ans.teacherMark || 0), 0
  );
  
  const maxTotalMarks = gradedAnswers.reduce(
    (acc, ans) => acc + (ans.maxMarks || 0), 0
  );

  // Handle the "Save" button click
  const handleSaveMarks = async () => {
    setIsSaving(true);
    try {
      const updatedSubmission = await submissionService.updateSubmissionMarks(
        submissionId,
        gradedAnswers // Send the entire updated array
      );
      // Update our page state with the saved data
      setSubmission(updatedSubmission);
      setGradedAnswers(updatedSubmission.gradedAnswers);
      alert('Marks updated successfully!');
    } catch (err) {
      setError('Failed to save marks.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <p>Loading submission...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!submission) return <p>Submission not found.</p>;

  return (
    <div className="submission-page">
      <header className="sub-header">
        <div>
          <h2>{submission.student.name}</h2>
          <p>
            <strong>USN:</strong> {submission.student.usn} |{' '}
            <Link to={`/course/${submission.course._id}`}>
              Back to {submission.course.courseName}
            </Link>
          </p>
        </div>
        <div className="sub-total-score">
          <h3>Total Score</h3>
          <span className="score">{localTotalMarks} / {maxTotalMarks}</span>
        </div>
        <button
          className="save-marks-btn"
          onClick={handleSaveMarks}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save All Changes'}
        </button>
      </header>

      <div className="grading-grid">
        {gradedAnswers.map((ans) => (
          <div key={ans.questionNumber} className="question-card">
            <header className="question-card-header">
              <h4>Question: {ans.questionNumber}</h4>
              <div className="marks-control">
                <input
                  type="number"
                  className="marks-input"
                  value={ans.teacherMark}
                  onChange={(e) => handleMarkChange(e, ans.questionNumber)}
                  max={ans.maxMarks}
                  min={0}
                />
                <span className="marks-max">/ {ans.maxMarks} Marks</span>
              </div>
            </header>
            
            <div className="student-answer-col">
              <h5>Student's Answer:</h5>
              <pre className="student-answer-text">
                {ans.studentAnswerText || '(No answer provided)'}
              </pre>
            </div>
            
            <div className="grading-col">
              <div className="grading-item">
                <h5>Feedback:</h5>
                <div className="ai-feedback">{ans.aiFeedback}</div>
              </div>
              <div className="grading-item">
                <h5>Predicted Marks:</h5>
                <p><strong>{ans.aiMark} / {ans.maxMarks}</strong></p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubmissionPage;