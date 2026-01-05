import axios from 'axios';

const API_URL = 'http://localhost:5001/api/submissions';

const getAuthHeader = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.token) {
    return { Authorization: `Bearer ${user.token}` };
  }
  return {};
};

// UPDATED PATH: Now uses /course/:courseId
const gradeSubmission = async (courseId, filePath) => {
  const response = await axios.post(
    `${API_URL}/course/${courseId}`,
    { filePath },
    { headers: getAuthHeader() }
  );
  return response.data;
};

// UPDATED PATH: Now uses /course/:courseId
const getSubmissionsForCourse = async (courseId) => {
  const response = await axios.get(
    `${API_URL}/course/${courseId}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// NEW FUNCTION: Gets a single submission
const getSubmissionById = async (submissionId) => {
  const response = await axios.get(
    `${API_URL}/submission/${submissionId}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// NEW FUNCTION: Updates marks
const updateSubmissionMarks = async (submissionId, gradedAnswers) => {
  const response = await axios.put(
    `${API_URL}/submission/${submissionId}`,
    { gradedAnswers }, // Send the full updated array
    { headers: getAuthHeader() }
  );
  return response.data;
};

const deleteSubmission = async (submissionId) => {
  const response = await axios.delete(
    `${API_URL}/submission/${submissionId}`,
    { headers: getAuthHeader() }
  );
  return response.data; // e.g., { message: "Submission removed" }
};

const submissionService = {
  gradeSubmission,
  getSubmissionsForCourse,
  getSubmissionById,
  updateSubmissionMarks,
  deleteSubmission, // <-- ADD THIS
};

export default submissionService;