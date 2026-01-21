const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all forms for a tax year
router.get('/tax-year/:taxYearId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT f.* FROM tax_forms f
       JOIN tax_years ty ON f.tax_year_id = ty.id
       WHERE f.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY f.form_type`,
      [req.params.taxYearId, req.user.id]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      formType: row.form_type,
      status: row.status,
      formData: row.form_data,
      generatedAt: row.generated_at,
      submittedAt: row.submitted_at,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Get forms error:', error);
    res.status(500).json({ error: 'Failed to get tax forms' });
  }
});

// Get single form
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT f.* FROM tax_forms f
       JOIN tax_years ty ON f.tax_year_id = ty.id
       WHERE f.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      taxYearId: row.tax_year_id,
      formType: row.form_type,
      status: row.status,
      formData: row.form_data,
      generatedAt: row.generated_at,
      submittedAt: row.submitted_at
    });
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ error: 'Failed to get form' });
  }
});

// Generate Form 1040
router.post('/tax-year/:taxYearId/generate-1040', async (req, res) => {
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

    // Get user info
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    // Get calculation
    const calcResult = await db.query(
      'SELECT * FROM tax_calculations WHERE tax_year_id = $1 ORDER BY calculated_at DESC LIMIT 1',
      [taxYearId]
    );

    if (calcResult.rows.length === 0) {
      return res.status(400).json({ error: 'Please run tax calculation first' });
    }

    const calc = calcResult.rows[0];

    // Get income sources
    const incomeResult = await db.query(
      'SELECT * FROM income_sources WHERE tax_year_id = $1',
      [taxYearId]
    );

    // Get dependents
    const depsResult = await db.query(
      'SELECT * FROM dependents WHERE tax_year_id = $1',
      [taxYearId]
    );

    // Build Form 1040 data
    const formData = {
      // Personal Information
      firstName: user.first_name,
      lastName: user.last_name,
      ssn: '***-**-****', // Masked
      address: {
        street: user.address_street,
        city: user.address_city,
        state: user.address_state,
        zip: user.address_zip
      },
      filingStatus: user.filing_status,

      // Dependents
      dependents: depsResult.rows.map(d => ({
        firstName: d.first_name,
        lastName: d.last_name,
        ssn: '***-**-****',
        relationship: d.relationship
      })),

      // Income
      line1: { description: 'Wages, salaries, tips', amount: parseFloat(calc.gross_income) || 0 },
      line2a: { description: 'Tax-exempt interest', amount: 0 },
      line2b: { description: 'Taxable interest', amount: 0 },
      line3a: { description: 'Qualified dividends', amount: 0 },
      line3b: { description: 'Ordinary dividends', amount: 0 },

      // Income totals
      line9: { description: 'Total income', amount: parseFloat(calc.gross_income) || 0 },
      line11: { description: 'Adjusted gross income', amount: parseFloat(calc.adjusted_gross_income) || 0 },

      // Deductions
      line12: {
        description: 'Standard deduction or itemized deductions',
        amount: Math.max(parseFloat(calc.standard_deduction) || 0, parseFloat(calc.itemized_deduction) || 0)
      },

      // Taxable income
      line15: { description: 'Taxable income', amount: parseFloat(calc.taxable_income) || 0 },

      // Tax and credits
      line16: { description: 'Tax', amount: parseFloat(calc.federal_tax_liability) || 0 },
      line19: { description: 'Total tax credits', amount: parseFloat(calc.total_credits) || 0 },

      // Payments
      line25a: { description: 'Federal tax withheld from W-2', amount: parseFloat(calc.total_tax_withheld) || 0 },

      // Refund or amount owed
      line34: {
        description: 'Refund',
        amount: Math.max(0, parseFloat(calc.total_tax_withheld) - parseFloat(calc.federal_tax_liability) + parseFloat(calc.total_credits))
      },
      line37: {
        description: 'Amount you owe',
        amount: Math.max(0, parseFloat(calc.federal_tax_liability) - parseFloat(calc.total_credits) - parseFloat(calc.total_tax_withheld))
      },

      // W-2 summary
      w2Summary: incomeResult.rows
        .filter(i => i.source_type === 'W-2')
        .map(i => ({
          employer: i.employer_name,
          ein: i.employer_ein,
          wages: parseFloat(i.wages) || 0,
          federalWithheld: parseFloat(i.federal_tax_withheld) || 0
        })),

      generatedDate: new Date().toISOString(),
      taxYear: tyResult.rows[0].year
    };

    // Save or update form
    const existingForm = await db.query(
      "SELECT id FROM tax_forms WHERE tax_year_id = $1 AND user_id = $2 AND form_type = '1040'",
      [taxYearId, req.user.id]
    );

    let formId;
    if (existingForm.rows.length > 0) {
      formId = existingForm.rows[0].id;
      await db.query(
        `UPDATE tax_forms SET
           form_data = $1, status = 'draft', generated_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(formData), formId]
      );
    } else {
      const insertResult = await db.query(
        `INSERT INTO tax_forms (user_id, tax_year_id, form_type, form_data, status, generated_at)
         VALUES ($1, $2, '1040', $3, 'draft', NOW())
         RETURNING id`,
        [req.user.id, taxYearId, JSON.stringify(formData)]
      );
      formId = insertResult.rows[0].id;
    }

    res.json({
      message: 'Form 1040 generated successfully',
      formId,
      formData
    });
  } catch (error) {
    console.error('Generate 1040 error:', error);
    res.status(500).json({ error: 'Failed to generate Form 1040' });
  }
});

// Update form status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'completed', 'submitted', 'accepted', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      `UPDATE tax_forms SET
         status = $1,
         submitted_at = CASE WHEN $1 = 'submitted' THEN NOW() ELSE submitted_at END,
         updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Log submission
    if (status === 'submitted') {
      await db.query(
        'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [req.user.id, 'SUBMIT', 'tax_form', req.params.id]
      );
    }

    res.json({
      message: 'Form status updated',
      status: result.rows[0].status
    });
  } catch (error) {
    console.error('Update form status error:', error);
    res.status(500).json({ error: 'Failed to update form status' });
  }
});

// Get available form types
router.get('/types/list', async (req, res) => {
  try {
    const formTypes = [
      { type: '1040', name: 'Form 1040', description: 'U.S. Individual Income Tax Return' },
      { type: 'Schedule A', name: 'Schedule A', description: 'Itemized Deductions' },
      { type: 'Schedule B', name: 'Schedule B', description: 'Interest and Ordinary Dividends' },
      { type: 'Schedule C', name: 'Schedule C', description: 'Profit or Loss From Business' },
      { type: 'Schedule D', name: 'Schedule D', description: 'Capital Gains and Losses' },
      { type: 'Schedule E', name: 'Schedule E', description: 'Supplemental Income and Loss' },
      { type: 'Schedule SE', name: 'Schedule SE', description: 'Self-Employment Tax' },
      { type: '8863', name: 'Form 8863', description: 'Education Credits' },
      { type: '8880', name: 'Form 8880', description: 'Credit for Qualified Retirement Savings' },
      { type: '8889', name: 'Form 8889', description: 'Health Savings Accounts' }
    ];

    res.json(formTypes);
  } catch (error) {
    console.error('Get form types error:', error);
    res.status(500).json({ error: 'Failed to get form types' });
  }
});

// Delete form
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM tax_forms WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

module.exports = router;
