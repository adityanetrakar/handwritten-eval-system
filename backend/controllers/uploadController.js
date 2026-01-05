// @desc    Upload a file (e.g., model answer PDF)
// @route   POST /api/upload
// @access  Private (Handled by middleware in the route)
const uploadFile = (req, res) => {
  // 'multer' adds a 'file' object to the request (req) if a single file is uploaded
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a file.' });
  }

  // We construct the file path to be returned to the frontend
  // We replace backslashes (\) with forward slashes (/) for cross-platform compatibility
  const filePath = `/${req.file.path.replace(/\\/g, '/')}`;

  res.status(200).json({
    message: 'File uploaded successfully.',
    filePath: filePath, // e.g., "/uploads/123e4567-e89b-12d3-a456-426614174000.pdf"
  });
};

module.exports = {
  uploadFile,
};