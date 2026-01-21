const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const aiService = require('../services/aiService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.use(authMiddleware);

// Get user context for AI
async function getUserContext(userId, taxYearId) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const taxYear = taxYearId ? await db.query('SELECT * FROM tax_years WHERE id = $1 AND user_id = $2', [taxYearId, userId]) : null;

  const income = taxYearId ? await db.query(
    'SELECT source_type, employer_name, wages, other_income FROM income_sources WHERE tax_year_id = $1',
    [taxYearId]
  ) : { rows: [] };

  const deductions = taxYearId ? await db.query(
    'SELECT category, description, amount, is_itemized FROM deductions WHERE tax_year_id = $1',
    [taxYearId]
  ) : { rows: [] };

  const credits = taxYearId ? await db.query(
    'SELECT credit_type, amount FROM tax_credits WHERE tax_year_id = $1',
    [taxYearId]
  ) : { rows: [] };

  const dependents = taxYearId ? await db.query(
    `SELECT first_name, relationship,
     EXTRACT(YEAR FROM AGE(date_of_birth)) as age,
     is_student, is_disabled
     FROM dependents WHERE tax_year_id = $1`,
    [taxYearId]
  ) : { rows: [] };

  const expenses = taxYearId ? await db.query(
    `SELECT ec.name as category, ue.description, ue.amount, ue.vendor
     FROM user_expenses ue
     JOIN expense_categories ec ON ue.category_id = ec.id
     WHERE ue.tax_year_id = $1`,
    [taxYearId]
  ) : { rows: [] };

  const calculation = taxYearId ? await db.query(
    'SELECT * FROM tax_calculations WHERE tax_year_id = $1 ORDER BY calculated_at DESC LIMIT 1',
    [taxYearId]
  ) : { rows: [] };

  const grossIncome = income.rows.reduce((sum, i) => sum + parseFloat(i.wages || 0) + parseFloat(i.other_income || 0), 0);
  const totalDeductions = deductions.rows.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
  const totalCredits = credits.rows.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

  return {
    filingStatus: user.rows[0]?.filing_status || 'single',
    taxYear: taxYear?.rows[0]?.year || new Date().getFullYear(),
    grossIncome,
    agi: calculation.rows[0]?.adjusted_gross_income || grossIncome,
    standardDeduction: calculation.rows[0]?.standard_deduction || 14600,
    itemizedDeductions: calculation.rows[0]?.itemized_deduction || totalDeductions,
    deductionType: calculation.rows[0] ?
      (parseFloat(calculation.rows[0].itemized_deduction) > parseFloat(calculation.rows[0].standard_deduction) ? 'itemized' : 'standard')
      : 'standard',
    totalCredits,
    incomeSources: income.rows.map(i => ({
      type: i.source_type,
      source: i.employer_name,
      amount: parseFloat(i.wages || 0) + parseFloat(i.other_income || 0)
    })),
    deductions: deductions.rows.map(d => ({
      category: d.category,
      description: d.description,
      amount: parseFloat(d.amount || 0),
      isItemized: d.is_itemized
    })),
    deductionBreakdown: deductions.rows.map(d => ({
      category: d.category,
      amount: parseFloat(d.amount || 0)
    })),
    credits: credits.rows.map(c => ({
      type: c.credit_type,
      amount: parseFloat(c.amount || 0)
    })),
    dependents: dependents.rows.map(d => ({
      relationship: d.relationship,
      age: parseInt(d.age),
      isStudent: d.is_student,
      isDisabled: d.is_disabled
    })),
    expenses: expenses.rows.map(e => ({
      category: e.category,
      description: e.description,
      amount: parseFloat(e.amount || 0),
      vendor: e.vendor
    })),
    selfEmploymentIncome: income.rows
      .filter(i => ['1099-NEC', '1099-MISC'].includes(i.source_type))
      .reduce((sum, i) => sum + parseFloat(i.other_income || 0), 0),
    isSelfEmployed: income.rows.some(i => ['1099-NEC', '1099-MISC'].includes(i.source_type)),
    charitableDonations: deductions.rows
      .filter(d => d.category?.toLowerCase().includes('charit'))
      .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0),
    homeOfficeDeduction: deductions.rows.some(d => d.category?.toLowerCase().includes('home office')),
    hasCashBusiness: false,
    isHomeowner: deductions.rows.some(d =>
      d.category?.toLowerCase().includes('mortgage') ||
      d.category?.toLowerCase().includes('property tax')
    ),
    worksFromHome: deductions.rows.some(d => d.category?.toLowerCase().includes('home office')),
    hasStudentLoans: deductions.rows.some(d => d.category?.toLowerCase().includes('student loan')),
    madeCharitableDonations: deductions.rows.some(d => d.category?.toLowerCase().includes('charit')),
    hasMedicalExpenses: deductions.rows.some(d => d.category?.toLowerCase().includes('medical')),
    paidForEducation: credits.rows.some(c =>
      c.credit_type?.toLowerCase().includes('education') ||
      c.credit_type?.toLowerCase().includes('learning') ||
      c.credit_type?.toLowerCase().includes('opportunity')
    ),
    occupation: user.rows[0]?.occupation || 'Not specified'
  };
}

// AI Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { messages, taxYearId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const context = await getUserContext(req.user.id, taxYearId);
    const response = await aiService.chatAboutTaxes(messages, context);

    // Save chat to history
    await db.query(
      `INSERT INTO chat_history (user_id, tax_year_id, messages, response, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [req.user.id, taxYearId || null, JSON.stringify(messages), response]
    );

    res.json({ response, context: { taxYear: context.taxYear, filingStatus: context.filingStatus } });
  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Get chat history
router.get('/chat/history', async (req, res) => {
  try {
    const { taxYearId, limit = 50 } = req.query;

    let query = 'SELECT * FROM chat_history WHERE user_id = $1';
    const params = [req.user.id];

    if (taxYearId) {
      query += ' AND tax_year_id = $2';
      params.push(taxYearId);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    res.json(result.rows.map(row => ({
      id: row.id,
      messages: row.messages,
      response: row.response,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// OCR Document scanning
router.post('/scan-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' });
    }

    const { documentType = 'default' } = req.body;
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const extractedData = await aiService.extractDocumentData(base64Image, documentType, mimeType);

    res.json({
      success: true,
      documentType,
      extractedData,
      fileName: req.file.originalname
    });
  } catch (error) {
    console.error('Document scan error:', error);
    res.status(500).json({ error: 'Failed to scan document' });
  }
});

// Auto-import scanned document data
router.post('/import-scanned-data', async (req, res) => {
  try {
    const { documentType, data, taxYearId } = req.body;

    if (!documentType || !data || !taxYearId) {
      return res.status(400).json({ error: 'Document type, data, and tax year ID are required' });
    }

    // Verify tax year belongs to user
    const tyCheck = await db.query(
      'SELECT id FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );
    if (tyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    let result;

    if (documentType === 'W-2') {
      result = await db.query(
        `INSERT INTO income_sources (
          tax_year_id, source_type, employer_name, employer_ein,
          wages, federal_tax_withheld, state_tax_withheld,
          social_security_wages, social_security_tax, medicare_wages, medicare_tax
        ) VALUES ($1, 'W-2', $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          taxYearId,
          data.employerName || 'Unknown Employer',
          data.employerEIN || '',
          data.wages || 0,
          data.federalTaxWithheld || 0,
          data.stateTaxWithheld || 0,
          data.socialSecurityWages || 0,
          data.socialSecurityTax || 0,
          data.medicareWages || 0,
          data.medicareTax || 0
        ]
      );
    } else if (documentType === '1099-NEC') {
      result = await db.query(
        `INSERT INTO income_sources (
          tax_year_id, source_type, employer_name, employer_ein,
          other_income, federal_tax_withheld
        ) VALUES ($1, '1099-NEC', $2, $3, $4, $5)
        RETURNING id`,
        [
          taxYearId,
          data.payerName || 'Unknown Payer',
          data.payerTIN || '',
          data.nonemployeeCompensation || 0,
          data.federalTaxWithheld || 0
        ]
      );
    } else if (documentType === '1099-INT') {
      result = await db.query(
        `INSERT INTO income_sources (
          tax_year_id, source_type, employer_name,
          other_income, federal_tax_withheld
        ) VALUES ($1, '1099-INT', $2, $3, $4)
        RETURNING id`,
        [
          taxYearId,
          data.payerName || 'Unknown Payer',
          data.interestIncome || 0,
          data.federalTaxWithheld || 0
        ]
      );
    } else if (documentType === '1099-DIV') {
      result = await db.query(
        `INSERT INTO income_sources (
          tax_year_id, source_type, employer_name,
          other_income, federal_tax_withheld
        ) VALUES ($1, '1099-DIV', $2, $3, $4)
        RETURNING id`,
        [
          taxYearId,
          data.payerName || 'Unknown Payer',
          (parseFloat(data.ordinaryDividends) || 0) + (parseFloat(data.totalCapitalGains) || 0),
          data.federalTaxWithheld || 0
        ]
      );
    } else if (documentType === 'Receipt') {
      // Find or create expense category
      let categoryId;
      const catResult = await db.query(
        'SELECT id FROM expense_categories WHERE LOWER(name) = LOWER($1)',
        [data.category || 'Other']
      );

      if (catResult.rows.length > 0) {
        categoryId = catResult.rows[0].id;
      } else {
        const newCat = await db.query(
          'INSERT INTO expense_categories (name, is_deductible) VALUES ($1, $2) RETURNING id',
          [data.category || 'Other', data.taxDeductible || false]
        );
        categoryId = newCat.rows[0].id;
      }

      result = await db.query(
        `INSERT INTO user_expenses (
          user_id, tax_year_id, category_id, description, amount, expense_date, vendor
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          req.user.id,
          taxYearId,
          categoryId,
          data.items?.map(i => i.description).join(', ') || 'Scanned receipt',
          data.total || 0,
          data.date || new Date().toISOString().split('T')[0],
          data.vendor || 'Unknown'
        ]
      );
    }

    res.json({
      success: true,
      message: `${documentType} data imported successfully`,
      recordId: result?.rows[0]?.id
    });
  } catch (error) {
    console.error('Import scanned data error:', error);
    res.status(500).json({ error: 'Failed to import scanned data' });
  }
});

// Smart Deduction Finder
router.post('/find-deductions', async (req, res) => {
  try {
    const { taxYearId, additionalInfo = {} } = req.body;

    const context = await getUserContext(req.user.id, taxYearId);

    // Merge additional info
    Object.assign(context, additionalInfo);

    const result = await aiService.findMissedDeductions(context);

    res.json(result);
  } catch (error) {
    console.error('Find deductions error:', error);
    res.status(500).json({ error: 'Failed to find deductions' });
  }
});

// Audit Risk Analysis
router.post('/audit-risk', async (req, res) => {
  try {
    const { taxYearId } = req.body;

    if (!taxYearId) {
      return res.status(400).json({ error: 'Tax year ID is required' });
    }

    const context = await getUserContext(req.user.id, taxYearId);
    const result = await aiService.analyzeAuditRisk(context);

    res.json(result);
  } catch (error) {
    console.error('Audit risk error:', error);
    res.status(500).json({ error: 'Failed to analyze audit risk' });
  }
});

// AI-Powered Tax Advice (replaces rule-based)
router.post('/tax-year/:taxYearId/generate-advice', async (req, res) => {
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

    const context = await getUserContext(req.user.id, taxYearId);
    const aiResult = await aiService.getTaxAdvice(context);

    // Clear old advice
    await db.query(
      'DELETE FROM ai_tax_advice WHERE tax_year_id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    // Insert new AI-generated advice
    for (const adv of (aiResult.advice || [])) {
      await db.query(
        `INSERT INTO ai_tax_advice (
          user_id, tax_year_id, advice_type, title, advice_text,
          potential_savings, priority, action_items
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          req.user.id,
          taxYearId,
          adv.type || 'general',
          adv.title,
          adv.description,
          adv.potentialSavings || 0,
          adv.priority || 'medium',
          JSON.stringify(adv.actionItems || [])
        ]
      );
    }

    res.json({
      success: true,
      summary: aiResult.summary,
      adviceCount: aiResult.advice?.length || 0,
      totalPotentialSavings: aiResult.totalPotentialSavings || 0,
      advice: aiResult.advice
    });
  } catch (error) {
    console.error('Generate AI advice error:', error);
    res.status(500).json({ error: 'Failed to generate AI tax advice' });
  }
});

// Tax Interview Wizard
router.post('/interview/start', async (req, res) => {
  try {
    const { taxYearId } = req.body;

    // Create or get interview state
    let interview = await db.query(
      'SELECT * FROM tax_interviews WHERE user_id = $1 AND tax_year_id = $2',
      [req.user.id, taxYearId]
    );

    if (interview.rows.length === 0) {
      interview = await db.query(
        `INSERT INTO tax_interviews (user_id, tax_year_id, current_section, answers, completed_sections, progress)
         VALUES ($1, $2, 'personal_info', '{}', '[]', 0)
         RETURNING *`,
        [req.user.id, taxYearId]
      );
    }

    const state = interview.rows[0];

    res.json({
      interviewId: state.id,
      currentSection: state.current_section,
      progress: state.progress,
      completedSections: state.completed_sections,
      answers: state.answers
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

router.post('/interview/next-question', async (req, res) => {
  try {
    const { interviewId, section } = req.body;

    const interview = await db.query(
      'SELECT * FROM tax_interviews WHERE id = $1 AND user_id = $2',
      [interviewId, req.user.id]
    );

    if (interview.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const state = interview.rows[0];

    const context = {
      section: section || state.current_section,
      answers: state.answers,
      completedSections: state.completed_sections,
      progress: state.progress
    };

    const question = await aiService.generateInterviewQuestion(context);

    res.json(question);
  } catch (error) {
    console.error('Next question error:', error);
    res.status(500).json({ error: 'Failed to get next question' });
  }
});

router.post('/interview/answer', async (req, res) => {
  try {
    const { interviewId, field, value, section } = req.body;

    const interview = await db.query(
      'SELECT * FROM tax_interviews WHERE id = $1 AND user_id = $2',
      [interviewId, req.user.id]
    );

    if (interview.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const state = interview.rows[0];
    const answers = { ...state.answers, [field]: value };

    // Update interview state
    await db.query(
      `UPDATE tax_interviews
       SET answers = $1, current_section = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(answers), section || state.current_section, interviewId]
    );

    res.json({ success: true, answers });
  } catch (error) {
    console.error('Save answer error:', error);
    res.status(500).json({ error: 'Failed to save answer' });
  }
});

router.post('/interview/complete-section', async (req, res) => {
  try {
    const { interviewId, section, nextSection } = req.body;

    const interview = await db.query(
      'SELECT * FROM tax_interviews WHERE id = $1 AND user_id = $2',
      [interviewId, req.user.id]
    );

    if (interview.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const state = interview.rows[0];
    const completedSections = [...(state.completed_sections || [])];

    if (!completedSections.includes(section)) {
      completedSections.push(section);
    }

    const allSections = ['personal_info', 'income', 'deductions', 'credits', 'dependents', 'review'];
    const progress = Math.round((completedSections.length / allSections.length) * 100);

    await db.query(
      `UPDATE tax_interviews
       SET completed_sections = $1, current_section = $2, progress = $3, updated_at = NOW()
       WHERE id = $4`,
      [JSON.stringify(completedSections), nextSection || section, progress, interviewId]
    );

    res.json({
      success: true,
      completedSections,
      progress,
      currentSection: nextSection || section
    });
  } catch (error) {
    console.error('Complete section error:', error);
    res.status(500).json({ error: 'Failed to complete section' });
  }
});

// Submit interview - save to database tables
router.post('/interview/submit', async (req, res) => {
  try {
    const { interviewId, taxYearId, answers } = req.body;

    if (!taxYearId || !answers) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    // Verify tax year belongs to user
    const tyResult = await db.query(
      'SELECT * FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    // Helper to parse currency values
    const parseCurrency = (val) => parseFloat(val) || 0;

    // Save W-2 Income
    if (answers.has_w2_income === 'yes' && answers.w2_wages_amount) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, wages, federal_tax_withheld)
         VALUES ($1, $2, 'W-2', 'Primary Employment', $3, $4)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.w2_wages_amount), parseCurrency(answers.w2_federal_withheld)]
      );
    }

    // Save Self-Employment Income
    if (answers.has_self_employment === 'yes' && answers.self_employment_income) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income)
         VALUES ($1, $2, '1099-NEC', 'Self-Employment', $3)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.self_employment_income) - parseCurrency(answers.self_employment_expenses)]
      );
    }

    // Save Interest Income
    if (answers.has_investment_income === 'yes' && answers.interest_income) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income)
         VALUES ($1, $2, '1099-INT', 'Interest Income', $3)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.interest_income)]
      );
    }

    // Save Dividend Income
    if (answers.has_dividend_income === 'yes' && answers.dividend_income) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income)
         VALUES ($1, $2, '1099-DIV', 'Dividend Income', $3)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.dividend_income)]
      );
    }

    // Save Capital Gains
    if (answers.has_capital_gains === 'yes') {
      const shortTerm = parseCurrency(answers.short_term_capital_gains);
      const longTerm = parseCurrency(answers.long_term_capital_gains);
      if (shortTerm || longTerm) {
        await db.query(
          `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income, description)
           VALUES ($1, $2, 'Capital Gains', 'Investment Sales', $3, $4)
           ON CONFLICT DO NOTHING`,
          [req.user.id, taxYearId, shortTerm + longTerm, `Short-term: ${shortTerm}, Long-term: ${longTerm}`]
        );
      }
    }

    // Save Real Estate Sale
    if (answers.has_real_estate_sale === 'yes' && answers.real_estate_gain) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income)
         VALUES ($1, $2, 'Real Estate Sale', 'Property Sale', $3)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.real_estate_gain)]
      );
    }

    // Save Rental Income
    if (answers.has_rental_income === 'yes' && answers.rental_income) {
      const netRental = parseCurrency(answers.rental_income) - parseCurrency(answers.rental_expenses);
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income)
         VALUES ($1, $2, 'Rental', 'Rental Property', $3)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, netRental]
      );
    }

    // Save Social Security Benefits
    if (answers.has_social_security === 'yes' && answers.social_security_amount) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income)
         VALUES ($1, $2, 'SSA-1099', 'Social Security', $3)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.social_security_amount) * 0.85]
      );
    }

    // Save Retirement Distribution
    if (answers.has_retirement_distribution === 'yes' && answers.retirement_distribution) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income)
         VALUES ($1, $2, '1099-R', 'Retirement Distribution', $3)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.taxable_retirement_distribution || answers.retirement_distribution)]
      );
    }

    // Save Unemployment
    if (answers.has_unemployment === 'yes' && answers.unemployment_amount) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income)
         VALUES ($1, $2, '1099-G', 'Unemployment', $3)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.unemployment_amount)]
      );
    }

    // Save Gambling Winnings
    if (answers.has_gambling_winnings === 'yes' && answers.gambling_winnings) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income)
         VALUES ($1, $2, 'W-2G', 'Gambling Winnings', $3)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.gambling_winnings)]
      );
    }

    // Save Other Income
    if (answers.has_other_income === 'yes' && answers.other_income_amount) {
      await db.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, other_income, description)
         VALUES ($1, $2, 'Other', 'Other Income', $3, $4)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.other_income_amount), answers.other_income_description || '']
      );
    }

    // Save Deductions
    if (answers.mortgage_interest_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Mortgage Interest', 'Home mortgage interest', $3, true)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.mortgage_interest_amount)]
      );
    }

    if (answers.property_tax_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Property Taxes', 'Real estate property taxes', $3, true)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.property_tax_amount)]
      );
    }

    // Charitable donations - cash
    if (answers.has_cash_charity === 'yes' && answers.cash_charity_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Charitable Donations', 'Cash charitable contributions', $3, true)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.cash_charity_amount)]
      );
    }

    // Charitable donations - non-cash
    if (answers.has_noncash_charity === 'yes' && answers.noncash_charity_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Charitable Donations', 'Non-cash charitable contributions', $3, true)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.noncash_charity_amount)]
      );
    }

    // Charitable miles
    if (answers.has_charity_miles === 'yes' && answers.charity_miles) {
      const charityMilesDeduction = parseInt(answers.charity_miles) * 0.14;
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Charitable Donations', 'Charitable driving (14 cents/mile)', $3, true)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, charityMilesDeduction]
      );
    }

    // State/Local Income Tax
    if (answers.has_state_income_tax === 'yes' && answers.state_income_tax_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'State and Local Taxes', 'State/local income tax', $3, true)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.state_income_tax_amount), 10000)]
      );
    }

    // Sales Tax
    if (answers.has_sales_tax === 'yes' && answers.sales_tax_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'State and Local Taxes', 'Sales tax', $3, true)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.sales_tax_amount), 10000)]
      );
    }

    // Medical expenses
    if (answers.has_medical === 'yes' && answers.medical_expenses_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Medical Expenses', 'Unreimbursed medical expenses', $3, true)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.medical_expenses_amount)]
      );
    }

    // Health insurance premiums
    if (answers.has_health_insurance_premiums === 'yes' && answers.health_insurance_premium_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Medical Expenses', 'Health insurance premiums', $3, true)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.health_insurance_premium_amount)]
      );
    }

    // Student loan interest
    if (answers.has_student_loan_interest === 'yes' && answers.student_loan_interest_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Student Loan Interest', 'Student loan interest paid', $3, false)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.student_loan_interest_amount), 2500)]
      );
    }

    // Educator expenses
    if (answers.is_educator === 'yes' && answers.educator_expenses) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Educator Expenses', 'Classroom supplies and materials', $3, false)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.educator_expenses), 300)]
      );
    }

    // Traditional IRA
    if (answers.has_traditional_ira === 'yes' && answers.traditional_ira_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'IRA Contribution', 'Traditional IRA contribution', $3, false)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.traditional_ira_amount), 7000)]
      );
    }

    // HSA contribution
    if (answers.has_hsa === 'yes' && answers.hsa_contribution) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'HSA Contribution', 'Health Savings Account contribution', $3, false)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.hsa_contribution), 8300)]
      );
    }

    // Self-employed health insurance
    if (answers.has_se_health_insurance === 'yes' && answers.se_health_insurance_amount) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Self-Employed Health Insurance', 'Health insurance for self-employed', $3, false)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.se_health_insurance_amount)]
      );
    }

    // Alimony paid
    if (answers.has_alimony_paid === 'yes' && answers.alimony_paid) {
      await db.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, 'Alimony', 'Alimony paid (pre-2019 divorce)', $3, false)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.alimony_paid)]
      );
    }

    // Gambling losses (limited to winnings)
    if (answers.has_gambling_winnings === 'yes' && answers.gambling_losses) {
      const maxLoss = Math.min(parseCurrency(answers.gambling_losses), parseCurrency(answers.gambling_winnings || 0));
      if (maxLoss > 0) {
        await db.query(
          `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
           VALUES ($1, $2, 'Gambling Losses', 'Gambling losses (limited to winnings)', $3, true)
           ON CONFLICT DO NOTHING`,
          [req.user.id, taxYearId, maxLoss]
        );
      }
    }

    // Save Tax Credits
    // Child Tax Credit
    if (answers.has_child_tax_credit === 'yes' && answers.num_children_under_17) {
      const numChildren = parseInt(answers.num_children_under_17) || 0;
      await db.query(
        `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, amount, description)
         VALUES ($1, $2, 'Child Tax Credit', $3, $4)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, numChildren * 2000, `${numChildren} qualifying children`]
      );
    }

    if (answers.has_childcare === 'yes' && answers.childcare_amount) {
      await db.query(
        `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, amount, description)
         VALUES ($1, $2, 'Child and Dependent Care', $3, 'Childcare expenses credit')
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.childcare_amount) * 0.2, 2100)]
      );
    }

    if (answers.has_education_credit === 'yes' && answers.education_expenses) {
      await db.query(
        `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, amount, description)
         VALUES ($1, $2, 'Education Credit', $3, 'American Opportunity or Lifetime Learning Credit')
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.education_expenses), 2500)]
      );
    }

    // Solar Credit (30% of cost)
    if (answers.has_solar === 'yes' && answers.solar_cost) {
      await db.query(
        `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, amount, description)
         VALUES ($1, $2, 'Residential Clean Energy Credit', $3, 'Solar panel installation (30%)')
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.solar_cost) * 0.30]
      );
    }

    // Energy Improvements Credit
    if (answers.has_energy_improvements === 'yes' && answers.energy_improvement_cost) {
      await db.query(
        `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, amount, description)
         VALUES ($1, $2, 'Energy Efficient Home Improvement', $3, 'Windows, insulation, heat pumps, etc.')
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.energy_improvement_cost) * 0.30, 1200)]
      );
    }

    // Electric Vehicle Credit
    if (answers.has_ev_credit === 'yes' && answers.ev_purchase_price) {
      await db.query(
        `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, amount, description)
         VALUES ($1, $2, 'Clean Vehicle Credit', $3, $4)
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, 7500, `EV VIN: ${answers.ev_vin || 'Not provided'}`]
      );
    }

    // Foreign Tax Credit
    if (answers.has_foreign_tax === 'yes' && answers.foreign_tax_paid) {
      await db.query(
        `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, amount, description)
         VALUES ($1, $2, 'Foreign Tax Credit', $3, 'Foreign taxes paid')
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, parseCurrency(answers.foreign_tax_paid)]
      );
    }

    // Retirement Saver's Credit (estimate at 10% for simplicity)
    if (answers.has_retirement_contribution === 'yes' && answers.retirement_contribution_amount) {
      await db.query(
        `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, amount, description)
         VALUES ($1, $2, 'Retirement Savings Contribution Credit', $3, 'Savers Credit (estimated)')
         ON CONFLICT DO NOTHING`,
        [req.user.id, taxYearId, Math.min(parseCurrency(answers.retirement_contribution_amount) * 0.10, 1000)]
      );
    }

    // Mark interview as completed
    if (interviewId) {
      await db.query(
        `UPDATE tax_interviews SET progress = 100, updated_at = NOW() WHERE id = $1`,
        [interviewId]
      );
    }

    res.json({ success: true, message: 'Tax data saved successfully' });
  } catch (error) {
    console.error('Submit interview error:', error);
    res.status(500).json({ error: 'Failed to save tax data' });
  }
});

// Reset interview - start over
router.post('/interview/reset', async (req, res) => {
  try {
    const { interviewId, taxYearId } = req.body;

    // Delete existing interview
    if (interviewId) {
      await db.query(
        'DELETE FROM tax_interviews WHERE id = $1 AND user_id = $2',
        [interviewId, req.user.id]
      );
    } else if (taxYearId) {
      await db.query(
        'DELETE FROM tax_interviews WHERE tax_year_id = $1 AND user_id = $2',
        [taxYearId, req.user.id]
      );
    }

    res.json({ success: true, message: 'Interview reset successfully' });
  } catch (error) {
    console.error('Reset interview error:', error);
    res.status(500).json({ error: 'Failed to reset interview' });
  }
});

module.exports = router;
