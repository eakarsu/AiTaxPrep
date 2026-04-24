const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { validatePagination, validateBulkOperation, handleValidationErrors } = require('../middleware/sanitize');
const { exportLimiter, bulkLimiter } = require('../middleware/rateLimiter');

router.use(authMiddleware);

// Get all dependents for a tax year (with pagination, search, sort)
router.get('/tax-year/:taxYearId', validatePagination, handleValidationErrors, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, sortBy = 'date_of_birth', sortOrder = 'desc', relationship } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'd.tax_year_id = $1 AND ty.user_id = $2';
    const params = [req.params.taxYearId, req.user.id];
    let paramIdx = 3;

    if (search) {
      whereClause += ` AND (d.first_name ILIKE $${paramIdx} OR d.last_name ILIKE $${paramIdx} OR d.relationship ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (relationship) {
      whereClause += ` AND d.relationship = $${paramIdx}`;
      params.push(relationship);
      paramIdx++;
    }

    const allowedSorts = { date_of_birth: 'd.date_of_birth', first_name: 'd.first_name', relationship: 'd.relationship', created_at: 'd.created_at' };
    const orderBy = allowedSorts[sortBy] || 'd.date_of_birth';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM dependents d JOIN tax_years ty ON d.tax_year_id = ty.id WHERE ${whereClause}`, params
    );

    params.push(limit, offset);
    const result = await db.query(
      `SELECT d.* FROM dependents d JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE ${whereClause} ORDER BY ${orderBy} ${order} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`, params
    );

    const total = parseInt(countResult.rows[0].total);
    res.json({
      data: result.rows.map(row => ({
        id: row.id, firstName: row.first_name, lastName: row.last_name,
        relationship: row.relationship, dateOfBirth: row.date_of_birth,
        monthsLivedWith: row.months_lived_with, isStudent: row.is_student,
        isDisabled: row.is_disabled, createdAt: row.created_at
      })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dependents' });
  }
});

// CSV Export
router.get('/tax-year/:taxYearId/export/csv', exportLimiter, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.* FROM dependents d JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE d.tax_year_id = $1 AND ty.user_id = $2 ORDER BY d.first_name`,
      [req.params.taxYearId, req.user.id]
    );
    const headers = ['ID', 'First Name', 'Last Name', 'Relationship', 'DOB', 'Student', 'Disabled'];
    const rows = result.rows.map(r => [r.id, `"${r.first_name}"`, `"${r.last_name}"`, `"${r.relationship}"`, r.date_of_birth, r.is_student ? 'Yes' : 'No', r.is_disabled ? 'Yes' : 'No']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=dependents.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Bulk Delete
router.delete('/bulk', bulkLimiter, validateBulkOperation, handleValidationErrors, async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await db.query('DELETE FROM dependents WHERE id = ANY($1) AND user_id = $2 RETURNING id', [ids, req.user.id]);
    res.json({ message: `${result.rows.length} dependent(s) deleted`, deletedIds: result.rows.map(r => r.id) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Get single dependent
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.* FROM dependents d JOIN tax_years ty ON d.tax_year_id = ty.id WHERE d.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dependent not found' });
    const row = result.rows[0];
    res.json({ id: row.id, taxYearId: row.tax_year_id, firstName: row.first_name, lastName: row.last_name, relationship: row.relationship, dateOfBirth: row.date_of_birth, monthsLivedWith: row.months_lived_with, isStudent: row.is_student, isDisabled: row.is_disabled });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dependent' });
  }
});

// Create dependent
router.post('/', async (req, res) => {
  try {
    const { taxYearId, firstName, lastName, relationship, dateOfBirth, monthsLivedWith, isStudent, isDisabled } = req.body;
    const tyResult = await db.query('SELECT id FROM tax_years WHERE id = $1 AND user_id = $2', [taxYearId, req.user.id]);
    if (tyResult.rows.length === 0) return res.status(404).json({ error: 'Tax year not found' });
    const result = await db.query(
      `INSERT INTO dependents (user_id, tax_year_id, first_name, last_name, relationship, date_of_birth, months_lived_with, is_student, is_disabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, taxYearId, firstName, lastName, relationship, dateOfBirth, monthsLivedWith || 12, isStudent || false, isDisabled || false]
    );
    const row = result.rows[0];
    res.status(201).json({ id: row.id, firstName: row.first_name, lastName: row.last_name, relationship: row.relationship, dateOfBirth: row.date_of_birth });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create dependent' });
  }
});

// Update dependent
router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, relationship, dateOfBirth, monthsLivedWith, isStudent, isDisabled } = req.body;
    const result = await db.query(
      `UPDATE dependents SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
         relationship = COALESCE($3, relationship), date_of_birth = COALESCE($4, date_of_birth),
         months_lived_with = COALESCE($5, months_lived_with), is_student = COALESCE($6, is_student),
         is_disabled = COALESCE($7, is_disabled), updated_at = NOW()
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [firstName, lastName, relationship, dateOfBirth, monthsLivedWith, isStudent, isDisabled, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dependent not found' });
    res.json({ message: 'Dependent updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update dependent' });
  }
});

// Delete dependent
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM dependents WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dependent not found' });
    res.json({ message: 'Dependent deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete dependent' });
  }
});

// Check dependent eligibility for credits
router.get('/:id/eligibility', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.* FROM dependents d JOIN tax_years ty ON d.tax_year_id = ty.id WHERE d.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dependent not found' });
    const dep = result.rows[0];
    const age = Math.floor((new Date() - new Date(dep.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000));
    const eligibility = {
      childTaxCredit: age < 17 && dep.months_lived_with >= 6,
      childCareCredit: age < 13 && dep.months_lived_with >= 6,
      earnedIncomeCredit: (age < 19 || (age < 24 && dep.is_student) || dep.is_disabled) && dep.months_lived_with >= 6,
      educationCredits: age >= 18 && dep.is_student,
      dependentCareCredit: dep.is_disabled
    };
    res.json({
      dependent: { name: `${dep.first_name} ${dep.last_name}`, age, relationship: dep.relationship },
      eligibility,
      potentialCredits: Object.entries(eligibility).filter(([_, eligible]) => eligible).map(([credit]) => credit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

module.exports = router;
