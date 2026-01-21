const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all deductions for a tax year
router.get('/tax-year/:taxYearId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.* FROM deductions d
       JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE d.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY d.amount DESC`,
      [req.params.taxYearId, req.user.id]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      category: row.category,
      description: row.description,
      amount: parseFloat(row.amount) || 0,
      isItemized: row.is_itemized,
      receiptPath: row.receipt_path,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Get deductions error:', error);
    res.status(500).json({ error: 'Failed to get deductions' });
  }
});

// Get deduction by id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.* FROM deductions d
       JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE d.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deduction not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      taxYearId: row.tax_year_id,
      category: row.category,
      description: row.description,
      amount: parseFloat(row.amount) || 0,
      isItemized: row.is_itemized,
      receiptPath: row.receipt_path
    });
  } catch (error) {
    console.error('Get deduction error:', error);
    res.status(500).json({ error: 'Failed to get deduction' });
  }
});

// Create deduction
router.post('/', async (req, res) => {
  try {
    const { taxYearId, category, description, amount, isItemized, receiptPath } = req.body;

    // Verify tax year belongs to user
    const tyResult = await db.query(
      'SELECT id FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const result = await db.query(
      `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized, receipt_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, taxYearId, category, description, amount, isItemized || false, receiptPath]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      category: row.category,
      description: row.description,
      amount: parseFloat(row.amount) || 0,
      isItemized: row.is_itemized
    });
  } catch (error) {
    console.error('Create deduction error:', error);
    res.status(500).json({ error: 'Failed to create deduction' });
  }
});

// Update deduction
router.put('/:id', async (req, res) => {
  try {
    const { category, description, amount, isItemized, receiptPath } = req.body;

    const result = await db.query(
      `UPDATE deductions SET
         category = COALESCE($1, category),
         description = COALESCE($2, description),
         amount = COALESCE($3, amount),
         is_itemized = COALESCE($4, is_itemized),
         receipt_path = COALESCE($5, receipt_path),
         updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [category, description, amount, isItemized, receiptPath, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deduction not found' });
    }

    res.json({ message: 'Deduction updated successfully' });
  } catch (error) {
    console.error('Update deduction error:', error);
    res.status(500).json({ error: 'Failed to update deduction' });
  }
});

// Delete deduction
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM deductions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deduction not found' });
    }

    res.json({ message: 'Deduction deleted successfully' });
  } catch (error) {
    console.error('Delete deduction error:', error);
    res.status(500).json({ error: 'Failed to delete deduction' });
  }
});

// Get deduction categories summary
router.get('/tax-year/:taxYearId/summary', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         category,
         COUNT(*) as count,
         SUM(amount) as total,
         BOOL_OR(is_itemized) as has_itemized
       FROM deductions d
       JOIN tax_years ty ON d.tax_year_id = ty.id
       WHERE d.tax_year_id = $1 AND ty.user_id = $2
       GROUP BY category
       ORDER BY total DESC`,
      [req.params.taxYearId, req.user.id]
    );

    // Also get standard deduction for filing status
    const userResult = await db.query(
      'SELECT filing_status FROM users WHERE id = $1',
      [req.user.id]
    );

    const filingStatus = userResult.rows[0]?.filing_status || 'single';
    const standardDeductions = {
      'single': 14600,
      'married_filing_jointly': 29200,
      'married_filing_separately': 14600,
      'head_of_household': 21900,
      'qualifying_widow': 29200
    };

    const totalItemized = result.rows.reduce((sum, row) =>
      sum + (parseFloat(row.total) || 0), 0
    );

    res.json({
      categories: result.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count),
        total: parseFloat(row.total) || 0,
        hasItemized: row.has_itemized
      })),
      totalItemized,
      standardDeduction: standardDeductions[filingStatus],
      recommendation: totalItemized > standardDeductions[filingStatus] ? 'itemize' : 'standard'
    });
  } catch (error) {
    console.error('Get deduction summary error:', error);
    res.status(500).json({ error: 'Failed to get deduction summary' });
  }
});

// Get common deduction categories
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { name: 'Mortgage Interest', maxDeduction: null, itemized: true },
      { name: 'Property Tax', maxDeduction: 10000, itemized: true },
      { name: 'State Income Tax', maxDeduction: 10000, itemized: true },
      { name: 'Charitable Donations', maxDeduction: null, itemized: true },
      { name: 'Medical Expenses', maxDeduction: null, itemized: true, note: 'Exceeding 7.5% of AGI' },
      { name: 'Student Loan Interest', maxDeduction: 2500, itemized: false },
      { name: 'Educator Expenses', maxDeduction: 300, itemized: false },
      { name: 'Health Insurance (Self-Employed)', maxDeduction: null, itemized: false },
      { name: 'Home Office', maxDeduction: null, itemized: true },
      { name: 'Business Expenses', maxDeduction: null, itemized: true },
      { name: 'Investment Interest', maxDeduction: null, itemized: true },
      { name: 'Vehicle Expenses', maxDeduction: null, itemized: true }
    ];

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

module.exports = router;
