const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { validatePagination, validateBulkOperation, handleValidationErrors } = require('../middleware/sanitize');
const { exportLimiter, bulkLimiter } = require('../middleware/rateLimiter');

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

// Get all documents for a tax year (with pagination, search, sort, filter)
router.get('/tax-year/:taxYearId', validatePagination, handleValidationErrors, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, sortBy = 'upload_date', sortOrder = 'desc', documentType } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'd.tax_year_id = $1 AND ty.user_id = $2';
    const params = [req.params.taxYearId, req.user.id];
    let paramIdx = 3;

    if (search) {
      whereClause += ` AND (d.file_name ILIKE $${paramIdx} OR d.document_type ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (documentType) {
      whereClause += ` AND d.document_type = $${paramIdx}`;
      params.push(documentType);
      paramIdx++;
    }

    const allowedSorts = { upload_date: 'd.upload_date', file_name: 'd.file_name', document_type: 'd.document_type', file_size: 'd.file_size', created_at: 'd.created_at' };
    const orderBy = allowedSorts[sortBy] || 'd.upload_date';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM documents d JOIN tax_years ty ON d.tax_year_id = ty.id WHERE ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const result = await db.query(
      `SELECT d.* FROM documents d
       JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE ${whereClause}
       ORDER BY ${orderBy} ${order}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);

    res.json({
      data: result.rows.map(row => ({
        id: row.id,
        documentType: row.document_type,
        fileName: row.file_name,
        filePath: row.file_path,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        uploadDate: row.upload_date,
        processed: row.processed,
        extractedData: row.extracted_data,
        createdAt: row.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// CSV Export
router.get('/tax-year/:taxYearId/export/csv', exportLimiter, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.* FROM documents d JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE d.tax_year_id = $1 AND ty.user_id = $2 ORDER BY d.upload_date DESC`,
      [req.params.taxYearId, req.user.id]
    );

    const headers = ['ID', 'Type', 'File Name', 'File Size', 'Upload Date', 'Processed'];
    const rows = result.rows.map(r => [
      r.id, `"${r.document_type}"`, `"${r.file_name}"`, r.file_size || 0,
      new Date(r.upload_date).toLocaleDateString(), r.processed ? 'Yes' : 'No'
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=documents.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export documents CSV error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Bulk Delete
router.delete('/bulk', bulkLimiter, validateBulkOperation, handleValidationErrors, async (req, res) => {
  try {
    const { ids } = req.body;

    // Get file paths before deleting
    const docs = await db.query(
      'SELECT id, file_path FROM documents WHERE id = ANY($1) AND user_id = $2',
      [ids, req.user.id]
    );

    const result = await db.query(
      'DELETE FROM documents WHERE id = ANY($1) AND user_id = $2 RETURNING id',
      [ids, req.user.id]
    );

    // Delete files from disk
    for (const doc of docs.rows) {
      if (doc.file_path && fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path);
      }
    }

    await db.query(
      `INSERT INTO bulk_operations_log (user_id, operation_type, entity_type, entity_ids, details)
       VALUES ($1, 'delete', 'documents', $2, $3)`,
      [req.user.id, JSON.stringify(ids), JSON.stringify({ deletedCount: result.rows.length })]
    );

    res.json({ message: `${result.rows.length} document(s) deleted`, deletedIds: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete documents error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
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

    const tyResult = await db.query(
      'SELECT id FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
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
      [documentType, processed, extractedData ? JSON.stringify(extractedData) : null, req.params.id, req.user.id]
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
    const docResult = await db.query(
      'SELECT file_path FROM documents WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = docResult.rows[0].file_path;

    await db.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (filePath && fs.existsSync(filePath)) {
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
