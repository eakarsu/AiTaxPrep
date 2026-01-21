const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all tax years for user
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ty.*, tc.gross_income, tc.federal_tax_liability, tc.total_tax_withheld
       FROM tax_years ty
       LEFT JOIN tax_calculations tc ON ty.id = tc.tax_year_id
       WHERE ty.user_id = $1
       ORDER BY ty.year DESC`,
      [req.user.id]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      year: row.year,
      status: row.status,
      federalRefund: parseFloat(row.federal_refund) || 0,
      federalOwed: parseFloat(row.federal_owed) || 0,
      stateRefund: parseFloat(row.state_refund) || 0,
      stateOwed: parseFloat(row.state_owed) || 0,
      grossIncome: parseFloat(row.gross_income) || 0,
      federalTaxLiability: parseFloat(row.federal_tax_liability) || 0,
      totalTaxWithheld: parseFloat(row.total_tax_withheld) || 0,
      submittedAt: row.submitted_at,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Get tax years error:', error);
    res.status(500).json({ error: 'Failed to get tax years' });
  }
});

// Get single tax year
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM tax_years WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      year: row.year,
      status: row.status,
      federalRefund: parseFloat(row.federal_refund) || 0,
      federalOwed: parseFloat(row.federal_owed) || 0,
      stateRefund: parseFloat(row.state_refund) || 0,
      stateOwed: parseFloat(row.state_owed) || 0,
      submittedAt: row.submitted_at,
      createdAt: row.created_at
    });
  } catch (error) {
    console.error('Get tax year error:', error);
    res.status(500).json({ error: 'Failed to get tax year' });
  }
});

// Create new tax year
router.post('/', async (req, res) => {
  try {
    const { year } = req.body;

    // Check if tax year already exists
    const existing = await db.query(
      'SELECT id FROM tax_years WHERE user_id = $1 AND year = $2',
      [req.user.id, year]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Tax year already exists' });
    }

    const result = await db.query(
      `INSERT INTO tax_years (user_id, year, status)
       VALUES ($1, $2, 'in_progress')
       RETURNING *`,
      [req.user.id, year]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      year: row.year,
      status: row.status,
      federalRefund: 0,
      federalOwed: 0,
      createdAt: row.created_at
    });
  } catch (error) {
    console.error('Create tax year error:', error);
    res.status(500).json({ error: 'Failed to create tax year' });
  }
});

// Update tax year status
router.put('/:id', async (req, res) => {
  try {
    const { status, federalRefund, federalOwed, stateRefund, stateOwed } = req.body;

    const result = await db.query(
      `UPDATE tax_years SET
         status = COALESCE($1, status),
         federal_refund = COALESCE($2, federal_refund),
         federal_owed = COALESCE($3, federal_owed),
         state_refund = COALESCE($4, state_refund),
         state_owed = COALESCE($5, state_owed),
         submitted_at = CASE WHEN $1 = 'submitted' THEN NOW() ELSE submitted_at END,
         updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [status, federalRefund, federalOwed, stateRefund, stateOwed, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      year: row.year,
      status: row.status,
      federalRefund: parseFloat(row.federal_refund) || 0,
      federalOwed: parseFloat(row.federal_owed) || 0,
      stateRefund: parseFloat(row.state_refund) || 0,
      stateOwed: parseFloat(row.state_owed) || 0,
      submittedAt: row.submitted_at
    });
  } catch (error) {
    console.error('Update tax year error:', error);
    res.status(500).json({ error: 'Failed to update tax year' });
  }
});

// Delete tax year
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM tax_years WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    res.json({ message: 'Tax year deleted successfully' });
  } catch (error) {
    console.error('Delete tax year error:', error);
    res.status(500).json({ error: 'Failed to delete tax year' });
  }
});

// Get tax year summary
router.get('/:id/summary', async (req, res) => {
  try {
    const taxYearId = req.params.id;

    // Verify ownership
    const tyResult = await db.query(
      'SELECT * FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    // Get income summary
    const incomeResult = await db.query(
      `SELECT SUM(wages) as total_wages, SUM(other_income) as total_other,
              SUM(federal_tax_withheld) as fed_withheld, SUM(state_tax_withheld) as state_withheld
       FROM income_sources WHERE tax_year_id = $1`,
      [taxYearId]
    );

    // Get deductions summary
    const deductionsResult = await db.query(
      `SELECT SUM(amount) as total, COUNT(*) as count
       FROM deductions WHERE tax_year_id = $1`,
      [taxYearId]
    );

    // Get credits summary
    const creditsResult = await db.query(
      `SELECT SUM(amount) as total, COUNT(*) as count
       FROM tax_credits WHERE tax_year_id = $1`,
      [taxYearId]
    );

    // Get dependents count
    const dependentsResult = await db.query(
      'SELECT COUNT(*) as count FROM dependents WHERE tax_year_id = $1',
      [taxYearId]
    );

    // Get documents count
    const docsResult = await db.query(
      'SELECT COUNT(*) as count FROM documents WHERE tax_year_id = $1',
      [taxYearId]
    );

    const income = incomeResult.rows[0];
    const deductions = deductionsResult.rows[0];
    const credits = creditsResult.rows[0];

    res.json({
      taxYear: tyResult.rows[0].year,
      status: tyResult.rows[0].status,
      income: {
        totalWages: parseFloat(income.total_wages) || 0,
        totalOther: parseFloat(income.total_other) || 0,
        federalWithheld: parseFloat(income.fed_withheld) || 0,
        stateWithheld: parseFloat(income.state_withheld) || 0
      },
      deductions: {
        total: parseFloat(deductions.total) || 0,
        count: parseInt(deductions.count) || 0
      },
      credits: {
        total: parseFloat(credits.total) || 0,
        count: parseInt(credits.count) || 0
      },
      dependentsCount: parseInt(dependentsResult.rows[0].count) || 0,
      documentsCount: parseInt(docsResult.rows[0].count) || 0
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to get tax year summary' });
  }
});

module.exports = router;
