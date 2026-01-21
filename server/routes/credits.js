const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all tax credits for a tax year
router.get('/tax-year/:taxYearId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.* FROM tax_credits c
       JOIN tax_years ty ON c.tax_year_id = ty.id
       WHERE c.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY c.amount DESC`,
      [req.params.taxYearId, req.user.id]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      creditType: row.credit_type,
      description: row.description,
      amount: parseFloat(row.amount) || 0,
      isRefundable: row.is_refundable,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({ error: 'Failed to get tax credits' });
  }
});

// Get single credit
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.* FROM tax_credits c
       JOIN tax_years ty ON c.tax_year_id = ty.id
       WHERE c.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tax credit not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      taxYearId: row.tax_year_id,
      creditType: row.credit_type,
      description: row.description,
      amount: parseFloat(row.amount) || 0,
      isRefundable: row.is_refundable
    });
  } catch (error) {
    console.error('Get credit error:', error);
    res.status(500).json({ error: 'Failed to get tax credit' });
  }
});

// Create tax credit
router.post('/', async (req, res) => {
  try {
    const { taxYearId, creditType, description, amount, isRefundable } = req.body;

    // Verify tax year belongs to user
    const tyResult = await db.query(
      'SELECT id FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const result = await db.query(
      `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, description, amount, is_refundable)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, taxYearId, creditType, description, amount, isRefundable || false]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      creditType: row.credit_type,
      description: row.description,
      amount: parseFloat(row.amount) || 0,
      isRefundable: row.is_refundable
    });
  } catch (error) {
    console.error('Create credit error:', error);
    res.status(500).json({ error: 'Failed to create tax credit' });
  }
});

// Update tax credit
router.put('/:id', async (req, res) => {
  try {
    const { creditType, description, amount, isRefundable } = req.body;

    const result = await db.query(
      `UPDATE tax_credits SET
         credit_type = COALESCE($1, credit_type),
         description = COALESCE($2, description),
         amount = COALESCE($3, amount),
         is_refundable = COALESCE($4, is_refundable),
         updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [creditType, description, amount, isRefundable, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tax credit not found' });
    }

    res.json({ message: 'Tax credit updated successfully' });
  } catch (error) {
    console.error('Update credit error:', error);
    res.status(500).json({ error: 'Failed to update tax credit' });
  }
});

// Delete tax credit
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM tax_credits WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tax credit not found' });
    }

    res.json({ message: 'Tax credit deleted successfully' });
  } catch (error) {
    console.error('Delete credit error:', error);
    res.status(500).json({ error: 'Failed to delete tax credit' });
  }
});

// Get available tax credits
router.get('/available/list', async (req, res) => {
  try {
    const credits = [
      { type: 'Child Tax Credit', maxAmount: 2000, refundable: true, description: 'Credit for qualifying children under 17' },
      { type: 'Earned Income Credit', maxAmount: 7430, refundable: true, description: 'Credit for low to moderate income workers' },
      { type: 'Child and Dependent Care', maxAmount: 3000, refundable: false, description: 'Credit for childcare expenses while working' },
      { type: 'American Opportunity Credit', maxAmount: 2500, refundable: true, description: 'Credit for first 4 years of higher education' },
      { type: 'Lifetime Learning Credit', maxAmount: 2000, refundable: false, description: 'Credit for any post-secondary education' },
      { type: 'Retirement Savings Credit', maxAmount: 1000, refundable: false, description: 'Credit for contributing to retirement accounts' },
      { type: 'Energy Efficient Home Credit', maxAmount: null, refundable: false, description: '30% of qualifying clean energy improvements' },
      { type: 'Electric Vehicle Credit', maxAmount: 7500, refundable: false, description: 'Credit for purchasing qualifying electric vehicles' },
      { type: 'Adoption Credit', maxAmount: 16810, refundable: false, description: 'Credit for qualified adoption expenses' },
      { type: 'Foreign Tax Credit', maxAmount: null, refundable: false, description: 'Credit for taxes paid to foreign countries' },
      { type: 'Premium Tax Credit', maxAmount: null, refundable: true, description: 'Credit for health insurance marketplace premiums' }
    ];

    res.json(credits);
  } catch (error) {
    console.error('Get available credits error:', error);
    res.status(500).json({ error: 'Failed to get available credits' });
  }
});

// Get credits summary
router.get('/tax-year/:taxYearId/summary', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         credit_type,
         SUM(amount) as total,
         BOOL_OR(is_refundable) as is_refundable
       FROM tax_credits c
       JOIN tax_years ty ON c.tax_year_id = ty.id
       WHERE c.tax_year_id = $1 AND ty.user_id = $2
       GROUP BY credit_type`,
      [req.params.taxYearId, req.user.id]
    );

    const refundableTotal = result.rows
      .filter(r => r.is_refundable)
      .reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);

    const nonRefundableTotal = result.rows
      .filter(r => !r.is_refundable)
      .reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);

    res.json({
      credits: result.rows.map(row => ({
        creditType: row.credit_type,
        total: parseFloat(row.total) || 0,
        isRefundable: row.is_refundable
      })),
      refundableTotal,
      nonRefundableTotal,
      grandTotal: refundableTotal + nonRefundableTotal
    });
  } catch (error) {
    console.error('Get credits summary error:', error);
    res.status(500).json({ error: 'Failed to get credits summary' });
  }
});

module.exports = router;
