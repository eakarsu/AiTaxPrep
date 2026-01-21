const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const stateTaxService = require('../services/stateTaxService');

router.use(authMiddleware);

// 2024 Tax Brackets (Single)
const TAX_BRACKETS_SINGLE = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 }
];

// 2024 Tax Brackets (Married Filing Jointly)
const TAX_BRACKETS_MARRIED = [
  { min: 0, max: 23200, rate: 0.10 },
  { min: 23200, max: 94300, rate: 0.12 },
  { min: 94300, max: 201050, rate: 0.22 },
  { min: 201050, max: 383900, rate: 0.24 },
  { min: 383900, max: 487450, rate: 0.32 },
  { min: 487450, max: 731200, rate: 0.35 },
  { min: 731200, max: Infinity, rate: 0.37 }
];

// Standard Deductions 2024
const STANDARD_DEDUCTIONS = {
  'single': 14600,
  'married_filing_jointly': 29200,
  'married_filing_separately': 14600,
  'head_of_household': 21900,
  'qualifying_widow': 29200
};

// Calculate federal tax based on taxable income and filing status
function calculateFederalTax(taxableIncome, filingStatus) {
  const brackets = (filingStatus === 'married_filing_jointly' || filingStatus === 'qualifying_widow')
    ? TAX_BRACKETS_MARRIED
    : TAX_BRACKETS_SINGLE;

  let tax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const taxableAtBracket = Math.min(remainingIncome, bracket.max - bracket.min);
    tax += taxableAtBracket * bracket.rate;
    remainingIncome -= taxableAtBracket;
  }

  return Math.round(tax * 100) / 100;
}

// Get tax calculation for a tax year
router.get('/tax-year/:taxYearId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tc.* FROM tax_calculations tc
       JOIN tax_years ty ON tc.tax_year_id = ty.id
       WHERE tc.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY tc.calculated_at DESC
       LIMIT 1`,
      [req.params.taxYearId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No calculation found. Run /calculate first.' });
    }

    const row = result.rows[0];
    const federalTax = parseFloat(row.federal_tax_liability) || 0;
    const seTax = parseFloat(row.self_employment_tax) || 0;
    const credits = parseFloat(row.total_credits) || 0;
    const totalTax = Math.max(0, federalTax + seTax - credits);
    const withheld = parseFloat(row.total_tax_withheld) || 0;
    const grossIncome = parseFloat(row.gross_income) || 0;
    const stdDed = parseFloat(row.standard_deduction) || 0;
    const itemDed = parseFloat(row.itemized_deduction) || 0;

    res.json({
      id: row.id,
      grossIncome: grossIncome,
      adjustedGrossIncome: parseFloat(row.adjusted_gross_income) || 0,
      taxableIncome: parseFloat(row.taxable_income) || 0,
      standardDeduction: stdDed,
      itemizedDeductions: itemDed,
      deductionUsed: itemDed > stdDed ? 'itemized' : 'standard',
      totalCredits: credits,
      federalTaxLiability: federalTax,
      stateTaxLiability: parseFloat(row.state_tax_liability) || 0,
      selfEmploymentTax: seTax,
      totalTaxWithheld: withheld,
      totalTax: totalTax,
      refund: withheld > totalTax ? Math.round((withheld - totalTax) * 100) / 100 : 0,
      amountOwed: totalTax > withheld ? Math.round((totalTax - withheld) * 100) / 100 : 0,
      effectiveTaxRate: grossIncome > 0 ? Math.round((totalTax / grossIncome) * 10000) / 100 : 0,
      calculatedAt: row.calculated_at
    });
  } catch (error) {
    console.error('Get calculation error:', error);
    res.status(500).json({ error: 'Failed to get tax calculation' });
  }
});

// Calculate taxes for a tax year
router.post('/tax-year/:taxYearId/calculate', async (req, res) => {
  try {
    const taxYearId = parseInt(req.params.taxYearId, 10);

    if (isNaN(taxYearId)) {
      return res.status(400).json({ error: 'Invalid tax year ID' });
    }

    // Verify tax year belongs to user
    const tyResult = await db.query(
      'SELECT * FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    // Get user's filing status
    const userResult = await db.query(
      'SELECT filing_status FROM users WHERE id = $1',
      [req.user.id]
    );
    const filingStatus = userResult.rows[0]?.filing_status || 'single';

    // Calculate gross income
    const incomeResult = await db.query(
      'SELECT SUM(wages) as wages, SUM(other_income) as other, SUM(federal_tax_withheld) as withheld FROM income_sources WHERE tax_year_id = $1',
      [taxYearId]
    );
    const wages = parseFloat(incomeResult.rows[0].wages) || 0;
    const otherIncome = parseFloat(incomeResult.rows[0].other) || 0;
    const totalWithheld = parseFloat(incomeResult.rows[0].withheld) || 0;
    const grossIncome = wages + otherIncome;

    // Calculate itemized deductions
    const deductionsResult = await db.query(
      'SELECT SUM(amount) as total FROM deductions WHERE tax_year_id = $1 AND is_itemized = true',
      [taxYearId]
    );
    const itemizedDeductions = parseFloat(deductionsResult.rows[0].total) || 0;

    // Get above-the-line deductions
    const aboveLineResult = await db.query(
      'SELECT SUM(amount) as total FROM deductions WHERE tax_year_id = $1 AND is_itemized = false',
      [taxYearId]
    );
    const aboveLineDeductions = parseFloat(aboveLineResult.rows[0].total) || 0;

    // Calculate AGI
    const adjustedGrossIncome = grossIncome - aboveLineDeductions;

    // Determine standard or itemized deduction
    const standardDeduction = STANDARD_DEDUCTIONS[filingStatus] || STANDARD_DEDUCTIONS.single;
    const deductionToUse = Math.max(standardDeduction, itemizedDeductions);

    // Calculate taxable income
    const taxableIncome = Math.max(0, adjustedGrossIncome - deductionToUse);

    // Calculate federal tax liability
    const federalTaxLiability = calculateFederalTax(taxableIncome, filingStatus);

    // Get tax credits
    const creditsResult = await db.query(
      'SELECT SUM(amount) as total FROM tax_credits WHERE tax_year_id = $1',
      [taxYearId]
    );
    const totalCredits = parseFloat(creditsResult.rows[0].total) || 0;

    // Calculate self-employment tax (if applicable)
    const seIncomeResult = await db.query(
      "SELECT SUM(other_income) as total FROM income_sources WHERE tax_year_id = $1 AND source_type IN ('1099-NEC', '1099-MISC')",
      [taxYearId]
    );
    const selfEmploymentIncome = parseFloat(seIncomeResult.rows[0].total) || 0;
    const selfEmploymentTax = selfEmploymentIncome > 0
      ? Math.round(selfEmploymentIncome * 0.9235 * 0.153 * 100) / 100
      : 0;

    // Save calculation
    const calcResult = await db.query(
      `INSERT INTO tax_calculations (
         user_id, tax_year_id, gross_income, adjusted_gross_income, taxable_income,
         standard_deduction, itemized_deduction, total_credits, federal_tax_liability,
         self_employment_tax, total_tax_withheld, calculated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (user_id, tax_year_id) DO UPDATE SET
         gross_income = $3, adjusted_gross_income = $4, taxable_income = $5,
         standard_deduction = $6, itemized_deduction = $7, total_credits = $8,
         federal_tax_liability = $9, self_employment_tax = $10, total_tax_withheld = $11,
         calculated_at = NOW()
       RETURNING *`,
      [
        req.user.id, taxYearId, grossIncome, adjustedGrossIncome, taxableIncome,
        standardDeduction, itemizedDeductions, totalCredits, federalTaxLiability,
        selfEmploymentTax, totalWithheld
      ]
    );

    // Calculate refund or amount owed
    const totalTax = Math.round((federalTaxLiability + selfEmploymentTax - totalCredits) * 100) / 100;
    const refundOrOwed = Math.round((totalWithheld - totalTax) * 100) / 100;

    // Update tax year with refund/owed
    const refundAmount = refundOrOwed > 0 ? refundOrOwed : 0;
    const owedAmount = refundOrOwed < 0 ? Math.abs(refundOrOwed) : 0;
    await db.query(
      `UPDATE tax_years SET
         federal_refund = $1,
         federal_owed = $2,
         updated_at = NOW()
       WHERE id = $3`,
      [refundAmount, owedAmount, taxYearId]
    );

    // Log calculation
    await db.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'CALCULATE', 'tax_calculation', calcResult.rows[0].id]
    );

    res.json({
      grossIncome: Math.round(grossIncome * 100) / 100,
      adjustedGrossIncome: Math.round(adjustedGrossIncome * 100) / 100,
      taxableIncome: Math.round(taxableIncome * 100) / 100,
      standardDeduction,
      itemizedDeductions: Math.round(itemizedDeductions * 100) / 100,
      deductionUsed: deductionToUse === standardDeduction ? 'standard' : 'itemized',
      totalCredits: Math.round(totalCredits * 100) / 100,
      federalTaxLiability: Math.round(federalTaxLiability * 100) / 100,
      selfEmploymentTax,
      totalTaxWithheld: Math.round(totalWithheld * 100) / 100,
      totalTax: Math.max(0, totalTax),
      refund: refundAmount,
      amountOwed: owedAmount,
      effectiveTaxRate: grossIncome > 0 ? Math.round((totalTax / grossIncome) * 10000) / 100 : 0
    });
  } catch (error) {
    console.error('Calculate taxes error:', error);
    res.status(500).json({ error: 'Failed to calculate taxes' });
  }
});

// Get tax brackets
router.get('/brackets', async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT filing_status FROM users WHERE id = $1',
      [req.user.id]
    );
    const filingStatus = userResult.rows[0]?.filing_status || 'single';

    const brackets = (filingStatus === 'married_filing_jointly' || filingStatus === 'qualifying_widow')
      ? TAX_BRACKETS_MARRIED
      : TAX_BRACKETS_SINGLE;

    res.json({
      filingStatus,
      standardDeduction: STANDARD_DEDUCTIONS[filingStatus],
      brackets: brackets.map(b => ({
        min: b.min,
        max: b.max === Infinity ? null : b.max,
        rate: b.rate,
        ratePercent: b.rate * 100
      }))
    });
  } catch (error) {
    console.error('Get brackets error:', error);
    res.status(500).json({ error: 'Failed to get tax brackets' });
  }
});

// Estimate quarterly payments
router.get('/tax-year/:taxYearId/quarterly-estimate', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tc.* FROM tax_calculations tc
       JOIN tax_years ty ON tc.tax_year_id = ty.id
       WHERE tc.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY tc.calculated_at DESC
       LIMIT 1`,
      [req.params.taxYearId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Run calculation first to get quarterly estimates' });
    }

    const calc = result.rows[0];
    const totalTax = parseFloat(calc.federal_tax_liability) + parseFloat(calc.self_employment_tax);
    const quarterlyPayment = Math.round(totalTax / 4 * 100) / 100;

    const currentYear = new Date().getFullYear();
    const quarters = [
      { quarter: 'Q1', dueDate: `April 15, ${currentYear}`, amount: quarterlyPayment },
      { quarter: 'Q2', dueDate: `June 15, ${currentYear}`, amount: quarterlyPayment },
      { quarter: 'Q3', dueDate: `September 15, ${currentYear}`, amount: quarterlyPayment },
      { quarter: 'Q4', dueDate: `January 15, ${currentYear + 1}`, amount: quarterlyPayment }
    ];

    res.json({
      annualEstimate: totalTax,
      quarterlyPayment,
      quarters
    });
  } catch (error) {
    console.error('Quarterly estimate error:', error);
    res.status(500).json({ error: 'Failed to get quarterly estimate' });
  }
});

// Get all states for dropdown
router.get('/states', async (req, res) => {
  try {
    const states = stateTaxService.getAllStates();
    res.json(states);
  } catch (error) {
    console.error('Get states error:', error);
    res.status(500).json({ error: 'Failed to get states' });
  }
});

// Get state tax info
router.get('/state/:stateCode', async (req, res) => {
  try {
    const stateInfo = stateTaxService.getStateInfo(req.params.stateCode);
    if (!stateInfo) {
      return res.status(404).json({ error: 'State not found' });
    }
    res.json(stateInfo);
  } catch (error) {
    console.error('Get state info error:', error);
    res.status(500).json({ error: 'Failed to get state info' });
  }
});

// Calculate state tax
router.post('/state-tax', async (req, res) => {
  try {
    const { stateCode, taxableIncome, filingStatus } = req.body;

    if (!stateCode || taxableIncome === undefined) {
      return res.status(400).json({ error: 'State code and taxable income are required' });
    }

    const result = stateTaxService.calculateStateTax(stateCode, taxableIncome, filingStatus);
    res.json(result);
  } catch (error) {
    console.error('Calculate state tax error:', error);
    res.status(500).json({ error: 'Failed to calculate state tax' });
  }
});

// Calculate state tax for a tax year
router.post('/tax-year/:taxYearId/state-tax', async (req, res) => {
  try {
    const { stateCode } = req.body;

    if (!stateCode) {
      return res.status(400).json({ error: 'State code is required' });
    }

    // Get the tax calculation for this year
    const calcResult = await db.query(
      `SELECT tc.* FROM tax_calculations tc
       JOIN tax_years ty ON tc.tax_year_id = ty.id
       WHERE tc.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY tc.calculated_at DESC
       LIMIT 1`,
      [req.params.taxYearId, req.user.id]
    );

    if (calcResult.rows.length === 0) {
      return res.status(400).json({ error: 'Please calculate federal taxes first' });
    }

    const calc = calcResult.rows[0];
    const taxableIncome = parseFloat(calc.taxable_income) || 0;

    // Get filing status
    const userResult = await db.query('SELECT filing_status FROM users WHERE id = $1', [req.user.id]);
    const filingStatus = userResult.rows[0]?.filing_status || 'single';

    // Calculate state tax
    const stateTax = stateTaxService.calculateStateTax(stateCode, taxableIncome, filingStatus);

    // Update tax calculation with state tax
    await db.query(
      `UPDATE tax_calculations SET state_tax_liability = $1, updated_at = NOW()
       WHERE id = $2`,
      [stateTax.taxLiability, calc.id]
    );

    // Update tax year state amounts
    const stateWithheld = await db.query(
      'SELECT SUM(state_tax_withheld) as total FROM income_sources WHERE tax_year_id = $1',
      [req.params.taxYearId]
    );
    const totalStateWithheld = parseFloat(stateWithheld.rows[0]?.total) || 0;
    const stateRefundOrOwed = totalStateWithheld - stateTax.taxLiability;

    await db.query(
      `UPDATE tax_years SET
         state_refund = CASE WHEN $1 > 0 THEN $1 ELSE 0 END,
         state_owed = CASE WHEN $1 < 0 THEN ABS($1) ELSE 0 END,
         updated_at = NOW()
       WHERE id = $2`,
      [stateRefundOrOwed, req.params.taxYearId]
    );

    res.json({
      ...stateTax,
      stateWithheld: totalStateWithheld,
      stateRefund: stateRefundOrOwed > 0 ? stateRefundOrOwed : 0,
      stateOwed: stateRefundOrOwed < 0 ? Math.abs(stateRefundOrOwed) : 0
    });
  } catch (error) {
    console.error('Calculate state tax error:', error);
    res.status(500).json({ error: 'Failed to calculate state tax' });
  }
});

// Compare taxes across states
router.post('/compare-states', async (req, res) => {
  try {
    const { taxableIncome, states } = req.body;

    if (!taxableIncome) {
      return res.status(400).json({ error: 'Taxable income is required' });
    }

    const comparison = stateTaxService.compareStateTaxes(taxableIncome, states);
    res.json({
      taxableIncome,
      comparison,
      noTaxStates: stateTaxService.getNoIncomeTaxStates()
    });
  } catch (error) {
    console.error('Compare states error:', error);
    res.status(500).json({ error: 'Failed to compare state taxes' });
  }
});

// Get states with no income tax
router.get('/no-tax-states', async (req, res) => {
  try {
    const states = stateTaxService.getNoIncomeTaxStates();
    res.json(states);
  } catch (error) {
    console.error('Get no-tax states error:', error);
    res.status(500).json({ error: 'Failed to get states' });
  }
});

module.exports = router;
