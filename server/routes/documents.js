const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadDir, req.user.id.toString());
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  }
});

router.use(authMiddleware);

// Get all documents for a tax year
router.get('/tax-year/:taxYearId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.* FROM documents d
       JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE d.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY d.upload_date DESC`,
      [req.params.taxYearId, req.user.id]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      documentType: row.document_type,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      uploadDate: row.upload_date,
      processed: row.processed,
      extractedData: row.extracted_data
    })));
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// Get single document
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.* FROM documents d
       JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE d.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      taxYearId: row.tax_year_id,
      documentType: row.document_type,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      uploadDate: row.upload_date,
      processed: row.processed,
      extractedData: row.extracted_data
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// Upload document
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { taxYearId, documentType } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify tax year belongs to user
    const tyResult = await db.query(
      'SELECT id FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const result = await db.query(
      `INSERT INTO documents (
         user_id, tax_year_id, document_type, file_name, file_path,
         file_size, mime_type
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id, taxYearId, documentType, req.file.originalname,
        req.file.path, req.file.size, req.file.mimetype
      ]
    );

    // Log upload
    await db.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'UPLOAD', 'document', result.rows[0].id]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      documentType: row.document_type,
      fileName: row.file_name,
      fileSize: row.file_size,
      uploadDate: row.upload_date
    });
  } catch (error) {
    console.error('Upload document error:', error);
    // Clean up file if it was uploaded
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Update document metadata
router.put('/:id', async (req, res) => {
  try {
    const { documentType, processed, extractedData } = req.body;

    const result = await db.query(
      `UPDATE documents SET
         document_type = COALESCE($1, document_type),
         processed = COALESCE($2, processed),
         extracted_data = COALESCE($3, extracted_data),
         updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [documentType, processed, JSON.stringify(extractedData), req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document updated successfully' });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id', async (req, res) => {
  try {
    // Get document path first
    const docResult = await db.query(
      'SELECT file_path FROM documents WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = docResult.rows[0].file_path;

    // Delete from database
    await db.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    // Delete file from disk
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Download document
router.get('/:id/download', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.* FROM documents d
       JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE d.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];

    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(doc.file_path, doc.file_name);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Get document types
router.get('/types/list', async (req, res) => {
  try {
    const types = [
      { type: 'W-2', description: 'Wage and Tax Statement from employer' },
      { type: '1099-INT', description: 'Interest Income' },
      { type: '1099-DIV', description: 'Dividend Income' },
      { type: '1099-NEC', description: 'Non-Employee Compensation' },
      { type: '1099-MISC', description: 'Miscellaneous Income' },
      { type: '1099-G', description: 'Government Payments (unemployment, state refund)' },
      { type: '1099-R', description: 'Retirement Distributions' },
      { type: '1098', description: 'Mortgage Interest Statement' },
      { type: '1098-T', description: 'Tuition Statement' },
      { type: '1098-E', description: 'Student Loan Interest' },
      { type: 'Receipt', description: 'Receipt for deductible expense' },
      { type: 'Other', description: 'Other tax-related document' }
    ];

    res.json(types);
  } catch (error) {
    console.error('Get document types error:', error);
    res.status(500).json({ error: 'Failed to get document types' });
  }
});

module.exports = router;
