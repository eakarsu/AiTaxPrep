const { pool } = require('../config/database');
require('dotenv').config();

async function seedAIFeatures() {
  try {
    console.log('Seeding AI features data...');

    // Get existing users and tax years
    const usersResult = await pool.query('SELECT id FROM users ORDER BY id LIMIT 15');
    const taxYearsResult = await pool.query('SELECT id, user_id FROM tax_years ORDER BY id LIMIT 15');

    if (usersResult.rows.length === 0 || taxYearsResult.rows.length === 0) {
      console.log('No users or tax years found. Please run the main seed first.');
      process.exit(1);
    }

    const users = usersResult.rows.map(r => r.id);
    const taxYears = taxYearsResult.rows;

    // =====================================================
    // SEED AI AUDIT RISK SCORES (15+ entries)
    // =====================================================
    console.log('\nSeeding AI Audit Risk Scores...');
    const auditRiskInserts = [
      {
        user_idx: 0, overall_risk: 'low', risk_score: 15,
        risk_factors: [
          { factor: 'Consistent W-2 Income', description: 'Primary income from employment is well-documented', severity: 'low', mitigation: 'Continue maintaining accurate records' }
        ],
        positive_factors: ['W-2 employment income', 'Standard deductions', 'Consistent filing history'],
        recommendations: ['Continue maintaining thorough records', 'Keep receipts for all deductions']
      },
      {
        user_idx: 1, overall_risk: 'low', risk_score: 22,
        risk_factors: [
          { factor: 'Single Filer', description: 'No complex household situations', severity: 'low', mitigation: 'Standard filing should be straightforward' }
        ],
        positive_factors: ['Simple return', 'W-2 only income', 'No itemized deductions'],
        recommendations: ['Consider maximizing retirement contributions', 'Track potential deductions']
      },
      {
        user_idx: 2, overall_risk: 'medium', risk_score: 45,
        risk_factors: [
          { factor: 'Self-Employment Income', description: '1099-NEC income increases scrutiny', severity: 'medium', mitigation: 'Keep detailed records of all business expenses' },
          { factor: 'Mixed Income Types', description: 'Both W-2 and 1099 income', severity: 'low', mitigation: 'Ensure proper categorization' }
        ],
        positive_factors: ['Consistent income reporting', 'Documentation of expenses'],
        recommendations: ['Maintain separate business account', 'Document all business expenses with receipts', 'Consider quarterly estimated payments']
      },
      {
        user_idx: 3, overall_risk: 'low', risk_score: 18,
        risk_factors: [
          { factor: 'Education Credits', description: 'Education credits require verification', severity: 'low', mitigation: 'Keep 1098-T forms and receipts' }
        ],
        positive_factors: ['Clear dependent documentation', 'Consistent filing', 'W-2 only income'],
        recommendations: ['Keep all education expense receipts', 'Document dependent qualifications']
      },
      {
        user_idx: 4, overall_risk: 'low', risk_score: 12,
        risk_factors: [
          { factor: 'Educator Expenses', description: 'Small above-the-line deduction', severity: 'low', mitigation: 'Keep receipts for classroom supplies' }
        ],
        positive_factors: ['Simple W-2 return', 'Standard deduction', 'Clear employment'],
        recommendations: ['Track all classroom expenses', 'Keep detailed records']
      },
      {
        user_idx: 5, overall_risk: 'medium', risk_score: 38,
        risk_factors: [
          { factor: 'High Income', description: 'Income above $100,000 receives more scrutiny', severity: 'medium', mitigation: 'Ensure all income is properly reported' },
          { factor: 'Dependent Care', description: 'Elderly dependent claims require documentation', severity: 'low', mitigation: 'Keep medical and care expense records' }
        ],
        positive_factors: ['W-2 income only', 'Good documentation', 'Consistent filing'],
        recommendations: ['Document all dependent expenses', 'Keep medical records organized']
      },
      {
        user_idx: 6, overall_risk: 'low', risk_score: 20,
        risk_factors: [
          { factor: 'Multiple Dependents', description: 'Child Tax Credits require verification', severity: 'low', mitigation: 'Keep birth certificates and SSN cards' }
        ],
        positive_factors: ['Joint filing with spouse', 'Standard deduction', 'W-2 income'],
        recommendations: ['Keep dependent documentation current', 'Track childcare expenses']
      },
      {
        user_idx: 7, overall_risk: 'medium', risk_score: 52,
        risk_factors: [
          { factor: 'Solar Energy Credit', description: 'Large energy credits may trigger review', severity: 'medium', mitigation: 'Keep all installation documentation and receipts' },
          { factor: 'Self-Employed Health Insurance', description: 'Deduction requires proper substantiation', severity: 'low', mitigation: 'Keep premium payment records' }
        ],
        positive_factors: ['Clear documentation', 'Established energy credit'],
        recommendations: ['Keep solar installation contract', 'Document all energy credit qualifications', 'Maintain insurance premium records']
      },
      {
        user_idx: 8, overall_risk: 'medium', risk_score: 48,
        risk_factors: [
          { factor: 'Electric Vehicle Credit', description: 'EV credits have specific requirements', severity: 'medium', mitigation: 'Keep purchase agreement and VIN documentation' },
          { factor: 'Business Mileage', description: 'Vehicle deductions require detailed logs', severity: 'medium', mitigation: 'Keep mileage log with dates and purposes' }
        ],
        positive_factors: ['W-2 primary income', 'Documented vehicle purchase'],
        recommendations: ['Maintain detailed mileage log', 'Keep EV purchase documentation', 'Document business vs personal use']
      },
      {
        user_idx: 9, overall_risk: 'low', risk_score: 25,
        risk_factors: [
          { factor: 'Foreign Tax Credit', description: 'Foreign income and taxes need documentation', severity: 'low', mitigation: 'Keep foreign tax payment records' }
        ],
        positive_factors: ['High W-2 income', 'Professional employer', 'Clean filing history'],
        recommendations: ['Document foreign investment income', 'Keep foreign tax payment records']
      },
      {
        user_idx: 10, overall_risk: 'medium', risk_score: 42,
        risk_factors: [
          { factor: 'High Income Joint Return', description: 'Combined income above $200K increases scrutiny', severity: 'medium', mitigation: 'Thorough documentation of all income and deductions' },
          { factor: 'Adoption Credit', description: 'Large credit requires extensive documentation', severity: 'medium', mitigation: 'Keep all adoption expense receipts and legal documents' }
        ],
        positive_factors: ['Legal profession documentation', 'Clear W-2 income', 'Professional tax preparation'],
        recommendations: ['Keep adoption documents organized', 'Document all legal fees', 'Maintain detailed expense records']
      },
      {
        user_idx: 11, overall_risk: 'low', risk_score: 28,
        risk_factors: [
          { factor: 'Multiple Children', description: 'Three child tax credits', severity: 'low', mitigation: 'Keep dependent documentation current' },
          { factor: 'Medical Expenses', description: 'Large medical deductions need substantiation', severity: 'medium', mitigation: 'Keep all medical bills and insurance statements' }
        ],
        positive_factors: ['Clear family situation', 'Documented medical expenses', 'W-2 income'],
        recommendations: ['Organize medical expense records', 'Keep dependent documentation', 'Track all out-of-pocket medical costs']
      },
      {
        user_idx: 12, overall_risk: 'medium', risk_score: 55,
        risk_factors: [
          { factor: 'Large Charitable Donations', description: 'Donations exceeding 10% of income trigger review', severity: 'medium', mitigation: 'Keep donation receipts and acknowledgment letters' },
          { factor: 'Premium Tax Credit', description: 'ACA credit requires income verification', severity: 'low', mitigation: 'Keep marketplace documentation' }
        ],
        positive_factors: ['Documented donations', 'Insurance through marketplace'],
        recommendations: ['Get written acknowledgments for donations over $250', 'Keep all charity receipts', 'Document marketplace insurance']
      },
      {
        user_idx: 13, overall_risk: 'low', risk_score: 10,
        risk_factors: [
          { factor: 'Low Income Return', description: 'Simple return with minimal complexity', severity: 'low', mitigation: 'Standard filing procedures' }
        ],
        positive_factors: ['Simple return', 'Investment income only', 'No itemized deductions'],
        recommendations: ['Consider tax-advantaged accounts', 'Track investment basis accurately']
      },
      {
        user_idx: 14, overall_risk: 'medium', risk_score: 40,
        risk_factors: [
          { factor: 'Head of Household', description: 'Status requires qualifying person', severity: 'low', mitigation: 'Document dependent qualifications' },
          { factor: 'Vehicle Expenses', description: 'Business mileage needs documentation', severity: 'medium', mitigation: 'Maintain detailed mileage log' }
        ],
        positive_factors: ['Clear dependent situation', 'W-2 income', 'Documented expenses'],
        recommendations: ['Keep mileage log up to date', 'Document dependent residency', 'Track all business vehicle use']
      }
    ];

    for (const risk of auditRiskInserts) {
      const taxYear = taxYears.find(ty => ty.user_id === users[risk.user_idx]);
      if (taxYear) {
        await pool.query(
          `INSERT INTO ai_audit_risks (user_id, tax_year_id, overall_risk, risk_score, risk_factors, positive_factors, recommendations)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [users[risk.user_idx], taxYear.id, risk.overall_risk, risk.risk_score,
           JSON.stringify(risk.risk_factors), JSON.stringify(risk.positive_factors), JSON.stringify(risk.recommendations)]
        );
      }
    }
    console.log('AI Audit Risks seeded: 15');

    // =====================================================
    // SEED AI TAX PLANNING SCENARIOS (15+ entries)
    // =====================================================
    console.log('\nSeeding AI Tax Planning Scenarios...');
    const taxPlanningInserts = [
      { user_idx: 0, scenario_name: 'Maximize 401(k) Contributions', scenario_type: 'retirement', description: 'Increase 401(k) contributions to the maximum $23,000 limit', current_tax: 7047, projected_tax: 5247, potential_savings: 1800, priority: 'high', assumptions: { current_contribution: 6000, max_contribution: 23000 }, action_items: ['Increase 401(k) deferral percentage', 'Set up automatic increases', 'Review investment allocations'] },
      { user_idx: 0, scenario_name: 'HSA Strategy', scenario_type: 'health', description: 'Open and max out HSA if eligible for HDHP', current_tax: 7047, projected_tax: 6247, potential_savings: 800, priority: 'medium', assumptions: { family_coverage: true, max_contribution: 8300 }, action_items: ['Switch to high-deductible health plan', 'Open HSA account', 'Set up automatic contributions'] },
      { user_idx: 1, scenario_name: 'Traditional IRA Contribution', scenario_type: 'retirement', description: 'Contribute to Traditional IRA for tax deduction', current_tax: 7304, projected_tax: 5764, potential_savings: 1540, priority: 'high', assumptions: { ira_contribution: 7000 }, action_items: ['Open Traditional IRA', 'Make contribution before April deadline', 'Consider automatic monthly contributions'] },
      { user_idx: 2, scenario_name: 'Home Office Deduction', scenario_type: 'deduction', description: 'Claim simplified home office deduction for freelance work', current_tax: 13946, projected_tax: 12746, potential_savings: 1200, priority: 'medium', assumptions: { sqft: 200, rate: 5 }, action_items: ['Measure dedicated office space', 'Document regular business use', 'Keep utility bills'] },
      { user_idx: 2, scenario_name: 'SEP-IRA for Self-Employment', scenario_type: 'retirement', description: 'Open SEP-IRA for self-employment income', current_tax: 13946, projected_tax: 11446, potential_savings: 2500, priority: 'high', assumptions: { se_income: 8500, contribution_rate: 0.25 }, action_items: ['Open SEP-IRA account', 'Calculate maximum contribution', 'Make contribution before tax deadline'] },
      { user_idx: 3, scenario_name: 'Education Expense Optimization', scenario_type: 'education', description: 'Maximize American Opportunity Credit', current_tax: 6696, projected_tax: 4196, potential_savings: 2500, priority: 'high', assumptions: { eligible_expenses: 4000 }, action_items: ['Track all qualified education expenses', 'Keep 1098-T form', 'Document book and supply costs'] },
      { user_idx: 4, scenario_name: 'Educator Expense Deduction', scenario_type: 'deduction', description: 'Claim full $300 educator expense deduction', current_tax: 4602, projected_tax: 4536, potential_savings: 66, priority: 'low', assumptions: { max_deduction: 300 }, action_items: ['Keep receipts for classroom supplies', 'Document purchases throughout year', 'Track all unreimbursed expenses'] },
      { user_idx: 5, scenario_name: 'Charitable Donation Bunching', scenario_type: 'charitable', description: 'Bunch two years of donations to exceed standard deduction', current_tax: 17892, projected_tax: 15392, potential_savings: 2500, priority: 'high', assumptions: { annual_donation: 8000, bunched_amount: 16000 }, action_items: ['Plan donations for alternating years', 'Consider donor-advised fund', 'Document all donations'] },
      { user_idx: 6, scenario_name: 'Dependent Care FSA', scenario_type: 'benefits', description: 'Maximize Dependent Care FSA contributions', current_tax: 3494, projected_tax: 2394, potential_savings: 1100, priority: 'high', assumptions: { fsa_max: 5000 }, action_items: ['Enroll in Dependent Care FSA', 'Estimate annual childcare costs', 'Set up automatic deductions'] },
      { user_idx: 7, scenario_name: 'Additional Solar Credits', scenario_type: 'energy', description: 'Add battery storage to solar system for additional credit', current_tax: 3014, projected_tax: 1514, potential_savings: 1500, priority: 'medium', assumptions: { battery_cost: 5000 }, action_items: ['Research battery storage options', 'Get quotes from installers', 'Document all installation costs'] },
      { user_idx: 8, scenario_name: 'Maximize EV Credit', scenario_type: 'vehicle', description: 'Ensure all EV credit requirements are met', current_tax: 5218, projected_tax: -2282, potential_savings: 7500, priority: 'high', assumptions: { credit_amount: 7500 }, action_items: ['Verify VIN eligibility', 'Confirm income limits', 'Keep purchase documentation'] },
      { user_idx: 9, scenario_name: 'Backdoor Roth Strategy', scenario_type: 'retirement', description: 'Use backdoor Roth conversion for tax-free growth', current_tax: 15106, projected_tax: 15106, potential_savings: 0, priority: 'medium', assumptions: { conversion_amount: 7000, future_tax_savings: 'significant' }, action_items: ['Contribute to Traditional IRA', 'Convert to Roth IRA', 'Report conversion properly'] },
      { user_idx: 10, scenario_name: 'Qualified Business Income', scenario_type: 'deduction', description: 'Evaluate QBI deduction eligibility', current_tax: 19374, projected_tax: 17374, potential_savings: 2000, priority: 'medium', assumptions: { qbi_eligible_income: 10000 }, action_items: ['Review income sources', 'Consult tax advisor', 'Document business income'] },
      { user_idx: 11, scenario_name: 'Child Tax Credit Optimization', scenario_type: 'credit', description: 'Ensure all three children maximize CTC', current_tax: 4926, projected_tax: -1074, potential_savings: 6000, priority: 'high', assumptions: { num_children: 3, credit_per_child: 2000 }, action_items: ['Verify child qualifications', 'Document dependent status', 'Review income limits'] },
      { user_idx: 12, scenario_name: 'Premium Tax Credit Reconciliation', scenario_type: 'health', description: 'Optimize marketplace insurance subsidy', current_tax: 10904, projected_tax: 8504, potential_savings: 2400, priority: 'high', assumptions: { estimated_ptc: 2400 }, action_items: ['Update income estimate', 'Review silver plan options', 'Consider CSR eligibility'] },
      { user_idx: 13, scenario_name: 'Tax Loss Harvesting', scenario_type: 'investment', description: 'Harvest investment losses to offset gains', current_tax: 0, projected_tax: 0, potential_savings: 660, priority: 'medium', assumptions: { loss_harvest: 3000 }, action_items: ['Review portfolio for losses', 'Sell losing positions', 'Avoid wash sale rules'] },
      { user_idx: 14, scenario_name: 'Vehicle Depreciation', scenario_type: 'deduction', description: 'Claim Section 179 depreciation for work vehicle', current_tax: 2944, projected_tax: 1944, potential_savings: 1000, priority: 'medium', assumptions: { vehicle_cost: 25000, business_use: 0.6 }, action_items: ['Document business use percentage', 'Keep mileage log', 'Track all vehicle expenses'] }
    ];

    for (const plan of taxPlanningInserts) {
      const taxYear = taxYears.find(ty => ty.user_id === users[plan.user_idx]);
      if (taxYear) {
        await pool.query(
          `INSERT INTO ai_tax_planning (user_id, tax_year_id, scenario_name, scenario_type, description, current_tax, projected_tax, potential_savings, priority, assumptions, action_items)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT DO NOTHING`,
          [users[plan.user_idx], taxYear.id, plan.scenario_name, plan.scenario_type, plan.description,
           plan.current_tax, plan.projected_tax, plan.potential_savings, plan.priority,
           JSON.stringify(plan.assumptions), JSON.stringify(plan.action_items)]
        );
      }
    }
    console.log('AI Tax Planning Scenarios seeded: 17');

    // =====================================================
    // SEED AI RECEIPT SCANS (15+ entries)
    // =====================================================
    console.log('\nSeeding AI Receipt Scans...');
    const receiptInserts = [
      { user_idx: 0, vendor: 'Office Depot', amount: 156.78, date: '2024-02-15', category: 'Office Supplies', description: 'Printer paper, ink cartridges, pens', items: [{ desc: 'Paper (5 reams)', amount: 45.99 }, { desc: 'Ink cartridges', amount: 89.99 }, { desc: 'Pen set', amount: 20.80 }], is_deductible: true, deduction_category: 'Business Expenses', confidence: 'high' },
      { user_idx: 0, vendor: 'Best Buy', amount: 1299.99, date: '2024-01-20', category: 'Equipment', description: 'MacBook Air for work', items: [{ desc: 'MacBook Air M2', amount: 1299.99 }], is_deductible: true, deduction_category: 'Business Equipment', confidence: 'high' },
      { user_idx: 1, vendor: 'Delta Airlines', amount: 487.50, date: '2024-03-10', category: 'Travel', description: 'Flight to client meeting in NYC', items: [{ desc: 'Round-trip airfare LAX-JFK', amount: 487.50 }], is_deductible: true, deduction_category: 'Travel Expenses', confidence: 'high' },
      { user_idx: 1, vendor: 'Marriott Hotels', amount: 342.18, date: '2024-03-11', category: 'Lodging', description: 'Hotel for business trip', items: [{ desc: '2 nights lodging', amount: 298.00 }, { desc: 'Taxes and fees', amount: 44.18 }], is_deductible: true, deduction_category: 'Travel Expenses', confidence: 'high' },
      { user_idx: 2, vendor: 'Uber', amount: 45.67, date: '2024-04-05', category: 'Transportation', description: 'Ride to client meeting', items: [{ desc: 'Uber ride downtown', amount: 45.67 }], is_deductible: true, deduction_category: 'Business Transportation', confidence: 'high' },
      { user_idx: 2, vendor: 'Steakhouse Restaurant', amount: 127.84, date: '2024-04-05', category: 'Meals', description: 'Client dinner meeting', items: [{ desc: 'Dinner for 2', amount: 98.50 }, { desc: 'Tax and tip', amount: 29.34 }], is_deductible: true, deduction_category: 'Business Meals (50%)', confidence: 'medium' },
      { user_idx: 3, vendor: 'Amazon', amount: 234.56, date: '2024-02-28', category: 'Office Supplies', description: 'Home office supplies', items: [{ desc: 'Monitor stand', amount: 45.99 }, { desc: 'Keyboard', amount: 89.99 }, { desc: 'Mouse', amount: 49.99 }, { desc: 'Desk organizer', amount: 48.59 }], is_deductible: true, deduction_category: 'Home Office', confidence: 'high' },
      { user_idx: 4, vendor: 'Teachers Supply Store', amount: 287.45, date: '2024-08-15', category: 'Education', description: 'Classroom supplies', items: [{ desc: 'Art supplies', amount: 89.99 }, { desc: 'Books', amount: 125.46 }, { desc: 'Decorations', amount: 72.00 }], is_deductible: true, deduction_category: 'Educator Expenses', confidence: 'high' },
      { user_idx: 5, vendor: 'Goodwill', amount: 500.00, date: '2024-12-20', category: 'Charitable', description: 'Clothing and household donation', items: [{ desc: 'Clothing donation', amount: 300.00 }, { desc: 'Household items', amount: 200.00 }], is_deductible: true, deduction_category: 'Charitable Donations', confidence: 'medium' },
      { user_idx: 6, vendor: 'CVS Pharmacy', amount: 156.89, date: '2024-05-10', category: 'Medical', description: 'Prescription medications', items: [{ desc: 'Prescription 1', amount: 45.00 }, { desc: 'Prescription 2', amount: 78.89 }, { desc: 'OTC medications', amount: 33.00 }], is_deductible: true, deduction_category: 'Medical Expenses', confidence: 'high' },
      { user_idx: 7, vendor: 'Shell Gas Station', amount: 67.45, date: '2024-06-15', category: 'Vehicle', description: 'Gas for business travel', items: [{ desc: 'Regular unleaded 18.5 gal', amount: 67.45 }], is_deductible: true, deduction_category: 'Vehicle Expenses', confidence: 'high' },
      { user_idx: 8, vendor: 'Coursera', amount: 399.00, date: '2024-02-01', category: 'Education', description: 'Professional certification course', items: [{ desc: 'Data Science Certificate', amount: 399.00 }], is_deductible: true, deduction_category: 'Professional Development', confidence: 'high' },
      { user_idx: 9, vendor: 'WeWork', amount: 450.00, date: '2024-03-01', category: 'Rent', description: 'Coworking space monthly fee', items: [{ desc: 'Hot desk membership', amount: 450.00 }], is_deductible: true, deduction_category: 'Office Rent', confidence: 'high' },
      { user_idx: 10, vendor: 'Legal Services LLC', amount: 1500.00, date: '2024-01-15', category: 'Professional', description: 'Legal consultation fees', items: [{ desc: 'Contract review', amount: 750.00 }, { desc: 'Legal advice', amount: 750.00 }], is_deductible: true, deduction_category: 'Professional Services', confidence: 'high' },
      { user_idx: 11, vendor: 'Hospital Bill', amount: 2345.67, date: '2024-04-20', category: 'Medical', description: 'Surgery copay and deductible', items: [{ desc: 'Surgery copay', amount: 1500.00 }, { desc: 'Deductible', amount: 845.67 }], is_deductible: true, deduction_category: 'Medical Expenses', confidence: 'high' },
      { user_idx: 12, vendor: 'Red Cross', amount: 250.00, date: '2024-11-15', category: 'Charitable', description: 'Disaster relief donation', items: [{ desc: 'Hurricane relief donation', amount: 250.00 }], is_deductible: true, deduction_category: 'Charitable Donations', confidence: 'high' }
    ];

    for (const receipt of receiptInserts) {
      const taxYear = taxYears.find(ty => ty.user_id === users[receipt.user_idx]);
      if (taxYear) {
        await pool.query(
          `INSERT INTO ai_receipt_scans (user_id, tax_year_id, vendor, amount, expense_date, category, description, items, is_tax_deductible, deduction_category, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT DO NOTHING`,
          [users[receipt.user_idx], taxYear.id, receipt.vendor, receipt.amount, receipt.date,
           receipt.category, receipt.description, JSON.stringify(receipt.items),
           receipt.is_deductible, receipt.deduction_category, receipt.confidence]
        );
      }
    }
    console.log('AI Receipt Scans seeded: 16');

    // =====================================================
    // SEED AI ESTIMATED TAX CALCULATIONS (15+ entries)
    // =====================================================
    console.log('\nSeeding AI Estimated Tax Calculations...');
    const estimatedTaxInserts = [
      { user_idx: 0, quarter: 1, due_date: '2024-04-15', estimated_income: 21362, estimated_deductions: 7300, estimated_tax: 1762, required_payment: 1762, ytd_payments: 0, remaining_balance: 1762, safe_harbor_amount: 1850, penalty_risk: 'none', is_paid: true, paid_amount: 1800, paid_date: '2024-04-10' },
      { user_idx: 0, quarter: 2, due_date: '2024-06-15', estimated_income: 42725, estimated_deductions: 14600, estimated_tax: 3524, required_payment: 1762, ytd_payments: 1800, remaining_balance: 1724, safe_harbor_amount: 1850, penalty_risk: 'none', is_paid: true, paid_amount: 1800, paid_date: '2024-06-10' },
      { user_idx: 0, quarter: 3, due_date: '2024-09-15', estimated_income: 64087, estimated_deductions: 21900, estimated_tax: 5286, required_payment: 1762, ytd_payments: 3600, remaining_balance: 1686, safe_harbor_amount: 1850, penalty_risk: 'none', is_paid: true, paid_amount: 1700, paid_date: '2024-09-12' },
      { user_idx: 0, quarter: 4, due_date: '2025-01-15', estimated_income: 85450, estimated_deductions: 29200, estimated_tax: 7047, required_payment: 1761, ytd_payments: 5300, remaining_balance: 1747, safe_harbor_amount: 1850, penalty_risk: 'low', is_paid: false, paid_amount: 0, paid_date: null },
      { user_idx: 2, quarter: 1, due_date: '2024-04-15', estimated_income: 25875, estimated_deductions: 3650, estimated_tax: 3487, required_payment: 3487, ytd_payments: 0, remaining_balance: 3487, safe_harbor_amount: 3650, penalty_risk: 'medium', is_paid: true, paid_amount: 3500, paid_date: '2024-04-14' },
      { user_idx: 2, quarter: 2, due_date: '2024-06-15', estimated_income: 51750, estimated_deductions: 7300, estimated_tax: 6973, required_payment: 3486, ytd_payments: 3500, remaining_balance: 3473, safe_harbor_amount: 3650, penalty_risk: 'none', is_paid: true, paid_amount: 3500, paid_date: '2024-06-14' },
      { user_idx: 2, quarter: 3, due_date: '2024-09-15', estimated_income: 77625, estimated_deductions: 10950, estimated_tax: 10460, required_payment: 3487, ytd_payments: 7000, remaining_balance: 3460, safe_harbor_amount: 3650, penalty_risk: 'none', is_paid: true, paid_amount: 3500, paid_date: '2024-09-10' },
      { user_idx: 2, quarter: 4, due_date: '2025-01-15', estimated_income: 103500, estimated_deductions: 14600, estimated_tax: 13946, required_payment: 3486, ytd_payments: 10500, remaining_balance: 3446, safe_harbor_amount: 3650, penalty_risk: 'low', is_paid: false, paid_amount: 0, paid_date: null },
      { user_idx: 5, quarter: 1, due_date: '2024-04-15', estimated_income: 30000, estimated_deductions: 3650, estimated_tax: 4473, required_payment: 4473, ytd_payments: 0, remaining_balance: 4473, safe_harbor_amount: 4700, penalty_risk: 'none', is_paid: true, paid_amount: 4500, paid_date: '2024-04-12' },
      { user_idx: 5, quarter: 2, due_date: '2024-06-15', estimated_income: 60000, estimated_deductions: 7300, estimated_tax: 8946, required_payment: 4473, ytd_payments: 4500, remaining_balance: 4446, safe_harbor_amount: 4700, penalty_risk: 'none', is_paid: true, paid_amount: 4500, paid_date: '2024-06-12' },
      { user_idx: 7, quarter: 1, due_date: '2024-04-15', estimated_income: 12000, estimated_deductions: 3650, estimated_tax: 754, required_payment: 754, ytd_payments: 0, remaining_balance: 754, safe_harbor_amount: 800, penalty_risk: 'none', is_paid: true, paid_amount: 800, paid_date: '2024-04-15' },
      { user_idx: 7, quarter: 2, due_date: '2024-06-15', estimated_income: 24000, estimated_deductions: 7300, estimated_tax: 1507, required_payment: 753, ytd_payments: 800, remaining_balance: 707, safe_harbor_amount: 800, penalty_risk: 'none', is_paid: true, paid_amount: 800, paid_date: '2024-06-15' },
      { user_idx: 9, quarter: 1, due_date: '2024-04-15', estimated_income: 27500, estimated_deductions: 3650, estimated_tax: 3776, required_payment: 3776, ytd_payments: 0, remaining_balance: 3776, safe_harbor_amount: 3960, penalty_risk: 'none', is_paid: true, paid_amount: 4000, paid_date: '2024-04-10' },
      { user_idx: 9, quarter: 2, due_date: '2024-06-15', estimated_income: 55000, estimated_deductions: 7300, estimated_tax: 7553, required_payment: 3777, ytd_payments: 4000, remaining_balance: 3553, safe_harbor_amount: 3960, penalty_risk: 'none', is_paid: true, paid_amount: 4000, paid_date: '2024-06-10' },
      { user_idx: 10, quarter: 1, due_date: '2024-04-15', estimated_income: 36250, estimated_deductions: 7300, estimated_tax: 4844, required_payment: 4844, ytd_payments: 0, remaining_balance: 4844, safe_harbor_amount: 5080, penalty_risk: 'none', is_paid: true, paid_amount: 5000, paid_date: '2024-04-08' },
      { user_idx: 10, quarter: 2, due_date: '2024-06-15', estimated_income: 72500, estimated_deductions: 14600, estimated_tax: 9687, required_payment: 4843, ytd_payments: 5000, remaining_balance: 4687, safe_harbor_amount: 5080, penalty_risk: 'none', is_paid: true, paid_amount: 5000, paid_date: '2024-06-08' }
    ];

    for (const est of estimatedTaxInserts) {
      const taxYear = taxYears.find(ty => ty.user_id === users[est.user_idx]);
      if (taxYear) {
        const ai_recommendations = [
          'Pay estimated taxes on time to avoid penalties',
          'Consider increasing withholding if self-employment income grows',
          'Use safe harbor rule (100% of prior year tax) to avoid underpayment penalty'
        ];
        await pool.query(
          `INSERT INTO ai_estimated_taxes (user_id, tax_year_id, quarter, due_date, estimated_income, estimated_deductions, estimated_tax, required_payment, ytd_payments, remaining_balance, safe_harbor_amount, penalty_risk, ai_recommendations, is_paid, paid_amount, paid_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT DO NOTHING`,
          [users[est.user_idx], taxYear.id, est.quarter, est.due_date, est.estimated_income,
           est.estimated_deductions, est.estimated_tax, est.required_payment, est.ytd_payments,
           est.remaining_balance, est.safe_harbor_amount, est.penalty_risk, JSON.stringify(ai_recommendations),
           est.is_paid, est.paid_amount, est.paid_date]
        );
      }
    }
    console.log('AI Estimated Tax Calculations seeded: 16');

    // =====================================================
    // SEED AI DEDUCTION FINDER RESULTS (15+ entries)
    // =====================================================
    console.log('\nSeeding AI Deduction Finder Results...');
    const deductionFinderInserts = [
      { user_idx: 0, category: 'Retirement', deduction_name: 'IRA Contribution Deduction', description: 'You may be able to deduct contributions to a Traditional IRA', estimated_amount: 7000, requirements: 'Must have earned income and be under age limits', irs_reference: 'Publication 590-A', confidence: 'high' },
      { user_idx: 0, category: 'Health', deduction_name: 'HSA Contribution', description: 'Health Savings Account contributions are tax-deductible', estimated_amount: 8300, requirements: 'Must be enrolled in HDHP', irs_reference: 'Form 8889', confidence: 'medium' },
      { user_idx: 1, category: 'Education', deduction_name: 'Student Loan Interest', description: 'You can deduct up to $2,500 in student loan interest', estimated_amount: 2500, requirements: 'Must be legally obligated to pay interest', irs_reference: 'Form 1040 Schedule 1', confidence: 'high' },
      { user_idx: 2, category: 'Business', deduction_name: 'Self-Employment Tax Deduction', description: 'Deduct the employer-equivalent portion of SE tax', estimated_amount: 1200, requirements: 'Must have self-employment income', irs_reference: 'Schedule SE', confidence: 'high' },
      { user_idx: 2, category: 'Business', deduction_name: 'Business Use of Home', description: 'Simplified home office deduction at $5/sq ft', estimated_amount: 1500, requirements: 'Regular and exclusive business use', irs_reference: 'Form 8829', confidence: 'high' },
      { user_idx: 3, category: 'Education', deduction_name: 'Tuition and Fees', description: 'American Opportunity Credit for education expenses', estimated_amount: 2500, requirements: 'Student enrolled at least half-time', irs_reference: 'Form 8863', confidence: 'high' },
      { user_idx: 4, category: 'Education', deduction_name: 'Educator Expenses', description: 'Deduct up to $300 for classroom supplies', estimated_amount: 300, requirements: 'K-12 teacher with 900+ hours', irs_reference: 'Form 1040 Line 11', confidence: 'high' },
      { user_idx: 5, category: 'Charitable', deduction_name: 'Charitable Mileage', description: 'Deduct 14 cents per mile for charity driving', estimated_amount: 280, requirements: 'Must be driving for qualified charity', irs_reference: 'Schedule A', confidence: 'medium' },
      { user_idx: 6, category: 'Family', deduction_name: 'Dependent Care FSA', description: 'Pre-tax childcare expenses through FSA', estimated_amount: 5000, requirements: 'Care must be for work purposes', irs_reference: 'Form 2441', confidence: 'high' },
      { user_idx: 7, category: 'Energy', deduction_name: 'Solar Energy Credit Carryover', description: 'Unused residential clean energy credit', estimated_amount: 2000, requirements: 'Unused credit from prior year', irs_reference: 'Form 5695', confidence: 'medium' },
      { user_idx: 8, category: 'Vehicle', deduction_name: 'Standard Mileage Deduction', description: 'Deduct 67 cents per business mile driven', estimated_amount: 4020, requirements: 'Must maintain mileage log', irs_reference: 'Publication 463', confidence: 'high' },
      { user_idx: 9, category: 'Investment', deduction_name: 'Investment Advisory Fees', description: 'Fees for managing taxable investments', estimated_amount: 500, requirements: 'Must be for production of income', irs_reference: 'Schedule A', confidence: 'low' },
      { user_idx: 10, category: 'Professional', deduction_name: 'Professional Dues', description: 'Bar association and professional organization dues', estimated_amount: 750, requirements: 'Must be work-related', irs_reference: 'Schedule C or A', confidence: 'medium' },
      { user_idx: 11, category: 'Medical', deduction_name: 'Medical Insurance Premiums', description: 'Self-paid health insurance premiums', estimated_amount: 4800, requirements: 'Exceeds 7.5% AGI threshold', irs_reference: 'Schedule A', confidence: 'high' },
      { user_idx: 12, category: 'Charitable', deduction_name: 'Appreciated Stock Donation', description: 'Donate appreciated stocks to charity', estimated_amount: 3000, requirements: 'Held stock for more than 1 year', irs_reference: 'Form 8283', confidence: 'medium' },
      { user_idx: 13, category: 'Investment', deduction_name: 'Capital Loss Carryforward', description: 'Carry forward unused capital losses', estimated_amount: 3000, requirements: 'Net capital loss from prior year', irs_reference: 'Schedule D', confidence: 'high' }
    ];

    for (const ded of deductionFinderInserts) {
      const taxYear = taxYears.find(ty => ty.user_id === users[ded.user_idx]);
      if (taxYear) {
        await pool.query(
          `INSERT INTO ai_deduction_finder (user_id, tax_year_id, category, deduction_name, description, estimated_amount, requirements, irs_reference, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT DO NOTHING`,
          [users[ded.user_idx], taxYear.id, ded.category, ded.deduction_name, ded.description,
           ded.estimated_amount, ded.requirements, ded.irs_reference, ded.confidence]
        );
      }
    }
    console.log('AI Deduction Finder Results seeded: 16');

    console.log('\n=== AI Features seeding completed successfully! ===');
    console.log('Summary:');
    console.log('- AI Audit Risks: 15');
    console.log('- AI Tax Planning Scenarios: 17');
    console.log('- AI Receipt Scans: 16');
    console.log('- AI Estimated Tax Calculations: 16');
    console.log('- AI Deduction Finder Results: 16');

    process.exit(0);
  } catch (error) {
    console.error('AI Features seeding failed:', error);
    process.exit(1);
  }
}

seedAIFeatures();
