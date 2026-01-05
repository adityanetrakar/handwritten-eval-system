import axios from 'axios';

const API_URL = 'http://localhost:5001/api/upload';

// Helper to get the auth token
const getAuthHeader = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.token) {
    return { Authorization: `Bearer ${user.token}` };
  }
  return {};
};

/**
 * Uploads a file (PDF) to the backend.
 * @param {File} file - The file object from the <input>
 * @returns {object} - The response from the server, e.g., { filePath: "..." }
 */
const uploadPdf = async (file) => {
  // We must use FormData for file uploads
  const formData = new FormData();
  
  // The 'pdfFile' key MUST match the name in your backend multer config:
  // uploadPdf.single('pdfFile')
  formData.append('pdfFile', file);

  const response = await axios.post(API_URL, formData, {
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'multipart/form-data', // This header is essential
    },
  });

  return response.data; // e.g., { message: "...", filePath: "/uploads/..." }
};

const uploadService = {
  uploadPdf,
};

export default uploadService;