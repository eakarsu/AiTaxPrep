const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all expense categories
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM expense_categories ORDER BY name'
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isDeductible: row.is_deductible,
      deductionLimit: row.deduction_limit ? parseFloat(row.deduction_limit) : null,
      requiresReceipt: row.requires_receipt
    })));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get expense categories' });
  }
});

// Get all expenses for a tax year
router.get('/tax-year/:taxYearId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, ec.name as category_name, ec.is_deductible
       FROM user_expenses e
       JOIN tax_years ty ON e.tax_year_id = ty.id
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY e.expense_date DESC`,
      [req.params.taxYearId, req.user.id]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      description: row.description,
      amount: parseFloat(row.amount) || 0,
      expenseDate: row.expense_date,
      vendor: row.vendor,
      receiptPath: row.receipt_path,
      isBusinessExpense: row.is_business_expense,
      isDeductible: row.is_deductible,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to get expenses' });
  }
});

// Get single expense
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, ec.name as category_name
       FROM user_expenses e
       JOIN tax_years ty ON e.tax_year_id = ty.id
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      taxYearId: row.tax_year_id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      description: row.description,
      amount: parseFloat(row.amount) || 0,
      expenseDate: row.expense_date,
      vendor: row.vendor,
      receiptPath: row.receipt_path,
      isBusinessExpense: row.is_business_expense
    });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to get expense' });
  }
});

// Create expense
router.post('/', async (req, res) => {
  try {
    const {
      taxYearId, categoryId, description, amount,
      expenseDate, vendor, receiptPath, isBusinessExpense
    } = req.body;

    // Verify tax year belongs to user
    const tyResult = await db.query(
      'SELECT id FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const result = await db.query(
      `INSERT INTO user_expenses (
         user_id, tax_year_id, category_id, description, amount,
         expense_date, vendor, receipt_path, is_business_expense
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.id, taxYearId, categoryId, description, amount,
        expenseDate, vendor, receiptPath, isBusinessExpense || false
      ]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      description: row.description,
      amount: parseFloat(row.amount) || 0,
      expenseDate: row.expense_date,
      vendor: row.vendor
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
router.put('/:id', async (req, res) => {
  try {
    const {
      categoryId, description, amount, expenseDate,
      vendor, receiptPath, isBusinessExpense
    } = req.body;

    const result = await db.query(
      `UPDATE user_expenses SET
         category_id = COALESCE($1, category_id),
         description = COALESCE($2, description),
         amount = COALESCE($3, amount),
         expense_date = COALESCE($4, expense_date),
         vendor = COALESCE($5, vendor),
         receipt_path = COALESCE($6, receipt_path),
         is_business_expense = COALESCE($7, is_business_expense),
         updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [categoryId, description, amount, expenseDate, vendor, receiptPath, isBusinessExpense, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense updated successfully' });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM user_expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Get expense summary by category
router.get('/tax-year/:taxYearId/summary', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         ec.name as category,
         ec.is_deductible,
         ec.deduction_limit,
         COUNT(*) as count,
         SUM(e.amount) as total
       FROM user_expenses e
       JOIN tax_years ty ON e.tax_year_id = ty.id
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.tax_year_id = $1 AND ty.user_id = $2
       GROUP BY ec.id, ec.name, ec.is_deductible, ec.deduction_limit
       ORDER BY total DESC`,
      [req.params.taxYearId, req.user.id]
    );

    const summary = result.rows.map(row => ({
      category: row.category || 'Uncategorized',
      count: parseInt(row.count),
      total: parseFloat(row.total) || 0,
      isDeductible: row.is_deductible,
      deductionLimit: row.deduction_limit ? parseFloat(row.deduction_limit) : null
    }));

    const deductibleTotal = summary
      .filter(s => s.isDeductible)
      .reduce((sum, s) => sum + s.total, 0);

    res.json({
      byCategory: summary,
      totalExpenses: summary.reduce((sum, s) => sum + s.total, 0),
      deductibleTotal,
      nonDeductibleTotal: summary.reduce((sum, s) => sum + s.total, 0) - deductibleTotal
    });
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({ error: 'Failed to get expense summary' });
  }
});

// Get monthly expense breakdown
router.get('/tax-year/:taxYearId/monthly', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         EXTRACT(MONTH FROM expense_date) as month,
         COUNT(*) as count,
         SUM(amount) as total
       FROM user_expenses e
       JOIN tax_years ty ON e.tax_year_id = ty.id
       WHERE e.tax_year_id = $1 AND ty.user_id = $2
       GROUP BY EXTRACT(MONTH FROM expense_date)
       ORDER BY month`,
      [req.params.taxYearId, req.user.id]
    );

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    res.json(result.rows.map(row => ({
      month: months[parseInt(row.month) - 1],
      monthNumber: parseInt(row.month),
      count: parseInt(row.count),
      total: parseFloat(row.total) || 0
    })));
  } catch (error) {
    console.error('Get monthly expenses error:', error);
    res.status(500).json({ error: 'Failed to get monthly expenses' });
  }
});

module.exports = router;
