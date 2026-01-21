const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all advice for a tax year
router.get('/tax-year/:taxYearId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.* FROM ai_tax_advice a
       JOIN tax_years ty ON a.tax_year_id = ty.id
       WHERE a.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY
         CASE a.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         a.potential_savings DESC`,
      [req.params.taxYearId, req.user.id]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      adviceType: row.advice_type,
      title: row.title,
      adviceText: row.advice_text,
      potentialSavings: parseFloat(row.potential_savings) || 0,
      priority: row.priority,
      isRead: row.is_read,
      isApplied: row.is_applied,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Get advice error:', error);
    res.status(500).json({ error: 'Failed to get tax advice' });
  }
});

// Get single advice
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.* FROM ai_tax_advice a
       JOIN tax_years ty ON a.tax_year_id = ty.id
       WHERE a.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Advice not found' });
    }

    // Mark as read
    await db.query(
      'UPDATE ai_tax_advice SET is_read = true WHERE id = $1',
      [req.params.id]
    );

    const row = result.rows[0];
    res.json({
      id: row.id,
      taxYearId: row.tax_year_id,
      adviceType: row.advice_type,
      title: row.title,
      adviceText: row.advice_text,
      potentialSavings: parseFloat(row.potential_savings) || 0,
      priority: row.priority,
      isRead: true,
      isApplied: row.is_applied
    });
  } catch (error) {
    console.error('Get advice error:', error);
    res.status(500).json({ error: 'Failed to get advice' });
  }
});

// Mark advice as applied
router.put('/:id/apply', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE ai_tax_advice SET is_applied = true, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Advice not found' });
    }

    res.json({ message: 'Advice marked as applied' });
  } catch (error) {
    console.error('Apply advice error:', error);
    res.status(500).json({ error: 'Failed to apply advice' });
  }
});

// Generate AI advice for a tax year
router.post('/tax-year/:taxYearId/generate', async (req, res) => {
  try {
    const taxYearId = req.params.taxYearId;

    // Verify tax year belongs to user
    const tyResult = await db.query(
      'SELECT * FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    // Get user data for analysis
    const userData = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userData.rows[0];

    // Get calculation data
    const calcData = await db.query(
      'SELECT * FROM tax_calculations WHERE tax_year_id = $1 ORDER BY calculated_at DESC LIMIT 1',
      [taxYearId]
    );

    // Get income data
    const incomeData = await db.query(
      'SELECT * FROM income_sources WHERE tax_year_id = $1',
      [taxYearId]
    );

    // Get deductions data
    const deductionData = await db.query(
      'SELECT * FROM deductions WHERE tax_year_id = $1',
      [taxYearId]
    );

    // Get dependents
    const dependentData = await db.query(
      'SELECT * FROM dependents WHERE tax_year_id = $1',
      [taxYearId]
    );

    // Generate advice based on analysis
    const advice = [];
    const calc = calcData.rows[0] || {};
    const grossIncome = parseFloat(calc.gross_income) || 0;
    const itemizedDeductions = parseFloat(calc.itemized_deduction) || 0;
    const standardDeduction = parseFloat(calc.standard_deduction) || 0;

    // Retirement savings advice
    if (grossIncome > 50000) {
      advice.push({
        advice_type: 'retirement',
        title: 'Maximize Retirement Contributions',
        advice_text: `Based on your income of $${grossIncome.toLocaleString()}, you could benefit from maximizing your retirement contributions. For 2024, you can contribute up to $23,000 to a 401(k) or $7,000 to an IRA ($8,000 if over 50). Each dollar contributed reduces your taxable income.`,
        potential_savings: Math.min(grossIncome * 0.05, 1500),
        priority: 'high'
      });
    }

    // Standard vs itemized advice
    if (itemizedDeductions > 0 && itemizedDeductions < standardDeduction * 0.9) {
      advice.push({
        advice_type: 'deduction',
        title: 'Consider Standard Deduction',
        advice_text: `Your itemized deductions ($${itemizedDeductions.toLocaleString()}) are less than the standard deduction ($${standardDeduction.toLocaleString()}). You may benefit more from taking the standard deduction.`,
        potential_savings: standardDeduction - itemizedDeductions,
        priority: 'medium'
      });
    }

    // Dependent care advice
    const youngDependents = dependentData.rows.filter(d => {
      const age = new Date().getFullYear() - new Date(d.date_of_birth).getFullYear();
      return age < 13;
    });
    if (youngDependents.length > 0) {
      advice.push({
        advice_type: 'dependent',
        title: 'Dependent Care FSA Opportunity',
        advice_text: `With ${youngDependents.length} qualifying dependent(s) under 13, consider using a Dependent Care FSA. You can set aside up to $5,000 pre-tax for childcare expenses, saving approximately $1,100 in taxes.`,
        potential_savings: 1100,
        priority: 'high'
      });
    }

    // Self-employment advice
    const has1099 = incomeData.rows.some(i => i.source_type.includes('1099'));
    if (has1099) {
      advice.push({
        advice_type: 'business',
        title: 'Self-Employment Tax Deduction',
        advice_text: 'As a self-employed individual, you can deduct half of your self-employment tax as an adjustment to income. Also consider setting up a SEP-IRA or Solo 401(k) for additional retirement savings with higher contribution limits.',
        potential_savings: 2000,
        priority: 'high'
      });
    }

    // HSA advice
    if (grossIncome > 40000 && grossIncome < 150000) {
      advice.push({
        advice_type: 'health',
        title: 'Health Savings Account Benefits',
        advice_text: 'If you have a high-deductible health plan, contributing to an HSA provides triple tax benefits: tax-deductible contributions, tax-free growth, and tax-free withdrawals for medical expenses. The 2024 limit is $4,150 for individuals or $8,300 for families.',
        potential_savings: 900,
        priority: 'medium'
      });
    }

    // Charitable giving advice
    const charitableDeductions = deductionData.rows.filter(d =>
      d.category.toLowerCase().includes('charit')
    );
    if (charitableDeductions.length === 0 && grossIncome > 75000) {
      advice.push({
        advice_type: 'charitable',
        title: 'Charitable Giving Strategies',
        advice_text: 'Consider charitable giving for tax benefits. You can deduct cash donations up to 60% of AGI when itemizing. For appreciated securities, donating stocks held over a year avoids capital gains tax while providing a deduction.',
        potential_savings: 500,
        priority: 'low'
      });
    }

    // Clear old advice and insert new
    await db.query('DELETE FROM ai_tax_advice WHERE tax_year_id = $1 AND user_id = $2', [taxYearId, req.user.id]);

    for (const adv of advice) {
      await db.query(
        `INSERT INTO ai_tax_advice (user_id, tax_year_id, advice_type, title, advice_text, potential_savings, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.user.id, taxYearId, adv.advice_type, adv.title, adv.advice_text, adv.potential_savings, adv.priority]
      );
    }

    const totalSavings = advice.reduce((sum, a) => sum + a.potential_savings, 0);

    res.json({
      message: 'Tax advice generated successfully',
      adviceCount: advice.length,
      totalPotentialSavings: totalSavings,
      advice: advice.map(a => ({
        adviceType: a.advice_type,
        title: a.title,
        potentialSavings: a.potential_savings,
        priority: a.priority
      }))
    });
  } catch (error) {
    console.error('Generate advice error:', error);
    res.status(500).json({ error: 'Failed to generate tax advice' });
  }
});

// Get advice summary
router.get('/tax-year/:taxYearId/summary', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE is_read = false) as unread,
         COUNT(*) FILTER (WHERE is_applied = true) as applied,
         COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
         SUM(potential_savings) as total_savings,
         SUM(potential_savings) FILTER (WHERE is_applied = true) as realized_savings
       FROM ai_tax_advice a
       JOIN tax_years ty ON a.tax_year_id = ty.id
       WHERE a.tax_year_id = $1 AND ty.user_id = $2`,
      [req.params.taxYearId, req.user.id]
    );

    const row = result.rows[0];
    res.json({
      total: parseInt(row.total) || 0,
      unread: parseInt(row.unread) || 0,
      applied: parseInt(row.applied) || 0,
      highPriority: parseInt(row.high_priority) || 0,
      totalPotentialSavings: parseFloat(row.total_savings) || 0,
      realizedSavings: parseFloat(row.realized_savings) || 0
    });
  } catch (error) {
    console.error('Get advice summary error:', error);
    res.status(500).json({ error: 'Failed to get advice summary' });
  }
});

module.exports = router;
