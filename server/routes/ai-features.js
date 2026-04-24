const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const aiService = require('../services/aiService');
const multer = require('multer');
const sharp = require('sharp');

// Compress image to under 5MB for Claude Vision API
async function compressImageForAI(buffer, mimeType) {
  const MAX_SIZE = 4 * 1024 * 1024; // 4MB to be safe (Claude limit is 5MB)

  if (buffer.length <= MAX_SIZE) {
    return { buffer, mimeType };
  }

  console.log(`Compressing image from ${(buffer.length / 1024 / 1024).toFixed(2)}MB...`);

  // Calculate quality reduction needed
  let quality = Math.floor((MAX_SIZE / buffer.length) * 100);
  quality = Math.max(20, Math.min(80, quality)); // Between 20-80%

  try {
    const compressed = await sharp(buffer)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();

    console.log(`Compressed to ${(compressed.length / 1024 / 1024).toFixed(2)}MB (quality: ${quality}%)`);
    return { buffer: compressed, mimeType: 'image/jpeg' };
  } catch (err) {
    console.error('Compression error:', err);
    return { buffer, mimeType }; // Return original if compression fails
  }
}

// Configure multer for file uploads - 50MB limit
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|gif|webp|heic/;
    const extname = allowedTypes.test(file.originalname.toLowerCase().split('.').pop());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname || mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.use(authMiddleware);

// =====================================================
// AI AUDIT RISK SCORER
// =====================================================

// Get all audit risk assessments
router.get('/audit-risk', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ar.*, ty.year as tax_year
       FROM ai_audit_risks ar
       JOIN tax_years ty ON ar.tax_year_id = ty.id
       WHERE ar.user_id = $1
       ORDER BY ar.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get audit risks error:', error);
    res.status(500).json({ error: 'Failed to get audit risk assessments' });
  }
});

// Get single audit risk assessment
router.get('/audit-risk/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ar.*, ty.year as tax_year
       FROM ai_audit_risks ar
       JOIN tax_years ty ON ar.tax_year_id = ty.id
       WHERE ar.id = $1 AND ar.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit risk not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get audit risk error:', error);
    res.status(500).json({ error: 'Failed to get audit risk' });
  }
});

// Generate new audit risk assessment
router.post('/audit-risk/analyze', async (req, res) => {
  try {
    const { taxYearId } = req.body;
    if (!taxYearId) {
      return res.status(400).json({ error: 'Tax year ID is required' });
    }

    // Get user context
    const context = await getUserContext(req.user.id, taxYearId);

    // Call AI service
    const aiResult = await aiService.analyzeAuditRisk(context);

    // Save to database
    const result = await db.query(
      `INSERT INTO ai_audit_risks (user_id, tax_year_id, overall_risk, risk_score, risk_factors, positive_factors, recommendations)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, taxYearId, aiResult.overallRisk || 'unknown', aiResult.riskScore || 50,
       JSON.stringify(aiResult.riskFactors || []), JSON.stringify(aiResult.positiveFactors || []),
       JSON.stringify(aiResult.recommendations || [])]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Analyze audit risk error:', error);
    res.status(500).json({ error: 'Failed to analyze audit risk' });
  }
});

// Delete audit risk assessment
router.delete('/audit-risk/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM ai_audit_risks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete audit risk error:', error);
    res.status(500).json({ error: 'Failed to delete audit risk' });
  }
});

// =====================================================
// AI TAX PLANNING ADVISOR
// =====================================================

// Get all tax planning scenarios
router.get('/tax-planning', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tp.*, ty.year as tax_year
       FROM ai_tax_planning tp
       JOIN tax_years ty ON tp.tax_year_id = ty.id
       WHERE tp.user_id = $1
       ORDER BY tp.potential_savings DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get tax planning error:', error);
    res.status(500).json({ error: 'Failed to get tax planning scenarios' });
  }
});

// Get single tax planning scenario
router.get('/tax-planning/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tp.*, ty.year as tax_year
       FROM ai_tax_planning tp
       JOIN tax_years ty ON tp.tax_year_id = ty.id
       WHERE tp.id = $1 AND tp.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tax planning scenario not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get tax planning error:', error);
    res.status(500).json({ error: 'Failed to get tax planning scenario' });
  }
});

// Generate AI tax planning scenarios
router.post('/tax-planning/generate', async (req, res) => {
  try {
    const { taxYearId } = req.body;
    if (!taxYearId) {
      return res.status(400).json({ error: 'Tax year ID is required' });
    }

    const context = await getUserContext(req.user.id, taxYearId);

    // Generate AI-powered tax planning advice
    const systemPrompt = `You are a tax planning expert. Analyze the taxpayer's situation and suggest tax optimization strategies.

Return a JSON response:
{
  "scenarios": [
    {
      "name": "string",
      "type": "retirement|deduction|credit|investment|health|charitable|business|education",
      "description": "string",
      "currentTax": number,
      "projectedTax": number,
      "potentialSavings": number,
      "priority": "high|medium|low",
      "assumptions": {},
      "actionItems": ["string"]
    }
  ],
  "summary": "string"
}`;

    const userPrompt = `Create tax planning scenarios for this taxpayer:

Filing Status: ${context.filingStatus}
Gross Income: $${context.grossIncome?.toLocaleString()}
Taxable Income: $${(context.grossIncome - (context.standardDeduction || 14600))?.toLocaleString()}
Current Deductions: $${context.itemizedDeductions?.toLocaleString() || 0}
Current Credits: $${context.totalCredits?.toLocaleString() || 0}
Self-Employed: ${context.isSelfEmployed ? 'Yes' : 'No'}
Has Dependents: ${context.dependents?.length > 0 ? 'Yes' : 'No'}

Suggest 5 specific, actionable tax planning strategies to reduce their tax liability.`;

    const response = await aiService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.4 });

    let aiResult = { scenarios: [] };
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse tax planning response:', e);
    }

    // Save scenarios to database
    const savedScenarios = [];
    for (const scenario of (aiResult.scenarios || [])) {
      const result = await db.query(
        `INSERT INTO ai_tax_planning (user_id, tax_year_id, scenario_name, scenario_type, description, current_tax, projected_tax, potential_savings, priority, assumptions, action_items)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [req.user.id, taxYearId, scenario.name, scenario.type || 'general', scenario.description,
         scenario.currentTax || 0, scenario.projectedTax || 0, scenario.potentialSavings || 0,
         scenario.priority || 'medium', JSON.stringify(scenario.assumptions || {}),
         JSON.stringify(scenario.actionItems || [])]
      );
      savedScenarios.push(result.rows[0]);
    }

    res.json({
      success: true,
      summary: aiResult.summary,
      scenarios: savedScenarios
    });
  } catch (error) {
    console.error('Generate tax planning error:', error);
    res.status(500).json({ error: 'Failed to generate tax planning scenarios' });
  }
});

// Create manual tax planning scenario
router.post('/tax-planning', async (req, res) => {
  try {
    const { taxYearId, scenarioName, scenarioType, description, currentTax, projectedTax, potentialSavings, priority, assumptions, actionItems } = req.body;

    const result = await db.query(
      `INSERT INTO ai_tax_planning (user_id, tax_year_id, scenario_name, scenario_type, description, current_tax, projected_tax, potential_savings, priority, assumptions, action_items)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [req.user.id, taxYearId, scenarioName, scenarioType, description, currentTax || 0,
       projectedTax || 0, potentialSavings || 0, priority || 'medium',
       JSON.stringify(assumptions || {}), JSON.stringify(actionItems || [])]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create tax planning error:', error);
    res.status(500).json({ error: 'Failed to create tax planning scenario' });
  }
});

// Update tax planning scenario
router.put('/tax-planning/:id', async (req, res) => {
  try {
    const { scenarioName, scenarioType, description, currentTax, projectedTax, potentialSavings, priority, assumptions, actionItems, isImplemented } = req.body;

    const result = await db.query(
      `UPDATE ai_tax_planning SET
       scenario_name = COALESCE($1, scenario_name),
       scenario_type = COALESCE($2, scenario_type),
       description = COALESCE($3, description),
       current_tax = COALESCE($4, current_tax),
       projected_tax = COALESCE($5, projected_tax),
       potential_savings = COALESCE($6, potential_savings),
       priority = COALESCE($7, priority),
       assumptions = COALESCE($8, assumptions),
       action_items = COALESCE($9, action_items),
       is_implemented = COALESCE($10, is_implemented),
       updated_at = NOW()
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
      [scenarioName, scenarioType, description, currentTax, projectedTax, potentialSavings,
       priority, assumptions ? JSON.stringify(assumptions) : null,
       actionItems ? JSON.stringify(actionItems) : null, isImplemented,
       req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tax planning scenario not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update tax planning error:', error);
    res.status(500).json({ error: 'Failed to update tax planning scenario' });
  }
});

// Delete tax planning scenario
router.delete('/tax-planning/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM ai_tax_planning WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete tax planning error:', error);
    res.status(500).json({ error: 'Failed to delete tax planning scenario' });
  }
});

// =====================================================
// AI RECEIPT SCANNER
// =====================================================

// Get all scanned receipts
router.get('/receipt-scans', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rs.*, ty.year as tax_year
       FROM ai_receipt_scans rs
       JOIN tax_years ty ON rs.tax_year_id = ty.id
       WHERE rs.user_id = $1
       ORDER BY rs.expense_date DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get receipt scans error:', error);
    res.status(500).json({ error: 'Failed to get receipt scans' });
  }
});

// Get single receipt scan
router.get('/receipt-scans/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rs.*, ty.year as tax_year
       FROM ai_receipt_scans rs
       JOIN tax_years ty ON rs.tax_year_id = ty.id
       WHERE rs.id = $1 AND rs.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt scan not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get receipt scan error:', error);
    res.status(500).json({ error: 'Failed to get receipt scan' });
  }
});

// Scan a new receipt
router.post('/receipt-scans/scan', (req, res, next) => {
  upload.single('receipt')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Receipt image is required' });
    }

    const { taxYearId } = req.body;
    if (!taxYearId) {
      return res.status(400).json({ error: 'Tax year ID is required' });
    }

    console.log('Processing receipt:', req.file.originalname, 'Size:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');

    // Compress image if needed (Claude Vision API has 5MB limit)
    const { buffer: compressedBuffer, mimeType } = await compressImageForAI(req.file.buffer, req.file.mimetype);
    const base64Image = compressedBuffer.toString('base64');

    // Use AI to extract receipt data
    console.log('Calling AI to extract receipt data... (image size:', (compressedBuffer.length / 1024 / 1024).toFixed(2), 'MB)');
    const extractedData = await aiService.extractDocumentData(base64Image, 'Receipt', mimeType);
    console.log('AI extraction complete:', extractedData.vendor, extractedData.total);

    // Save to database
    const result = await db.query(
      `INSERT INTO ai_receipt_scans (user_id, tax_year_id, vendor, amount, expense_date, category, description, items, is_tax_deductible, deduction_category, confidence, raw_ocr_data, file_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [req.user.id, taxYearId,
       extractedData.vendor || 'Unknown',
       extractedData.total || 0,
       extractedData.date || new Date().toISOString().split('T')[0],
       extractedData.category || 'Other',
       extractedData.items?.map(i => i.description).join(', ') || 'Scanned receipt',
       JSON.stringify(extractedData.items || []),
       extractedData.taxDeductible || false,
       extractedData.category || 'Other',
       extractedData.confidence || 'medium',
       JSON.stringify(extractedData),
       req.file.originalname]
    );

    res.json({
      success: true,
      receipt: result.rows[0],
      extractedData
    });
  } catch (error) {
    console.error('Scan receipt error:', error);
    res.status(500).json({ error: 'Failed to scan receipt: ' + error.message });
  }
});

// Create manual receipt entry
router.post('/receipt-scans', async (req, res) => {
  try {
    const { taxYearId, vendor, amount, expenseDate, category, description, items, isTaxDeductible, deductionCategory } = req.body;

    const result = await db.query(
      `INSERT INTO ai_receipt_scans (user_id, tax_year_id, vendor, amount, expense_date, category, description, items, is_tax_deductible, deduction_category, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'high')
       RETURNING *`,
      [req.user.id, taxYearId, vendor, amount, expenseDate, category, description,
       JSON.stringify(items || []), isTaxDeductible || false, deductionCategory]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create receipt scan error:', error);
    res.status(500).json({ error: 'Failed to create receipt entry' });
  }
});

// Update receipt scan
router.put('/receipt-scans/:id', async (req, res) => {
  try {
    const { vendor, amount, expenseDate, category, description, items, isTaxDeductible, deductionCategory, isImported } = req.body;

    const result = await db.query(
      `UPDATE ai_receipt_scans SET
       vendor = COALESCE($1, vendor),
       amount = COALESCE($2, amount),
       expense_date = COALESCE($3, expense_date),
       category = COALESCE($4, category),
       description = COALESCE($5, description),
       items = COALESCE($6, items),
       is_tax_deductible = COALESCE($7, is_tax_deductible),
       deduction_category = COALESCE($8, deduction_category),
       is_imported = COALESCE($9, is_imported),
       updated_at = NOW()
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [vendor, amount, expenseDate, category, description,
       items ? JSON.stringify(items) : null, isTaxDeductible, deductionCategory, isImported,
       req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt scan not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update receipt scan error:', error);
    res.status(500).json({ error: 'Failed to update receipt scan' });
  }
});

// Delete receipt scan
router.delete('/receipt-scans/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM ai_receipt_scans WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete receipt scan error:', error);
    res.status(500).json({ error: 'Failed to delete receipt scan' });
  }
});

// Import receipt to expenses
router.post('/receipt-scans/:id/import', async (req, res) => {
  try {
    const receipt = await db.query(
      'SELECT * FROM ai_receipt_scans WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (receipt.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const r = receipt.rows[0];

    // Find or create expense category
    let categoryId;
    const catResult = await db.query(
      'SELECT id FROM expense_categories WHERE LOWER(name) = LOWER($1)',
      [r.category || 'Other']
    );

    if (catResult.rows.length > 0) {
      categoryId = catResult.rows[0].id;
    } else {
      const newCat = await db.query(
        'INSERT INTO expense_categories (name, is_deductible) VALUES ($1, $2) RETURNING id',
        [r.category || 'Other', r.is_tax_deductible]
      );
      categoryId = newCat.rows[0].id;
    }

    // Create expense
    await db.query(
      `INSERT INTO user_expenses (user_id, tax_year_id, category_id, description, amount, expense_date, vendor, is_business_expense)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.user.id, r.tax_year_id, categoryId, r.description, r.amount, r.expense_date, r.vendor, r.is_tax_deductible]
    );

    // Mark receipt as imported
    await db.query(
      'UPDATE ai_receipt_scans SET is_imported = true WHERE id = $1',
      [req.params.id]
    );

    res.json({ success: true, message: 'Receipt imported to expenses' });
  } catch (error) {
    console.error('Import receipt error:', error);
    res.status(500).json({ error: 'Failed to import receipt' });
  }
});

// =====================================================
// AI ESTIMATED TAX CALCULATOR
// =====================================================

// Get all estimated tax calculations
router.get('/estimated-taxes', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT et.*, ty.year as tax_year
       FROM ai_estimated_taxes et
       JOIN tax_years ty ON et.tax_year_id = ty.id
       WHERE et.user_id = $1
       ORDER BY et.due_date ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get estimated taxes error:', error);
    res.status(500).json({ error: 'Failed to get estimated tax calculations' });
  }
});

// Get single estimated tax entry
router.get('/estimated-taxes/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT et.*, ty.year as tax_year
       FROM ai_estimated_taxes et
       JOIN tax_years ty ON et.tax_year_id = ty.id
       WHERE et.id = $1 AND et.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estimated tax entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get estimated tax error:', error);
    res.status(500).json({ error: 'Failed to get estimated tax entry' });
  }
});

// Calculate estimated taxes for a year
router.post('/estimated-taxes/calculate', async (req, res) => {
  try {
    const { taxYearId, estimatedAnnualIncome, estimatedDeductions } = req.body;
    if (!taxYearId) {
      return res.status(400).json({ error: 'Tax year ID is required' });
    }

    // Get tax year info
    const tyResult = await db.query(
      'SELECT year FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const year = tyResult.rows[0].year;
    const context = await getUserContext(req.user.id, taxYearId);

    // Add custom estimates to context
    context.estimatedAnnualIncome = estimatedAnnualIncome;
    context.estimatedDeductions = estimatedDeductions;

    // Call AI service for intelligent analysis
    console.log('Calling AI for estimated tax calculation...');
    const aiResult = await aiService.calculateEstimatedTaxes(context);
    console.log('AI response received:', JSON.stringify(aiResult).substring(0, 200));

    // Extract values from AI or use fallback calculations
    const annualIncome = estimatedAnnualIncome || context.grossIncome || 50000;
    const deductions = estimatedDeductions || context.standardDeduction || 14600;
    const taxableIncome = Math.max(0, annualIncome - deductions);

    // Use AI-calculated tax or fallback to bracket calculation
    let estimatedTax = aiResult.analysis?.totalEstimatedTax || 0;
    let quarterlyPayment = aiResult.analysis?.quarterlyPayment || 0;

    // Fallback calculation if AI didn't provide values
    if (!estimatedTax) {
      const brackets = [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 }
      ];

      let remainingIncome = taxableIncome;
      for (const bracket of brackets) {
        if (remainingIncome <= 0) break;
        const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
        estimatedTax += taxableInBracket * bracket.rate;
        remainingIncome -= taxableInBracket;
      }
      quarterlyPayment = Math.ceil(estimatedTax / 4);
    }

    // Delete existing quarterly estimates
    await db.query(
      'DELETE FROM ai_estimated_taxes WHERE tax_year_id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    // Create quarterly payments with AI recommendations
    const defaultQuarters = [
      { quarter: 1, dueDate: `${year}-04-15` },
      { quarter: 2, dueDate: `${year}-06-15` },
      { quarter: 3, dueDate: `${year}-09-15` },
      { quarter: 4, dueDate: `${year + 1}-01-15` }
    ];

    const savedQuarters = [];
    for (let i = 0; i < defaultQuarters.length; i++) {
      const q = defaultQuarters[i];
      const aiQuarter = aiResult.quarterlyBreakdown?.[i];

      const quarterlyIncome = Math.round(annualIncome * q.quarter / 4);
      const quarterlyDeductions = Math.round(deductions * q.quarter / 4);
      const quarterlyTax = Math.round(estimatedTax * q.quarter / 4);
      const ytdPayments = quarterlyPayment * (q.quarter - 1);
      const payment = aiQuarter?.recommendedPayment || quarterlyPayment;

      // Combine AI recommendations with quarter-specific notes
      const recommendations = [
        ...(aiResult.recommendations || []),
        ...(aiResult.taxSavingOpportunities?.map(o => `${o.strategy}: Save $${o.potentialSavings?.toLocaleString()}`) || []),
        aiQuarter?.notes || ''
      ].filter(r => r);

      const penaltyRisk = aiResult.warnings?.length > 0 ? 'medium' :
                         (ytdPayments >= quarterlyTax * 0.9 ? 'none' : 'low');

      const result = await db.query(
        `INSERT INTO ai_estimated_taxes (user_id, tax_year_id, quarter, due_date, estimated_income, estimated_deductions, estimated_tax, required_payment, ytd_payments, remaining_balance, safe_harbor_amount, penalty_risk, ai_recommendations, calculation_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [req.user.id, taxYearId, q.quarter, q.dueDate, quarterlyIncome, quarterlyDeductions,
         quarterlyTax, payment, ytdPayments, Math.max(0, quarterlyTax - ytdPayments),
         aiResult.safeHarborStrategy?.recommendedAmount || Math.round(payment * 1.1),
         penaltyRisk,
         JSON.stringify(recommendations.slice(0, 5)),
         JSON.stringify({
           effectiveTaxRate: aiResult.analysis?.effectiveTaxRate,
           marginalBracket: aiResult.analysis?.marginalBracket,
           safeHarborMethod: aiResult.safeHarborStrategy?.method,
           aiWarnings: aiResult.warnings
         })]
      );
      savedQuarters.push(result.rows[0]);
    }

    res.json({
      success: true,
      aiAnalysis: {
        effectiveTaxRate: aiResult.analysis?.effectiveTaxRate,
        marginalBracket: aiResult.analysis?.marginalBracket,
        safeHarborStrategy: aiResult.safeHarborStrategy,
        taxSavingOpportunities: aiResult.taxSavingOpportunities,
        warnings: aiResult.warnings
      },
      annualEstimate: {
        income: annualIncome,
        deductions,
        taxableIncome,
        estimatedTax,
        quarterlyPayment
      },
      quarters: savedQuarters
    });
  } catch (error) {
    console.error('Calculate estimated taxes error:', error);
    res.status(500).json({ error: 'Failed to calculate estimated taxes: ' + error.message });
  }
});

// Create/update estimated tax entry
router.post('/estimated-taxes', async (req, res) => {
  try {
    const { taxYearId, quarter, dueDate, estimatedIncome, estimatedDeductions, estimatedTax, requiredPayment, ytdPayments, isPaid, paidAmount, paidDate } = req.body;

    const result = await db.query(
      `INSERT INTO ai_estimated_taxes (user_id, tax_year_id, quarter, due_date, estimated_income, estimated_deductions, estimated_tax, required_payment, ytd_payments, remaining_balance, is_paid, paid_amount, paid_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [req.user.id, taxYearId, quarter, dueDate, estimatedIncome || 0, estimatedDeductions || 0,
       estimatedTax || 0, requiredPayment || 0, ytdPayments || 0,
       Math.max(0, (estimatedTax || 0) - (ytdPayments || 0)),
       isPaid || false, paidAmount || 0, paidDate || null]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create estimated tax error:', error);
    res.status(500).json({ error: 'Failed to create estimated tax entry' });
  }
});

// Update estimated tax entry
router.put('/estimated-taxes/:id', async (req, res) => {
  try {
    const { estimatedIncome, estimatedDeductions, estimatedTax, requiredPayment, ytdPayments, isPaid, paidAmount, paidDate } = req.body;

    const result = await db.query(
      `UPDATE ai_estimated_taxes SET
       estimated_income = COALESCE($1, estimated_income),
       estimated_deductions = COALESCE($2, estimated_deductions),
       estimated_tax = COALESCE($3, estimated_tax),
       required_payment = COALESCE($4, required_payment),
       ytd_payments = COALESCE($5, ytd_payments),
       remaining_balance = COALESCE($6, remaining_balance),
       is_paid = COALESCE($7, is_paid),
       paid_amount = COALESCE($8, paid_amount),
       paid_date = COALESCE($9, paid_date),
       updated_at = NOW()
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [estimatedIncome, estimatedDeductions, estimatedTax, requiredPayment, ytdPayments,
       Math.max(0, (estimatedTax || 0) - (ytdPayments || 0)),
       isPaid, paidAmount, paidDate, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estimated tax entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update estimated tax error:', error);
    res.status(500).json({ error: 'Failed to update estimated tax entry' });
  }
});

// Delete estimated tax entry
router.delete('/estimated-taxes/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM ai_estimated_taxes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete estimated tax error:', error);
    res.status(500).json({ error: 'Failed to delete estimated tax entry' });
  }
});

// =====================================================
// AI DEDUCTION FINDER
// =====================================================

// Get all deduction finder results
router.get('/deduction-finder', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT df.*, ty.year as tax_year
       FROM ai_deduction_finder df
       JOIN tax_years ty ON df.tax_year_id = ty.id
       WHERE df.user_id = $1 AND df.is_dismissed = false
       ORDER BY df.estimated_amount DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get deduction finder error:', error);
    res.status(500).json({ error: 'Failed to get deduction finder results' });
  }
});

// Get single deduction finding
router.get('/deduction-finder/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT df.*, ty.year as tax_year
       FROM ai_deduction_finder df
       JOIN tax_years ty ON df.tax_year_id = ty.id
       WHERE df.id = $1 AND df.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deduction not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get deduction error:', error);
    res.status(500).json({ error: 'Failed to get deduction' });
  }
});

// Find new deductions using AI
router.post('/deduction-finder/scan', async (req, res) => {
  try {
    const { taxYearId, additionalInfo = {} } = req.body;
    if (!taxYearId) {
      return res.status(400).json({ error: 'Tax year ID is required' });
    }

    const context = await getUserContext(req.user.id, taxYearId);
    Object.assign(context, additionalInfo);

    const aiResult = await aiService.findMissedDeductions(context);

    // Clear old findings
    await db.query(
      'DELETE FROM ai_deduction_finder WHERE tax_year_id = $1 AND user_id = $2 AND is_claimed = false',
      [taxYearId, req.user.id]
    );

    // Save new findings
    const savedDeductions = [];
    for (const ded of (aiResult.missedDeductions || [])) {
      const result = await db.query(
        `INSERT INTO ai_deduction_finder (user_id, tax_year_id, category, deduction_name, description, estimated_amount, requirements, irs_reference, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [req.user.id, taxYearId, ded.category || 'General', ded.description?.substring(0, 100) || 'Potential Deduction',
         ded.description, ded.estimatedAmount || 0, ded.requirements || '', ded.irsReference || '', 'medium']
      );
      savedDeductions.push(result.rows[0]);
    }

    res.json({
      success: true,
      totalPotentialSavings: aiResult.totalPotentialSavings || 0,
      recommendations: aiResult.recommendations || [],
      deductions: savedDeductions
    });
  } catch (error) {
    console.error('Find deductions error:', error);
    res.status(500).json({ error: 'Failed to find deductions' });
  }
});

// Update deduction (claim or dismiss)
router.put('/deduction-finder/:id', async (req, res) => {
  try {
    const { isClaimed, isDismissed, estimatedAmount, description } = req.body;

    const result = await db.query(
      `UPDATE ai_deduction_finder SET
       is_claimed = COALESCE($1, is_claimed),
       is_dismissed = COALESCE($2, is_dismissed),
       estimated_amount = COALESCE($3, estimated_amount),
       description = COALESCE($4, description),
       updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [isClaimed, isDismissed, estimatedAmount, description, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deduction not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update deduction error:', error);
    res.status(500).json({ error: 'Failed to update deduction' });
  }
});

// Delete deduction finding
router.delete('/deduction-finder/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM ai_deduction_finder WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete deduction error:', error);
    res.status(500).json({ error: 'Failed to delete deduction' });
  }
});

// =====================================================
// HELPER FUNCTION
// =====================================================
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
    `SELECT first_name, relationship, EXTRACT(YEAR FROM AGE(date_of_birth)) as age, is_student, is_disabled
     FROM dependents WHERE tax_year_id = $1`,
    [taxYearId]
  ) : { rows: [] };

  const expenses = taxYearId ? await db.query(
    `SELECT ec.name as category, ue.description, ue.amount, ue.vendor
     FROM user_expenses ue
     LEFT JOIN expense_categories ec ON ue.category_id = ec.id
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

module.exports = router;
