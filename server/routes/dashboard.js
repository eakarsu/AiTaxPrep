const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get dashboard overview
router.get('/overview', async (req, res) => {
  try {
    // Get current tax year (most recent)
    const tyResult = await db.query(
      'SELECT * FROM tax_years WHERE user_id = $1 ORDER BY year DESC LIMIT 1',
      [req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.json({
        message: 'No tax year found',
        hasTaxYear: false
      });
    }

    const taxYear = tyResult.rows[0];
    const taxYearId = taxYear.id;

    // Get income summary
    const incomeResult = await db.query(
      `SELECT
         COUNT(*) as sources,
         SUM(wages + other_income) as total_income,
         SUM(federal_tax_withheld) as withheld
       FROM income_sources WHERE tax_year_id = $1`,
      [taxYearId]
    );

    // Get deductions summary
    const deductionsResult = await db.query(
      `SELECT COUNT(*) as count, SUM(amount) as total
       FROM deductions WHERE tax_year_id = $1`,
      [taxYearId]
    );

    // Get credits summary
    const creditsResult = await db.query(
      `SELECT COUNT(*) as count, SUM(amount) as total
       FROM tax_credits WHERE tax_year_id = $1`,
      [taxYearId]
    );

    // Get documents count
    const docsResult = await db.query(
      'SELECT COUNT(*) as count FROM documents WHERE tax_year_id = $1',
      [taxYearId]
    );

    // Get dependents count
    const depsResult = await db.query(
      'SELECT COUNT(*) as count FROM dependents WHERE tax_year_id = $1',
      [taxYearId]
    );

    // Get calculation
    const calcResult = await db.query(
      'SELECT * FROM tax_calculations WHERE tax_year_id = $1 ORDER BY calculated_at DESC LIMIT 1',
      [taxYearId]
    );

    // Get unread advice count
    const adviceResult = await db.query(
      'SELECT COUNT(*) as unread FROM ai_tax_advice WHERE tax_year_id = $1 AND is_read = false',
      [taxYearId]
    );

    const income = incomeResult.rows[0];
    const deductions = deductionsResult.rows[0];
    const credits = creditsResult.rows[0];
    const calc = calcResult.rows[0];

    res.json({
      hasTaxYear: true,
      taxYear: {
        id: taxYear.id,
        year: taxYear.year,
        status: taxYear.status,
        federalRefund: parseFloat(taxYear.federal_refund) || 0,
        federalOwed: parseFloat(taxYear.federal_owed) || 0
      },
      income: {
        sources: parseInt(income.sources) || 0,
        totalIncome: parseFloat(income.total_income) || 0,
        withheld: parseFloat(income.withheld) || 0
      },
      deductions: {
        count: parseInt(deductions.count) || 0,
        total: parseFloat(deductions.total) || 0
      },
      credits: {
        count: parseInt(credits.count) || 0,
        total: parseFloat(credits.total) || 0
      },
      documents: parseInt(docsResult.rows[0].count) || 0,
      dependents: parseInt(depsResult.rows[0].count) || 0,
      calculation: calc ? {
        grossIncome: parseFloat(calc.gross_income) || 0,
        taxableIncome: parseFloat(calc.taxable_income) || 0,
        federalTaxLiability: parseFloat(calc.federal_tax_liability) || 0,
        totalWithheld: parseFloat(calc.total_tax_withheld) || 0,
        calculatedAt: calc.calculated_at
      } : null,
      unreadAdvice: parseInt(adviceResult.rows[0].unread) || 0
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to get dashboard overview' });
  }
});

// Get completion checklist
router.get('/checklist', async (req, res) => {
  try {
    const tyResult = await db.query(
      'SELECT id FROM tax_years WHERE user_id = $1 ORDER BY year DESC LIMIT 1',
      [req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.json({ checklist: [], completionPercentage: 0 });
    }

    const taxYearId = tyResult.rows[0].id;

    // Check various completion items
    const checks = await Promise.all([
      db.query('SELECT COUNT(*) > 0 as done FROM income_sources WHERE tax_year_id = $1', [taxYearId]),
      db.query('SELECT filing_status IS NOT NULL as done FROM users WHERE id = $1', [req.user.id]),
      db.query('SELECT COUNT(*) > 0 as done FROM deductions WHERE tax_year_id = $1', [taxYearId]),
      db.query('SELECT COUNT(*) > 0 as done FROM documents WHERE tax_year_id = $1', [taxYearId]),
      db.query('SELECT COUNT(*) > 0 as done FROM tax_calculations WHERE tax_year_id = $1', [taxYearId]),
      db.query("SELECT address_street IS NOT NULL AND address_city IS NOT NULL as done FROM users WHERE id = $1", [req.user.id])
    ]);

    const checklist = [
      { item: 'Add income sources (W-2, 1099)', completed: checks[0].rows[0].done, required: true },
      { item: 'Select filing status', completed: checks[1].rows[0].done, required: true },
      { item: 'Add deductions', completed: checks[2].rows[0].done, required: false },
      { item: 'Upload tax documents', completed: checks[3].rows[0].done, required: false },
      { item: 'Calculate taxes', completed: checks[4].rows[0].done, required: true },
      { item: 'Complete address information', completed: checks[5].rows[0].done, required: true }
    ];

    const completedCount = checklist.filter(c => c.completed).length;
    const completionPercentage = Math.round((completedCount / checklist.length) * 100);

    res.json({
      checklist,
      completedCount,
      totalCount: checklist.length,
      completionPercentage
    });
  } catch (error) {
    console.error('Checklist error:', error);
    res.status(500).json({ error: 'Failed to get checklist' });
  }
});

// Get recent activity
router.get('/activity', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT action, entity_type, entity_id, created_at
       FROM audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    const activities = result.rows.map(row => {
      let description = '';
      switch (row.action) {
        case 'LOGIN': description = 'Logged into account'; break;
        case 'REGISTER': description = 'Created account'; break;
        case 'CREATE': description = `Added new ${row.entity_type.replace('_', ' ')}`; break;
        case 'UPDATE': description = `Updated ${row.entity_type.replace('_', ' ')}`; break;
        case 'DELETE': description = `Deleted ${row.entity_type.replace('_', ' ')}`; break;
        case 'UPLOAD': description = 'Uploaded document'; break;
        case 'CALCULATE': description = 'Calculated taxes'; break;
        case 'SUBMIT': description = 'Submitted tax return'; break;
        default: description = row.action;
      }

      return {
        action: row.action,
        entityType: row.entity_type,
        description,
        timestamp: row.created_at
      };
    });

    res.json(activities);
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

// Get tax comparison (year over year)
router.get('/comparison', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         ty.year,
         tc.gross_income,
         tc.taxable_income,
         tc.federal_tax_liability,
         tc.total_tax_withheld,
         ty.federal_refund,
         ty.federal_owed
       FROM tax_years ty
       LEFT JOIN tax_calculations tc ON ty.id = tc.tax_year_id
       WHERE ty.user_id = $1
       ORDER BY ty.year DESC
       LIMIT 3`,
      [req.user.id]
    );

    res.json(result.rows.map(row => ({
      year: row.year,
      grossIncome: parseFloat(row.gross_income) || 0,
      taxableIncome: parseFloat(row.taxable_income) || 0,
      federalTaxLiability: parseFloat(row.federal_tax_liability) || 0,
      totalWithheld: parseFloat(row.total_tax_withheld) || 0,
      refund: parseFloat(row.federal_refund) || 0,
      owed: parseFloat(row.federal_owed) || 0
    })));
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Failed to get comparison' });
  }
});

// Get important deadlines
router.get('/deadlines', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const deadlines = [
      { date: `${currentYear}-01-15`, description: 'Q4 estimated tax payment due', type: 'estimated' },
      { date: `${currentYear}-01-31`, description: 'W-2 and 1099 forms due from employers', type: 'forms' },
      { date: `${currentYear}-04-15`, description: 'Tax filing deadline / Q1 estimated payment', type: 'filing' },
      { date: `${currentYear}-04-15`, description: 'IRA contribution deadline for prior year', type: 'retirement' },
      { date: `${currentYear}-06-15`, description: 'Q2 estimated tax payment due', type: 'estimated' },
      { date: `${currentYear}-09-15`, description: 'Q3 estimated tax payment due', type: 'estimated' },
      { date: `${currentYear}-10-15`, description: 'Extended tax filing deadline', type: 'filing' }
    ];

    const today = new Date();
    const upcoming = deadlines
      .filter(d => new Date(d.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      deadlines: upcoming,
      nextDeadline: upcoming[0] || null
    });
  } catch (error) {
    console.error('Deadlines error:', error);
    res.status(500).json({ error: 'Failed to get deadlines' });
  }
});

module.exports = router;
