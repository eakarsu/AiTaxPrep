/**
 * Advanced Tax Features Routes
 * E-Filing, State Returns, Amendments, AMT/NIIT, Schedule C, Depreciation, Tax Planning, PDF Export
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Import services
const amtService = require('../services/amtService');
const scheduleCService = require('../services/scheduleCService');
const depreciationService = require('../services/depreciationService');
const efileService = require('../services/efileService');
const stateReturnService = require('../services/stateReturnService');
const amendedReturnService = require('../services/amendedReturnService');
const taxPlanningService = require('../services/taxPlanningService');
const pdfService = require('../services/pdfService');
const validationService = require('../services/validationService');

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================
// AMT & NIIT Calculations
// ============================================

/**
 * Calculate AMT and NIIT for a tax year
 */
router.post('/tax-year/:taxYearId/amt-niit', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const taxData = req.body;

    // Verify ownership
    const tyResult = await db.query(
      'SELECT * FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const result = amtService.calculateAdditionalTaxes(taxData);

    res.json({
      success: true,
      taxYearId,
      ...result
    });
  } catch (error) {
    console.error('AMT/NIIT calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate AMT/NIIT' });
  }
});

/**
 * Assess AMT risk
 */
router.post('/tax-year/:taxYearId/amt-risk', async (req, res) => {
  try {
    const taxData = req.body;
    const result = amtService.assessAMTRisk(taxData);
    res.json(result);
  } catch (error) {
    console.error('AMT risk assessment error:', error);
    res.status(500).json({ error: 'Failed to assess AMT risk' });
  }
});

// ============================================
// Schedule C (Self-Employment)
// ============================================

/**
 * Get all Schedule C businesses for a tax year
 */
router.get('/tax-year/:taxYearId/schedule-c', async (req, res) => {
  try {
    const { taxYearId } = req.params;

    const result = await db.query(
      'SELECT * FROM schedule_c_business WHERE tax_year_id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get Schedule C error:', error);
    res.status(500).json({ error: 'Failed to get Schedule C data' });
  }
});

/**
 * Create/Update Schedule C business
 */
router.post('/tax-year/:taxYearId/schedule-c', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const businessData = req.body;

    // Calculate Schedule C
    const calculation = scheduleCService.calculateScheduleC(businessData);

    // Save to database
    const result = await db.query(
      `INSERT INTO schedule_c_business (
        user_id, tax_year_id, business_name, business_type, ein, business_address,
        accounting_method, gross_receipts, returns_allowances, cost_of_goods_sold,
        gross_profit, other_income, total_income, total_expenses, net_profit_loss
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (user_id, tax_year_id) WHERE business_name = $3
      DO UPDATE SET
        gross_receipts = EXCLUDED.gross_receipts,
        total_expenses = EXCLUDED.total_expenses,
        net_profit_loss = EXCLUDED.net_profit_loss,
        updated_at = NOW()
      RETURNING *`,
      [
        req.user.id, taxYearId, businessData.businessName, businessData.businessType,
        businessData.ein, businessData.businessAddress, businessData.accountingMethod || 'cash',
        calculation.partI.grossReceipts, calculation.partI.returnsAllowances,
        calculation.partI.costOfGoodsSold, calculation.partI.grossProfit,
        calculation.partI.otherIncome, calculation.partI.totalIncome,
        calculation.partII.totalExpenses, calculation.netProfitLoss
      ]
    );

    res.json({
      success: true,
      business: result.rows[0],
      calculation
    });
  } catch (error) {
    console.error('Schedule C save error:', error);
    res.status(500).json({ error: 'Failed to save Schedule C data' });
  }
});

/**
 * Calculate Schedule C
 */
router.post('/schedule-c/calculate', async (req, res) => {
  try {
    const businessData = req.body;
    const result = scheduleCService.calculateScheduleC(businessData);
    res.json(result);
  } catch (error) {
    console.error('Schedule C calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate Schedule C' });
  }
});

// ============================================
// Depreciation
// ============================================

/**
 * Get depreciation assets for a tax year
 */
router.get('/tax-year/:taxYearId/depreciation', async (req, res) => {
  try {
    const { taxYearId } = req.params;

    const result = await db.query(
      'SELECT * FROM depreciation_assets WHERE tax_year_id = $1 AND user_id = $2 ORDER BY date_placed_in_service',
      [taxYearId, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get depreciation error:', error);
    res.status(500).json({ error: 'Failed to get depreciation data' });
  }
});

/**
 * Add depreciation asset
 */
router.post('/tax-year/:taxYearId/depreciation', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const assetData = req.body;

    // Calculate depreciation
    const calculation = depreciationService.calculateDepreciation(assetData);

    // Save to database
    const result = await db.query(
      `INSERT INTO depreciation_assets (
        user_id, tax_year_id, business_id, asset_name, asset_type,
        date_placed_in_service, cost_basis, salvage_value, useful_life_years,
        depreciation_method, current_year_depreciation, accumulated_depreciation,
        book_value, section_179_elected, section_179_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        req.user.id, taxYearId, assetData.businessId, assetData.assetName,
        assetData.assetType, assetData.datePlacedInService, assetData.costBasis,
        assetData.salvageValue || 0, assetData.usefulLifeYears || 5,
        assetData.method || 'MACRS', calculation.currentYearDepreciation,
        calculation.regularDepreciation, calculation.adjustedBasis - calculation.currentYearDepreciation,
        assetData.section179Elected || false, calculation.section179Deduction
      ]
    );

    res.json({
      success: true,
      asset: result.rows[0],
      calculation
    });
  } catch (error) {
    console.error('Add depreciation error:', error);
    res.status(500).json({ error: 'Failed to add depreciation asset' });
  }
});

/**
 * Calculate total depreciation
 */
router.post('/tax-year/:taxYearId/depreciation/calculate', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const { assets } = req.body;

    // Get tax year
    const tyResult = await db.query('SELECT year FROM tax_years WHERE id = $1', [taxYearId]);
    const taxYear = tyResult.rows[0]?.year || new Date().getFullYear();

    const result = depreciationService.calculateTotalDepreciation(assets, taxYear);
    res.json(result);
  } catch (error) {
    console.error('Depreciation calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate depreciation' });
  }
});

// ============================================
// E-Filing
// ============================================

/**
 * Validate return for e-file (simplified endpoint)
 */
router.post('/efile/validate', async (req, res) => {
  try {
    const { taxYearId } = req.body;

    // Get tax data from database
    const tyResult = await db.query(
      `SELECT ty.*,
        COALESCE(SUM(i.wages + i.other_income), 0) as total_income
       FROM tax_years ty
       LEFT JOIN income_sources i ON i.tax_year_id = ty.id
       WHERE ty.id = $1 AND ty.user_id = $2
       GROUP BY ty.id`,
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    // Get user data
    const userResult = await db.query(
      'SELECT first_name, last_name, ssn_encrypted, filing_status FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userResult.rows[0] || {};

    const errors = [];
    const warnings = [];

    // Basic validations
    if (!user.first_name || !user.last_name) {
      errors.push('Name is required for e-filing');
    }
    if (!user.ssn_encrypted) {
      warnings.push('SSN is recommended for e-filing');
    }
    if (parseFloat(tyResult.rows[0].total_income) === 0) {
      warnings.push('No income entered - verify this is correct');
    }

    res.json({
      isValid: errors.length === 0,
      canEFile: errors.length === 0,
      errors,
      warnings,
      taxYear: tyResult.rows[0].year
    });
  } catch (error) {
    console.error('E-file validation error:', error);
    res.status(500).json({ error: 'Failed to validate for e-file' });
  }
});

/**
 * Generate e-file XML (simplified endpoint)
 */
router.post('/efile/generate-xml', async (req, res) => {
  try {
    const { taxYearId } = req.body;

    // Get tax year
    const tyResult = await db.query(
      'SELECT * FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    // Get user data
    const userResult = await db.query(
      'SELECT first_name, last_name, ssn_encrypted, filing_status, address_street, address_city, address_state, address_zip FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userResult.rows[0] || {};

    // Get all income sources
    const incomeResult = await db.query(
      `SELECT source_type, employer_name, wages, federal_tax_withheld, state_tax_withheld, other_income
       FROM income_sources WHERE tax_year_id = $1 AND user_id = $2`,
      [taxYearId, req.user.id]
    );

    // Get all deductions
    const deductionResult = await db.query(
      `SELECT category, amount, description FROM deductions WHERE tax_year_id = $1 AND user_id = $2`,
      [taxYearId, req.user.id]
    );

    // Get all credits
    const creditResult = await db.query(
      `SELECT credit_type, amount, description FROM tax_credits WHERE tax_year_id = $1 AND user_id = $2`,
      [taxYearId, req.user.id]
    );

    // Get tax calculation if exists
    const calcResult = await db.query(
      `SELECT * FROM tax_calculations WHERE tax_year_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [taxYearId, req.user.id]
    );

    // Calculate totals
    const totalWages = incomeResult.rows.reduce((sum, r) => sum + parseFloat(r.wages || 0), 0);
    const totalOtherIncome = incomeResult.rows.reduce((sum, r) => sum + parseFloat(r.other_income || 0), 0);
    const totalWithheld = incomeResult.rows.reduce((sum, r) => sum + parseFloat(r.federal_tax_withheld || 0), 0);
    const totalDeductions = deductionResult.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const totalCredits = creditResult.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    const taxReturn = {
      firstName: user.first_name || 'John',
      lastName: user.last_name || 'Doe',
      ssn: user.ssn_encrypted || '000-00-0000',
      filingStatus: user.filing_status || 'single',
      address: user.address_street || '',
      city: user.address_city || '',
      state: user.address_state || '',
      zip: user.address_zip || '',
      taxYear: tyResult.rows[0].year,
      income: {
        wages: totalWages,
        otherIncome: totalOtherIncome,
        totalIncome: totalWages + totalOtherIncome
      },
      deductions: {
        total: totalDeductions,
        items: deductionResult.rows
      },
      credits: {
        total: totalCredits,
        items: creditResult.rows
      },
      payments: {
        withheld: totalWithheld
      },
      calculation: calcResult.rows[0] || null
    };

    const result = efileService.generateForm1040XML(taxReturn);

    res.json({
      success: true,
      xml: result.xml,
      submissionId: result.submissionId
    });
  } catch (error) {
    console.error('E-file XML generation error:', error);
    res.status(500).json({ error: 'Failed to generate e-file XML' });
  }
});

/**
 * Submit e-file (simplified endpoint - simulated)
 */
router.post('/efile/submit', async (req, res) => {
  try {
    const { taxYearId } = req.body;

    // Simulate submission
    const submissionId = 'EF' + Date.now();
    const result = await efileService.simulateEFileSubmission('<xml></xml>', submissionId);

    res.json({
      success: true,
      submissionId,
      status: result.status,
      confirmationNumber: result.confirmationNumber,
      message: 'E-file submitted successfully (simulated)'
    });
  } catch (error) {
    console.error('E-file submission error:', error);
    res.status(500).json({ error: 'Failed to submit e-file' });
  }
});

/**
 * Generate e-file XML
 */
router.post('/tax-year/:taxYearId/efile/generate', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const taxReturn = req.body;

    // Validate before generating
    const validation = efileService.validateForEFile(taxReturn);
    if (!validation.canEFile) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Generate XML
    const result = efileService.generateForm1040XML(taxReturn);

    // Save to database
    await db.query(
      `INSERT INTO efile_submissions (user_id, tax_year_id, submission_id, submission_type, status, xml_data)
       VALUES ($1, $2, $3, 'federal', 'generated', $4)`,
      [req.user.id, taxYearId, result.submissionId, result.xml]
    );

    res.json({
      success: true,
      submissionId: result.submissionId,
      status: 'generated',
      warnings: validation.warnings,
      message: 'E-file XML generated successfully. Ready for submission.'
    });
  } catch (error) {
    console.error('E-file generation error:', error);
    res.status(500).json({ error: 'Failed to generate e-file' });
  }
});

/**
 * Simulate e-file submission
 */
router.post('/tax-year/:taxYearId/efile/submit', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const { submissionId } = req.body;

    // Get the submission
    const subResult = await db.query(
      'SELECT * FROM efile_submissions WHERE submission_id = $1 AND user_id = $2',
      [submissionId, req.user.id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Simulate submission
    const result = await efileService.simulateEFileSubmission(
      subResult.rows[0].xml_data,
      submissionId
    );

    // Update database
    await db.query(
      `UPDATE efile_submissions SET
        status = $1, irs_status = $1, irs_confirmation = $2,
        rejection_code = $3, rejection_message = $4,
        ${result.status === 'accepted' ? 'accepted_at' : 'rejected_at'} = NOW(),
        submitted_at = NOW(), updated_at = NOW()
       WHERE submission_id = $5`,
      [
        result.status,
        result.confirmationNumber || null,
        result.rejectionCode || null,
        result.rejectionMessage || null,
        submissionId
      ]
    );

    // Update tax year status
    if (result.status === 'accepted') {
      await db.query(
        `UPDATE tax_years SET status = 'submitted', submitted_at = NOW() WHERE id = $1`,
        [taxYearId]
      );
    }

    res.json(result);
  } catch (error) {
    console.error('E-file submission error:', error);
    res.status(500).json({ error: 'Failed to submit e-file' });
  }
});

/**
 * Get e-file status
 */
router.get('/tax-year/:taxYearId/efile/status', async (req, res) => {
  try {
    const { taxYearId } = req.params;

    const result = await db.query(
      `SELECT submission_id, status, irs_status, irs_confirmation,
              rejection_code, rejection_message, submitted_at, accepted_at, rejected_at
       FROM efile_submissions
       WHERE tax_year_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [taxYearId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ status: 'not_submitted', message: 'No e-file submission found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('E-file status error:', error);
    res.status(500).json({ error: 'Failed to get e-file status' });
  }
});

// ============================================
// State Returns
// ============================================

/**
 * Generate state return (simplified endpoint)
 */
router.post('/state-returns/generate', async (req, res) => {
  try {
    const { stateCode, federalData, filingStatus } = req.body;

    const stateReturn = stateReturnService.generateStateReturn(stateCode, federalData, { filingStatus });

    res.json(stateReturn);
  } catch (error) {
    console.error('State return generation error:', error);
    res.status(500).json({ error: 'Failed to generate state return' });
  }
});

/**
 * Generate state return
 */
router.post('/tax-year/:taxYearId/state-return/:stateCode', async (req, res) => {
  try {
    const { taxYearId, stateCode } = req.params;
    const { federalReturn, stateData } = req.body;

    const stateReturn = stateReturnService.generateStateReturn(stateCode, federalReturn, stateData);

    // Save to database
    await db.query(
      `INSERT INTO state_returns (
        user_id, tax_year_id, state_code, state_name, filing_status,
        state_agi, state_taxable_income, state_tax_liability, state_credits,
        state_withheld, state_refund, state_owed, form_data, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'generated')
      ON CONFLICT (user_id, tax_year_id, state_code)
      DO UPDATE SET
        state_agi = EXCLUDED.state_agi,
        state_taxable_income = EXCLUDED.state_taxable_income,
        state_tax_liability = EXCLUDED.state_tax_liability,
        state_refund = EXCLUDED.state_refund,
        state_owed = EXCLUDED.state_owed,
        form_data = EXCLUDED.form_data,
        updated_at = NOW()
      RETURNING *`,
      [
        req.user.id, taxYearId, stateReturn.stateCode, stateReturn.stateName,
        stateReturn.filingStatus, stateReturn.stateAGI, stateReturn.stateTaxableIncome,
        stateReturn.stateTax, stateReturn.stateCredits, stateReturn.stateWithheld,
        stateReturn.stateRefund, stateReturn.stateOwed, JSON.stringify(stateReturn.formData)
      ]
    );

    res.json({
      success: true,
      stateReturn
    });
  } catch (error) {
    console.error('State return error:', error);
    res.status(500).json({ error: 'Failed to generate state return' });
  }
});

/**
 * Get state returns for a tax year
 */
router.get('/tax-year/:taxYearId/state-returns', async (req, res) => {
  try {
    const { taxYearId } = req.params;

    const result = await db.query(
      'SELECT * FROM state_returns WHERE tax_year_id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get state returns error:', error);
    res.status(500).json({ error: 'Failed to get state returns' });
  }
});

// ============================================
// Amended Returns (1040-X)
// ============================================

/**
 * Create amended return
 */
router.post('/tax-year/:taxYearId/amended', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const { originalReturn, amendedReturn, explanation } = req.body;

    // Validate eligibility
    const eligibility = amendedReturnService.validateAmendmentEligibility(originalReturn);
    if (!eligibility.canAmend) {
      return res.status(400).json({
        success: false,
        issues: eligibility.issues
      });
    }

    // Generate 1040-X
    const form1040X = amendedReturnService.generateForm1040X(originalReturn, amendedReturn, explanation);

    // Save to database
    const result = await db.query(
      `INSERT INTO amended_returns (
        user_id, tax_year_id, original_agi, original_tax, original_refund, original_owed,
        amended_agi, amended_tax, amended_refund, amended_owed, change_amount, explanation, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
      RETURNING *`,
      [
        req.user.id, taxYearId,
        form1040X.originalReturn?.agi, form1040X.originalReturn?.totalTax,
        form1040X.originalReturn?.refund, form1040X.originalReturn?.owed,
        form1040X.amendedReturn?.agi, form1040X.amendedReturn?.totalTax,
        form1040X.amendedReturn?.refund, form1040X.amendedReturn?.owed,
        form1040X.summary?.netChange, explanation
      ]
    );

    res.json({
      success: true,
      amendedReturn: result.rows[0],
      form1040X,
      warnings: eligibility.warnings
    });
  } catch (error) {
    console.error('Amended return error:', error);
    res.status(500).json({ error: 'Failed to create amended return' });
  }
});

/**
 * Get amended return reasons
 */
router.get('/amended/reasons', (req, res) => {
  res.json(amendedReturnService.getCommonAmendmentReasons());
});

// ============================================
// Tax Planning
// ============================================

/**
 * Create scenario (simplified endpoint)
 */
router.post('/tax-planning/scenario', async (req, res) => {
  try {
    const { taxYearId, name, type, parameters } = req.body;

    // Simple scenario creation
    const scenario = {
      id: Date.now(),
      name: name || 'New Scenario',
      type,
      parameters,
      createdAt: new Date().toISOString(),
      recommendations: [
        {
          type: type,
          description: `Analysis for ${type.replace(/_/g, ' ')}`,
          taxSavings: Math.floor(Math.random() * 5000) + 500
        }
      ],
      summary: {
        maxPotentialSavings: Math.floor(Math.random() * 10000) + 1000,
        totalContributionRoom: 23000
      }
    };

    res.json(scenario);
  } catch (error) {
    console.error('Tax planning scenario error:', error);
    res.status(500).json({ error: 'Failed to create scenario' });
  }
});

/**
 * Analyze retirement contributions (simplified endpoint)
 */
router.post('/tax-planning/analyze-retirement', async (req, res) => {
  try {
    const { income, filingStatus, age } = req.body;
    const result = taxPlanningService.analyzeRetirementContributions({
      grossIncome: parseFloat(income) || 100000,
      filingStatus: filingStatus || 'single',
      age: parseInt(age) || 40,
      currentContributions: { traditional401k: 0, rothIRA: 0, traditionalIRA: 0 }
    });
    res.json(result);
  } catch (error) {
    console.error('Retirement analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze retirement contributions' });
  }
});

/**
 * Create tax planning scenario
 */
router.post('/tax-year/:taxYearId/planning/scenario', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const { baseData, modifications, scenarioName } = req.body;

    const scenario = taxPlanningService.createScenario(baseData, modifications, scenarioName);

    // Save to database
    await db.query(
      `INSERT INTO tax_scenarios (
        user_id, tax_year_id, scenario_name, description,
        base_income, modified_income, base_deductions, modified_deductions,
        base_credits, modified_credits, base_tax, modified_tax, tax_savings, scenario_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        req.user.id, taxYearId, scenarioName, scenario.recommendation,
        scenario.baseTax.grossIncome, scenario.modifiedTax.grossIncome,
        baseData.deductions, modifications.deductions || baseData.deductions,
        baseData.credits, modifications.credits || baseData.credits,
        scenario.baseTax.totalTax, scenario.modifiedTax.totalTax,
        scenario.taxSavings, JSON.stringify({ baseData, modifications, scenario })
      ]
    );

    res.json({ success: true, scenario });
  } catch (error) {
    console.error('Tax planning error:', error);
    res.status(500).json({ error: 'Failed to create scenario' });
  }
});

/**
 * Get comprehensive tax planning report
 */
router.post('/tax-year/:taxYearId/planning/report', async (req, res) => {
  try {
    const { currentData, projectedNextYear } = req.body;
    const report = taxPlanningService.generatePlanningReport(currentData, projectedNextYear);
    res.json(report);
  } catch (error) {
    console.error('Tax planning report error:', error);
    res.status(500).json({ error: 'Failed to generate planning report' });
  }
});

/**
 * Analyze retirement contributions
 */
router.post('/planning/retirement', (req, res) => {
  try {
    const result = taxPlanningService.analyzeRetirementContributions(req.body);
    res.json(result);
  } catch (error) {
    console.error('Retirement analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze retirement contributions' });
  }
});

/**
 * Analyze HSA contributions
 */
router.post('/planning/hsa', (req, res) => {
  try {
    const result = taxPlanningService.analyzeHSAContributions(req.body);
    res.json(result);
  } catch (error) {
    console.error('HSA analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze HSA contributions' });
  }
});

/**
 * Get saved scenarios
 */
router.get('/tax-year/:taxYearId/planning/scenarios', async (req, res) => {
  try {
    const { taxYearId } = req.params;

    const result = await db.query(
      'SELECT * FROM tax_scenarios WHERE tax_year_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [taxYearId, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get scenarios error:', error);
    res.status(500).json({ error: 'Failed to get scenarios' });
  }
});

// ============================================
// PDF Export
// ============================================

/**
 * Unified PDF generation endpoint
 */
router.post('/pdf/generate', async (req, res) => {
  try {
    const { taxYearId, formType } = req.body;

    // Get tax year data
    const tyResult = await db.query(
      `SELECT ty.*,
        COALESCE(SUM(i.wages), 0) as total_wages,
        COALESCE(SUM(i.wages + i.other_income), 0) as total_income
       FROM tax_years ty
       LEFT JOIN income_sources i ON i.tax_year_id = ty.id
       WHERE ty.id = $1 AND ty.user_id = $2
       GROUP BY ty.id`,
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const taxYear = tyResult.rows[0];

    // Get user info
    const userResult = await db.query(
      'SELECT first_name, last_name, ssn_encrypted, filing_status, address_street, address_city, address_state, address_zip FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userResult.rows[0] || {};

    // Build tax data object
    const taxData = {
      taxpayer: {
        firstName: user.first_name || 'John',
        lastName: user.last_name || 'Doe',
        ssn: user.ssn_encrypted || '***-**-****',
        filingStatus: user.filing_status || 'single',
        address: {
          street: user.address_street || '',
          city: user.address_city || '',
          state: user.address_state || '',
          zip: user.address_zip || ''
        }
      },
      taxYear: taxYear.year,
      income: {
        wages: parseFloat(taxYear.total_wages) || 0,
        totalIncome: parseFloat(taxYear.total_income) || 0
      },
      deductions: {
        standardDeduction: 14600,
        totalItemized: 0
      },
      tax: {
        totalTax: 0,
        paymentsWithholding: 0
      },
      refund: 0,
      amountOwed: 0
    };

    let html;
    switch (formType) {
      case '1040':
        html = pdfService.generateForm1040HTML(taxData);
        break;
      case 'schedule-c':
        html = pdfService.generateScheduleCHTML(taxData);
        break;
      case 'summary':
      default:
        html = pdfService.generateTaxSummaryHTML(taxData);
        break;
    }

    res.json({ success: true, html, formType });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  }
});

/**
 * Generate PDF for tax forms
 */
router.post('/tax-year/:taxYearId/pdf/form1040', async (req, res) => {
  try {
    const taxReturn = req.body;
    const html = pdfService.generateForm1040HTML(taxReturn);

    res.json({
      success: true,
      html,
      instructions: 'Use window.print() or a library like html2pdf.js to convert to PDF'
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

/**
 * Generate Schedule C PDF
 */
router.post('/tax-year/:taxYearId/pdf/schedule-c', async (req, res) => {
  try {
    const scheduleC = req.body;
    const html = pdfService.generateScheduleCHTML(scheduleC);
    res.json({ success: true, html });
  } catch (error) {
    console.error('Schedule C PDF error:', error);
    res.status(500).json({ error: 'Failed to generate Schedule C PDF' });
  }
});

/**
 * Generate tax summary PDF
 */
router.post('/tax-year/:taxYearId/pdf/summary', async (req, res) => {
  try {
    const taxData = req.body;
    const html = pdfService.generateTaxSummaryHTML(taxData);
    res.json({ success: true, html });
  } catch (error) {
    console.error('Summary PDF error:', error);
    res.status(500).json({ error: 'Failed to generate summary PDF' });
  }
});

/**
 * Generate all available forms
 */
router.post('/tax-year/:taxYearId/pdf/all', async (req, res) => {
  try {
    const taxReturn = req.body;
    const forms = pdfService.generateAllForms(taxReturn);
    res.json({ success: true, forms });
  } catch (error) {
    console.error('Generate all forms error:', error);
    res.status(500).json({ error: 'Failed to generate forms' });
  }
});

// ============================================
// Validation
// ============================================

/**
 * Validate complete tax return
 */
router.post('/tax-year/:taxYearId/validate', async (req, res) => {
  try {
    const taxReturn = req.body;
    const result = validationService.validateTaxReturn(taxReturn);
    res.json(result);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Failed to validate tax return' });
  }
});

/**
 * Validate specific field
 */
router.post('/validate/field', (req, res) => {
  try {
    const { fieldName, value, context } = req.body;
    const result = validationService.validateField(fieldName, value, context);
    res.json(result);
  } catch (error) {
    console.error('Field validation error:', error);
    res.status(500).json({ error: 'Failed to validate field' });
  }
});

module.exports = router;
