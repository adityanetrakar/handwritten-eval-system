const express = require('express');
const router = express.Router();
const { uploadFile } = require('../controllers/uploadController.js');
const { protect } = require('../middleware/authMiddleware.js');
const { uploadPdf } = require('../config/multerConfig.js');

// @route   POST /api/upload
// 1. 'protect' middleware runs first to ensure the user is logged in.
// 2. 'uploadPdf.single('pdfFile')' runs next. It looks for a field named 'pdfFile'
//    in the form data. If it's a valid PDF, it saves it.
// 3. 'uploadFile' controller runs last, only if the upload was successful.
router.post(
  '/',
  protect,
  uploadPdf.single('pdfFile'), // 'pdfFile' must match the name in the frontend form
  uploadFile
);

module.exports = router;