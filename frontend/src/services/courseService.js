import axios from 'axios';

const API_URL = 'http://localhost:5001/api/courses';

/**
 * Creates the authorization header with the user's token.
 * @returns {object} The header object, or an empty object if no user.
 */
const getAuthHeader = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  
  if (user && user.token) {
    return { Authorization: `Bearer ${user.token}` };
  } else {
    return {};
  }
};



/**
 * Fetches all courses for the logged-in teacher.
 */
const getMyCourses = async () => {
  const response = await axios.get(API_URL, {
    headers: getAuthHeader()
  });
  return response.data;
};

/**
 * Creates a new course.
 * @param {string} courseName
 * @param {string} courseCode
 */
const createCourse = async (courseName, courseCode) => {
  const response = await axios.post(API_URL, 
    { courseName, courseCode },
    { headers: getAuthHeader() }
  );
  return response.data;
};

const getCourseById = async (courseId) => {
  const response = await axios.get(`${API_URL}/${courseId}`, {
    headers: getAuthHeader()
  });
  return response.data;
};
const processModelAnswer = async (courseId, filePath) => {
  const response = await axios.post(
    `${API_URL}/${courseId}/process-model-answer`,
    { filePath }, // Send the filePath in the request body
    { headers: getAuthHeader() }
  );
  return response.data; // Returns the *updated* course with the answer key
};


// --- Update the export at the bottom ---
const courseService = {
  getMyCourses,
  createCourse,
  getCourseById, // <-- ADD THIS
  processModelAnswer, // <-- ADD THIS
};

export default courseService;