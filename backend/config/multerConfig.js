const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 1. Configure Storage
// Define where to store the files and how to name them
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save files to the 'uploads/' directory
  },
  filename: (req, file, cb) => {
    // Generate a unique filename: uuid + original file extension
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  },
});

// 2. Configure File Filter
// This function checks if the uploaded file is a PDF
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true); // Accept the file
  } else {
    // Reject the file and send an error
    cb(new Error('Only .pdf files are allowed!'), false);
  }
};

// 3. Create the Multer upload instance
// We set limits: 50MB file size
const uploadPdf = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
});

module.exports = { uploadPdf };