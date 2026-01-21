const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  try {
    console.log('Seeding database...');

    // Seed Users (15 users)
    const users = [];
    const userPasswords = await Promise.all(
      Array(15).fill(null).map(() => bcrypt.hash('password123', 10))
    );

    const userInserts = [
      { email: 'john.doe@email.com', first_name: 'John', last_name: 'Doe', phone: '555-0101', filing_status: 'married_filing_jointly', address_street: '123 Main St', address_city: 'New York', address_state: 'NY', address_zip: '10001' },
      { email: 'jane.smith@email.com', first_name: 'Jane', last_name: 'Smith', phone: '555-0102', filing_status: 'single', address_street: '456 Oak Ave', address_city: 'Los Angeles', address_state: 'CA', address_zip: '90001' },
      { email: 'bob.wilson@email.com', first_name: 'Bob', last_name: 'Wilson', phone: '555-0103', filing_status: 'head_of_household', address_street: '789 Pine Rd', address_city: 'Chicago', address_state: 'IL', address_zip: '60601' },
      { email: 'alice.johnson@email.com', first_name: 'Alice', last_name: 'Johnson', phone: '555-0104', filing_status: 'married_filing_separately', address_street: '321 Elm St', address_city: 'Houston', address_state: 'TX', address_zip: '77001' },
      { email: 'charlie.brown@email.com', first_name: 'Charlie', last_name: 'Brown', phone: '555-0105', filing_status: 'single', address_street: '654 Maple Dr', address_city: 'Phoenix', address_state: 'AZ', address_zip: '85001' },
      { email: 'diana.ross@email.com', first_name: 'Diana', last_name: 'Ross', phone: '555-0106', filing_status: 'qualifying_widow', address_street: '987 Cedar Ln', address_city: 'Philadelphia', address_state: 'PA', address_zip: '19101' },
      { email: 'edward.miller@email.com', first_name: 'Edward', last_name: 'Miller', phone: '555-0107', filing_status: 'married_filing_jointly', address_street: '147 Birch Way', address_city: 'San Antonio', address_state: 'TX', address_zip: '78201' },
      { email: 'fiona.garcia@email.com', first_name: 'Fiona', last_name: 'Garcia', phone: '555-0108', filing_status: 'single', address_street: '258 Walnut St', address_city: 'San Diego', address_state: 'CA', address_zip: '92101' },
      { email: 'george.martinez@email.com', first_name: 'George', last_name: 'Martinez', phone: '555-0109', filing_status: 'head_of_household', address_street: '369 Spruce Ave', address_city: 'Dallas', address_state: 'TX', address_zip: '75201' },
      { email: 'helen.anderson@email.com', first_name: 'Helen', last_name: 'Anderson', phone: '555-0110', filing_status: 'single', address_street: '741 Ash Blvd', address_city: 'San Jose', address_state: 'CA', address_zip: '95101' },
      { email: 'ivan.thomas@email.com', first_name: 'Ivan', last_name: 'Thomas', phone: '555-0111', filing_status: 'married_filing_jointly', address_street: '852 Hickory Ct', address_city: 'Austin', address_state: 'TX', address_zip: '78701' },
      { email: 'julia.jackson@email.com', first_name: 'Julia', last_name: 'Jackson', phone: '555-0112', filing_status: 'single', address_street: '963 Willow Pl', address_city: 'Jacksonville', address_state: 'FL', address_zip: '32099' },
      { email: 'kevin.white@email.com', first_name: 'Kevin', last_name: 'White', phone: '555-0113', filing_status: 'married_filing_separately', address_street: '174 Poplar Rd', address_city: 'Fort Worth', address_state: 'TX', address_zip: '76101' },
      { email: 'laura.harris@email.com', first_name: 'Laura', last_name: 'Harris', phone: '555-0114', filing_status: 'single', address_street: '285 Sycamore St', address_city: 'Columbus', address_state: 'OH', address_zip: '43085' },
      { email: 'mike.clark@email.com', first_name: 'Mike', last_name: 'Clark', phone: '555-0115', filing_status: 'head_of_household', address_street: '396 Chestnut Ave', address_city: 'Charlotte', address_state: 'NC', address_zip: '28201' }
    ];

    for (let i = 0; i < userInserts.length; i++) {
      const u = userInserts[i];
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, filing_status, address_street, address_city, address_state, address_zip)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (email) DO UPDATE SET first_name = $3
         RETURNING id`,
        [u.email, userPasswords[i], u.first_name, u.last_name, u.phone, u.filing_status, u.address_street, u.address_city, u.address_state, u.address_zip]
      );
      users.push(result.rows[0].id);
    }
    console.log('Users seeded: 15');

    // Seed Tax Years (15+ tax years)
    const taxYears = [];
    const taxYearInserts = users.slice(0, 15).map((userId, i) => ({
      user_id: userId,
      year: 2024,
      status: ['in_progress', 'completed', 'submitted', 'in_progress', 'completed'][i % 5],
      federal_refund: [1250.00, 2340.50, 890.00, 3200.00, 1567.25, 0, 2100.00, 1890.50, 0, 3456.00, 2200.00, 1100.50, 0, 2890.00, 1750.25][i],
      federal_owed: [0, 0, 0, 0, 0, 450.00, 0, 0, 890.00, 0, 0, 0, 1200.00, 0, 0][i]
    }));

    for (const ty of taxYearInserts) {
      const result = await pool.query(
        `INSERT INTO tax_years (user_id, year, status, federal_refund, federal_owed)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, year) DO UPDATE SET status = $3
         RETURNING id`,
        [ty.user_id, ty.year, ty.status, ty.federal_refund, ty.federal_owed]
      );
      taxYears.push(result.rows[0].id);
    }
    console.log('Tax Years seeded: 15');

    // Seed Income Sources (15+ income sources - W-2s and 1099s)
    const incomeInserts = [
      { user_idx: 0, source_type: 'W-2', employer_name: 'Tech Corp Inc', employer_ein: '12-3456789', wages: 85000.00, federal_tax_withheld: 12750.00, state_tax_withheld: 4250.00 },
      { user_idx: 0, source_type: '1099-INT', employer_name: 'First National Bank', employer_ein: '98-7654321', wages: 0, other_income: 450.00, federal_tax_withheld: 0 },
      { user_idx: 1, source_type: 'W-2', employer_name: 'Marketing Solutions LLC', employer_ein: '23-4567890', wages: 72000.00, federal_tax_withheld: 10800.00, state_tax_withheld: 3600.00 },
      { user_idx: 2, source_type: 'W-2', employer_name: 'Global Industries', employer_ein: '34-5678901', wages: 95000.00, federal_tax_withheld: 14250.00, state_tax_withheld: 4750.00 },
      { user_idx: 2, source_type: '1099-NEC', employer_name: 'Freelance Client A', employer_ein: '45-6789012', wages: 0, other_income: 8500.00, federal_tax_withheld: 0 },
      { user_idx: 3, source_type: 'W-2', employer_name: 'Healthcare Partners', employer_ein: '56-7890123', wages: 68000.00, federal_tax_withheld: 10200.00, state_tax_withheld: 3400.00 },
      { user_idx: 4, source_type: 'W-2', employer_name: 'Education First', employer_ein: '67-8901234', wages: 55000.00, federal_tax_withheld: 8250.00, state_tax_withheld: 2750.00 },
      { user_idx: 5, source_type: 'W-2', employer_name: 'Financial Services Group', employer_ein: '78-9012345', wages: 120000.00, federal_tax_withheld: 24000.00, state_tax_withheld: 6000.00 },
      { user_idx: 6, source_type: 'W-2', employer_name: 'Manufacturing Co', employer_ein: '89-0123456', wages: 62000.00, federal_tax_withheld: 9300.00, state_tax_withheld: 3100.00 },
      { user_idx: 7, source_type: 'W-2', employer_name: 'Retail Giants Inc', employer_ein: '90-1234567', wages: 48000.00, federal_tax_withheld: 7200.00, state_tax_withheld: 2400.00 },
      { user_idx: 8, source_type: 'W-2', employer_name: 'Construction Plus', employer_ein: '01-2345678', wages: 78000.00, federal_tax_withheld: 11700.00, state_tax_withheld: 3900.00 },
      { user_idx: 9, source_type: 'W-2', employer_name: 'Software Innovations', employer_ein: '11-2233445', wages: 110000.00, federal_tax_withheld: 22000.00, state_tax_withheld: 5500.00 },
      { user_idx: 10, source_type: 'W-2', employer_name: 'Legal Associates', employer_ein: '22-3344556', wages: 145000.00, federal_tax_withheld: 29000.00, state_tax_withheld: 7250.00 },
      { user_idx: 11, source_type: 'W-2', employer_name: 'Media Productions', employer_ein: '33-4455667', wages: 58000.00, federal_tax_withheld: 8700.00, state_tax_withheld: 2900.00 },
      { user_idx: 12, source_type: 'W-2', employer_name: 'Consulting Group LLC', employer_ein: '44-5566778', wages: 92000.00, federal_tax_withheld: 13800.00, state_tax_withheld: 4600.00 },
      { user_idx: 13, source_type: '1099-DIV', employer_name: 'Investment Portfolio Inc', employer_ein: '55-6677889', wages: 0, other_income: 3200.00, federal_tax_withheld: 320.00 },
      { user_idx: 14, source_type: 'W-2', employer_name: 'Transportation Services', employer_ein: '66-7788990', wages: 52000.00, federal_tax_withheld: 7800.00, state_tax_withheld: 2600.00 }
    ];

    for (const inc of incomeInserts) {
      await pool.query(
        `INSERT INTO income_sources (user_id, tax_year_id, source_type, employer_name, employer_ein, wages, federal_tax_withheld, state_tax_withheld, other_income)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [users[inc.user_idx], taxYears[inc.user_idx], inc.source_type, inc.employer_name, inc.employer_ein, inc.wages || 0, inc.federal_tax_withheld || 0, inc.state_tax_withheld || 0, inc.other_income || 0]
      );
    }
    console.log('Income Sources seeded: 17');

    // Seed Deductions (15+ deductions)
    const deductionInserts = [
      { user_idx: 0, category: 'Mortgage Interest', description: 'Primary residence mortgage interest', amount: 12500.00, is_itemized: true },
      { user_idx: 0, category: 'Property Tax', description: 'Annual property tax payment', amount: 8200.00, is_itemized: true },
      { user_idx: 1, category: 'Charitable Donations', description: 'Cash donations to qualified charities', amount: 2500.00, is_itemized: true },
      { user_idx: 1, category: 'Medical Expenses', description: 'Unreimbursed medical expenses', amount: 4800.00, is_itemized: true },
      { user_idx: 2, category: 'State Income Tax', description: 'State income tax paid', amount: 6500.00, is_itemized: true },
      { user_idx: 2, category: 'Student Loan Interest', description: 'Student loan interest deduction', amount: 2500.00, is_itemized: false },
      { user_idx: 3, category: 'Home Office', description: 'Home office deduction - dedicated space', amount: 3200.00, is_itemized: true },
      { user_idx: 4, category: 'Educator Expenses', description: 'Classroom supplies and materials', amount: 300.00, is_itemized: false },
      { user_idx: 5, category: 'Investment Interest', description: 'Interest on investment loans', amount: 1800.00, is_itemized: true },
      { user_idx: 6, category: 'Charitable Donations', description: 'Non-cash donations to Goodwill', amount: 1200.00, is_itemized: true },
      { user_idx: 7, category: 'Health Insurance', description: 'Self-employed health insurance premiums', amount: 6000.00, is_itemized: false },
      { user_idx: 8, category: 'Business Expenses', description: 'Unreimbursed business travel', amount: 2400.00, is_itemized: true },
      { user_idx: 9, category: 'Property Tax', description: 'Real estate property tax', amount: 9500.00, is_itemized: true },
      { user_idx: 10, category: 'Mortgage Interest', description: 'Home mortgage interest', amount: 18000.00, is_itemized: true },
      { user_idx: 11, category: 'Medical Expenses', description: 'Surgery and hospital bills', amount: 8500.00, is_itemized: true },
      { user_idx: 12, category: 'Charitable Donations', description: 'Church and charity contributions', amount: 5500.00, is_itemized: true },
      { user_idx: 13, category: 'State Income Tax', description: 'State taxes withheld', amount: 4200.00, is_itemized: true },
      { user_idx: 14, category: 'Vehicle Expenses', description: 'Business use of personal vehicle', amount: 3800.00, is_itemized: true }
    ];

    for (const ded of deductionInserts) {
      await pool.query(
        `INSERT INTO deductions (user_id, tax_year_id, category, description, amount, is_itemized)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [users[ded.user_idx], taxYears[ded.user_idx], ded.category, ded.description, ded.amount, ded.is_itemized]
      );
    }
    console.log('Deductions seeded: 18');

    // Seed Tax Credits (15+ tax credits)
    const creditInserts = [
      { user_idx: 0, credit_type: 'Child Tax Credit', description: 'Credit for qualifying child', amount: 2000.00, is_refundable: true },
      { user_idx: 0, credit_type: 'Child Tax Credit', description: 'Credit for second qualifying child', amount: 2000.00, is_refundable: true },
      { user_idx: 1, credit_type: 'Earned Income Credit', description: 'EITC for low-moderate income', amount: 1502.00, is_refundable: true },
      { user_idx: 2, credit_type: 'Child and Dependent Care', description: 'Daycare expenses credit', amount: 1200.00, is_refundable: false },
      { user_idx: 3, credit_type: 'American Opportunity Credit', description: 'Higher education expenses', amount: 2500.00, is_refundable: true },
      { user_idx: 4, credit_type: 'Lifetime Learning Credit', description: 'Continuing education credit', amount: 1800.00, is_refundable: false },
      { user_idx: 5, credit_type: 'Retirement Savings Credit', description: 'Saver\'s credit for 401k', amount: 1000.00, is_refundable: false },
      { user_idx: 6, credit_type: 'Child Tax Credit', description: 'Credit for qualifying child', amount: 2000.00, is_refundable: true },
      { user_idx: 7, credit_type: 'Energy Efficient Home Credit', description: 'Solar panel installation', amount: 3200.00, is_refundable: false },
      { user_idx: 8, credit_type: 'Electric Vehicle Credit', description: 'EV purchase credit', amount: 7500.00, is_refundable: false },
      { user_idx: 9, credit_type: 'Foreign Tax Credit', description: 'Foreign taxes paid', amount: 890.00, is_refundable: false },
      { user_idx: 10, credit_type: 'Adoption Credit', description: 'Qualified adoption expenses', amount: 5200.00, is_refundable: false },
      { user_idx: 11, credit_type: 'Child Tax Credit', description: 'Credit for three children', amount: 6000.00, is_refundable: true },
      { user_idx: 12, credit_type: 'Premium Tax Credit', description: 'Health insurance marketplace credit', amount: 2400.00, is_refundable: true },
      { user_idx: 13, credit_type: 'Earned Income Credit', description: 'EITC for single filer', amount: 600.00, is_refundable: true },
      { user_idx: 14, credit_type: 'Child and Dependent Care', description: 'After school care expenses', amount: 800.00, is_refundable: false }
    ];

    for (const cred of creditInserts) {
      await pool.query(
        `INSERT INTO tax_credits (user_id, tax_year_id, credit_type, description, amount, is_refundable)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [users[cred.user_idx], taxYears[cred.user_idx], cred.credit_type, cred.description, cred.amount, cred.is_refundable]
      );
    }
    console.log('Tax Credits seeded: 16');

    // Seed Dependents (15+ dependents)
    const dependentInserts = [
      { user_idx: 0, first_name: 'Emily', last_name: 'Doe', relationship: 'daughter', dob: '2015-03-15', is_student: false },
      { user_idx: 0, first_name: 'Michael', last_name: 'Doe', relationship: 'son', dob: '2018-07-22', is_student: false },
      { user_idx: 2, first_name: 'Sophie', last_name: 'Wilson', relationship: 'daughter', dob: '2012-01-08', is_student: true },
      { user_idx: 3, first_name: 'Tyler', last_name: 'Johnson', relationship: 'son', dob: '2006-11-30', is_student: true },
      { user_idx: 6, first_name: 'Olivia', last_name: 'Miller', relationship: 'daughter', dob: '2019-05-12', is_student: false },
      { user_idx: 6, first_name: 'James', last_name: 'Miller', relationship: 'son', dob: '2021-09-03', is_student: false },
      { user_idx: 8, first_name: 'Emma', last_name: 'Martinez', relationship: 'daughter', dob: '2010-04-18', is_student: true },
      { user_idx: 8, first_name: 'Lucas', last_name: 'Martinez', relationship: 'son', dob: '2014-08-25', is_student: true },
      { user_idx: 10, first_name: 'Ava', last_name: 'Thomas', relationship: 'daughter', dob: '2017-12-01', is_student: false },
      { user_idx: 11, first_name: 'Noah', last_name: 'Jackson', relationship: 'son', dob: '2013-06-14', is_student: true },
      { user_idx: 11, first_name: 'Mia', last_name: 'Jackson', relationship: 'daughter', dob: '2016-02-28', is_student: false },
      { user_idx: 11, first_name: 'Liam', last_name: 'Jackson', relationship: 'son', dob: '2020-10-07', is_student: false },
      { user_idx: 14, first_name: 'Isabella', last_name: 'Clark', relationship: 'daughter', dob: '2011-09-20', is_student: true },
      { user_idx: 14, first_name: 'Ethan', last_name: 'Clark', relationship: 'son', dob: '2008-03-05', is_student: true },
      { user_idx: 5, first_name: 'Martha', last_name: 'Ross', relationship: 'mother', dob: '1952-07-19', is_disabled: true }
    ];

    for (const dep of dependentInserts) {
      await pool.query(
        `INSERT INTO dependents (user_id, tax_year_id, first_name, last_name, relationship, date_of_birth, is_student, is_disabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [users[dep.user_idx], taxYears[dep.user_idx], dep.first_name, dep.last_name, dep.relationship, dep.dob, dep.is_student || false, dep.is_disabled || false]
      );
    }
    console.log('Dependents seeded: 15');

    // Seed Expense Categories (15 categories)
    const categoryInserts = [
      { name: 'Office Supplies', description: 'Paper, pens, printer ink, etc.', is_deductible: true, requires_receipt: true },
      { name: 'Travel - Transportation', description: 'Airfare, train, rental car', is_deductible: true, requires_receipt: true },
      { name: 'Travel - Lodging', description: 'Hotels and accommodations', is_deductible: true, requires_receipt: true },
      { name: 'Meals - Business', description: 'Business meals (50% deductible)', is_deductible: true, deduction_limit: 0.50, requires_receipt: true },
      { name: 'Professional Services', description: 'Legal, accounting, consulting fees', is_deductible: true, requires_receipt: true },
      { name: 'Software & Subscriptions', description: 'Business software and SaaS', is_deductible: true, requires_receipt: true },
      { name: 'Equipment', description: 'Computers, machinery, tools', is_deductible: true, requires_receipt: true },
      { name: 'Marketing & Advertising', description: 'Ads, promotions, marketing materials', is_deductible: true, requires_receipt: true },
      { name: 'Insurance - Business', description: 'Business liability, property insurance', is_deductible: true, requires_receipt: true },
      { name: 'Utilities', description: 'Electric, gas, water, internet', is_deductible: true, requires_receipt: true },
      { name: 'Vehicle Expenses', description: 'Gas, maintenance, parking', is_deductible: true, requires_receipt: true },
      { name: 'Education & Training', description: 'Courses, certifications, books', is_deductible: true, requires_receipt: true },
      { name: 'Bank & Credit Card Fees', description: 'Business account fees', is_deductible: true, requires_receipt: false },
      { name: 'Rent - Office', description: 'Office or workspace rent', is_deductible: true, requires_receipt: true },
      { name: 'Healthcare - Business', description: 'Self-employed health premiums', is_deductible: true, requires_receipt: true }
    ];

    const categories = [];
    for (const cat of categoryInserts) {
      const result = await pool.query(
        `INSERT INTO expense_categories (name, description, is_deductible, deduction_limit, requires_receipt)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [cat.name, cat.description, cat.is_deductible, cat.deduction_limit || null, cat.requires_receipt]
      );
      if (result.rows[0]) categories.push(result.rows[0].id);
    }

    // Re-fetch categories if they already existed
    if (categories.length === 0) {
      const catResult = await pool.query('SELECT id FROM expense_categories ORDER BY id');
      categories.push(...catResult.rows.map(r => r.id));
    }
    console.log('Expense Categories seeded: 15');

    // Seed User Expenses (15+ expenses)
    const expenseInserts = [
      { user_idx: 0, cat_idx: 0, description: 'Printer paper and ink', amount: 125.50, date: '2024-02-15', vendor: 'Staples' },
      { user_idx: 0, cat_idx: 5, description: 'Microsoft 365 subscription', amount: 99.99, date: '2024-01-10', vendor: 'Microsoft' },
      { user_idx: 1, cat_idx: 1, description: 'Flight to client meeting', amount: 450.00, date: '2024-03-20', vendor: 'Delta Airlines' },
      { user_idx: 1, cat_idx: 2, description: 'Hotel for conference', amount: 325.00, date: '2024-03-21', vendor: 'Marriott' },
      { user_idx: 2, cat_idx: 3, description: 'Client lunch meeting', amount: 85.40, date: '2024-04-05', vendor: 'Ruth\'s Chris' },
      { user_idx: 2, cat_idx: 4, description: 'Legal consultation', amount: 500.00, date: '2024-02-28', vendor: 'Smith & Associates' },
      { user_idx: 3, cat_idx: 6, description: 'New laptop for work', amount: 1299.00, date: '2024-01-25', vendor: 'Apple Store' },
      { user_idx: 4, cat_idx: 7, description: 'Facebook ads campaign', amount: 200.00, date: '2024-05-01', vendor: 'Meta' },
      { user_idx: 5, cat_idx: 8, description: 'Business liability insurance', amount: 1200.00, date: '2024-01-01', vendor: 'State Farm' },
      { user_idx: 6, cat_idx: 9, description: 'Home office internet', amount: 79.99, date: '2024-03-15', vendor: 'Comcast' },
      { user_idx: 7, cat_idx: 10, description: 'Gas for client visits', amount: 156.80, date: '2024-04-18', vendor: 'Shell' },
      { user_idx: 8, cat_idx: 11, description: 'AWS certification course', amount: 399.00, date: '2024-02-10', vendor: 'Udemy' },
      { user_idx: 9, cat_idx: 12, description: 'Business account monthly fee', amount: 15.00, date: '2024-01-31', vendor: 'Chase Bank' },
      { user_idx: 10, cat_idx: 13, description: 'Co-working space monthly', amount: 350.00, date: '2024-03-01', vendor: 'WeWork' },
      { user_idx: 11, cat_idx: 14, description: 'Health insurance premium', amount: 485.00, date: '2024-02-01', vendor: 'Blue Cross' },
      { user_idx: 12, cat_idx: 0, description: 'Business cards printing', amount: 75.00, date: '2024-04-22', vendor: 'Vistaprint' }
    ];

    for (const exp of expenseInserts) {
      await pool.query(
        `INSERT INTO user_expenses (user_id, tax_year_id, category_id, description, amount, expense_date, vendor, is_business_expense)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [users[exp.user_idx], taxYears[exp.user_idx], categories[exp.cat_idx], exp.description, exp.amount, exp.date, exp.vendor]
      );
    }
    console.log('User Expenses seeded: 16');

    // Seed AI Tax Advice (15+ advice entries)
    const adviceInserts = [
      { user_idx: 0, advice_type: 'deduction', title: 'Maximize Mortgage Interest Deduction', advice_text: 'Based on your mortgage interest payments, you may benefit from itemizing deductions instead of taking the standard deduction. Your itemized deductions total $20,700 which exceeds the standard deduction of $14,600.', potential_savings: 1830.00, priority: 'high' },
      { user_idx: 0, advice_type: 'credit', title: 'Child Tax Credit Eligible', advice_text: 'You have 2 qualifying children under 17. You may be eligible for up to $4,000 in child tax credits.', potential_savings: 4000.00, priority: 'high' },
      { user_idx: 1, advice_type: 'retirement', title: 'IRA Contribution Opportunity', advice_text: 'You have not maximized your IRA contributions. Consider contributing up to $7,000 to reduce your taxable income.', potential_savings: 1540.00, priority: 'medium' },
      { user_idx: 2, advice_type: 'deduction', title: 'Home Office Deduction Available', advice_text: 'As a freelancer with 1099 income, you may qualify for the home office deduction. Ensure you have a dedicated workspace.', potential_savings: 1200.00, priority: 'medium' },
      { user_idx: 3, advice_type: 'education', title: 'Education Credits Available', advice_text: 'Your dependent is a college student. You may qualify for the American Opportunity Credit worth up to $2,500.', potential_savings: 2500.00, priority: 'high' },
      { user_idx: 4, advice_type: 'deduction', title: 'Educator Expense Deduction', advice_text: 'As a teacher, you can deduct up to $300 for classroom supplies even if you don\'t itemize.', potential_savings: 66.00, priority: 'low' },
      { user_idx: 5, advice_type: 'investment', title: 'Capital Loss Harvesting', advice_text: 'Review your investment portfolio for losses that could offset gains. You can deduct up to $3,000 in net capital losses.', potential_savings: 660.00, priority: 'medium' },
      { user_idx: 6, advice_type: 'dependent', title: 'Dependent Care Benefits', advice_text: 'With young children, consider a Dependent Care FSA. You can save up to $5,000 pre-tax for childcare expenses.', potential_savings: 1100.00, priority: 'high' },
      { user_idx: 7, advice_type: 'energy', title: 'Energy Efficiency Credits', advice_text: 'The solar panels you installed qualify for the Residential Clean Energy Credit of 30% of costs.', potential_savings: 3200.00, priority: 'high' },
      { user_idx: 8, advice_type: 'vehicle', title: 'EV Tax Credit', advice_text: 'Your electric vehicle purchase may qualify for up to $7,500 in federal tax credits.', potential_savings: 7500.00, priority: 'high' },
      { user_idx: 9, advice_type: 'retirement', title: '401(k) Contribution Increase', advice_text: 'Consider increasing your 401(k) contributions. The limit is $23,000 for 2024. Each dollar reduces your taxable income.', potential_savings: 2200.00, priority: 'medium' },
      { user_idx: 10, advice_type: 'deduction', title: 'Adoption Credit Available', advice_text: 'Your adoption expenses qualify for a tax credit of up to $16,810 per child.', potential_savings: 5200.00, priority: 'high' },
      { user_idx: 11, advice_type: 'health', title: 'HSA Contribution Benefits', advice_text: 'If you have a high-deductible health plan, contribute to an HSA. Family limit is $8,300 for 2024.', potential_savings: 1826.00, priority: 'medium' },
      { user_idx: 12, advice_type: 'insurance', title: 'Premium Tax Credit', advice_text: 'Based on your income, you may qualify for the Premium Tax Credit to help pay for health insurance.', potential_savings: 2400.00, priority: 'high' },
      { user_idx: 13, advice_type: 'charitable', title: 'Charitable Donation Bunching', advice_text: 'Consider "bunching" two years of charitable donations into one year to exceed the standard deduction threshold.', potential_savings: 800.00, priority: 'low' },
      { user_idx: 14, advice_type: 'business', title: 'Mileage Deduction Opportunity', advice_text: 'Track your business mileage. The 2024 rate is 67 cents per mile. Based on your expenses, you could deduct more.', potential_savings: 1200.00, priority: 'medium' }
    ];

    for (const adv of adviceInserts) {
      await pool.query(
        `INSERT INTO ai_tax_advice (user_id, tax_year_id, advice_type, title, advice_text, potential_savings, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [users[adv.user_idx], taxYears[adv.user_idx], adv.advice_type, adv.title, adv.advice_text, adv.potential_savings, adv.priority]
      );
    }
    console.log('AI Tax Advice seeded: 16');

    // Seed Tax Calculations (15 calculations)
    const calcInserts = [
      { user_idx: 0, gross: 85450, agi: 82950, taxable: 62250, std_ded: 29200, fed_liability: 7047, total_withheld: 12750 },
      { user_idx: 1, gross: 72000, agi: 69500, taxable: 54900, std_ded: 14600, fed_liability: 7304, total_withheld: 10800 },
      { user_idx: 2, gross: 103500, agi: 100000, taxable: 85400, std_ded: 14600, fed_liability: 13946, total_withheld: 14250 },
      { user_idx: 3, gross: 68000, agi: 65500, taxable: 50900, std_ded: 14600, fed_liability: 6696, total_withheld: 10200 },
      { user_idx: 4, gross: 55000, agi: 54700, taxable: 40100, std_ded: 14600, fed_liability: 4602, total_withheld: 8250 },
      { user_idx: 5, gross: 120000, agi: 118200, taxable: 103600, std_ded: 14600, fed_liability: 17892, total_withheld: 24000 },
      { user_idx: 6, gross: 62000, agi: 60800, taxable: 31600, std_ded: 29200, fed_liability: 3494, total_withheld: 9300 },
      { user_idx: 7, gross: 48000, agi: 42000, taxable: 27400, std_ded: 14600, fed_liability: 3014, total_withheld: 7200 },
      { user_idx: 8, gross: 78000, agi: 75600, taxable: 46400, std_ded: 29200, fed_liability: 5218, total_withheld: 11700 },
      { user_idx: 9, gross: 110000, agi: 107500, taxable: 92900, std_ded: 14600, fed_liability: 15106, total_withheld: 22000 },
      { user_idx: 10, gross: 145000, agi: 142500, taxable: 113300, std_ded: 29200, fed_liability: 19374, total_withheld: 29000 },
      { user_idx: 11, gross: 58000, agi: 57500, taxable: 42900, std_ded: 14600, fed_liability: 4926, total_withheld: 8700 },
      { user_idx: 12, gross: 92000, agi: 86500, taxable: 71900, std_ded: 14600, fed_liability: 10904, total_withheld: 13800 },
      { user_idx: 13, gross: 3200, agi: 3200, taxable: 0, std_ded: 14600, fed_liability: 0, total_withheld: 320 },
      { user_idx: 14, gross: 52000, agi: 48200, taxable: 26800, std_ded: 21900, fed_liability: 2944, total_withheld: 7800 }
    ];

    for (const calc of calcInserts) {
      await pool.query(
        `INSERT INTO tax_calculations (user_id, tax_year_id, gross_income, adjusted_gross_income, taxable_income, standard_deduction, federal_tax_liability, total_tax_withheld)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, tax_year_id) DO UPDATE SET
           gross_income = EXCLUDED.gross_income,
           adjusted_gross_income = EXCLUDED.adjusted_gross_income,
           taxable_income = EXCLUDED.taxable_income,
           standard_deduction = EXCLUDED.standard_deduction,
           federal_tax_liability = EXCLUDED.federal_tax_liability,
           total_tax_withheld = EXCLUDED.total_tax_withheld`,
        [users[calc.user_idx], taxYears[calc.user_idx], calc.gross, calc.agi, calc.taxable, calc.std_ded, calc.fed_liability, calc.total_withheld]
      );
    }
    console.log('Tax Calculations seeded: 15');

    // Seed Documents (15+ documents)
    const docInserts = [
      { user_idx: 0, doc_type: 'W-2', file_name: 'w2_techcorp_2024.pdf', processed: true },
      { user_idx: 0, doc_type: '1099-INT', file_name: '1099int_fnb_2024.pdf', processed: true },
      { user_idx: 1, doc_type: 'W-2', file_name: 'w2_marketing_2024.pdf', processed: true },
      { user_idx: 2, doc_type: 'W-2', file_name: 'w2_global_2024.pdf', processed: true },
      { user_idx: 2, doc_type: '1099-NEC', file_name: '1099nec_freelance_2024.pdf', processed: true },
      { user_idx: 3, doc_type: 'W-2', file_name: 'w2_healthcare_2024.pdf', processed: true },
      { user_idx: 3, doc_type: '1098-T', file_name: '1098t_university_2024.pdf', processed: true },
      { user_idx: 4, doc_type: 'W-2', file_name: 'w2_education_2024.pdf', processed: true },
      { user_idx: 5, doc_type: 'W-2', file_name: 'w2_financial_2024.pdf', processed: true },
      { user_idx: 6, doc_type: 'W-2', file_name: 'w2_manufacturing_2024.pdf', processed: true },
      { user_idx: 7, doc_type: 'W-2', file_name: 'w2_retail_2024.pdf', processed: true },
      { user_idx: 8, doc_type: 'W-2', file_name: 'w2_construction_2024.pdf', processed: true },
      { user_idx: 9, doc_type: 'W-2', file_name: 'w2_software_2024.pdf', processed: true },
      { user_idx: 10, doc_type: 'W-2', file_name: 'w2_legal_2024.pdf', processed: true },
      { user_idx: 11, doc_type: 'W-2', file_name: 'w2_media_2024.pdf', processed: true },
      { user_idx: 12, doc_type: 'W-2', file_name: 'w2_consulting_2024.pdf', processed: true }
    ];

    for (const doc of docInserts) {
      await pool.query(
        `INSERT INTO documents (user_id, tax_year_id, document_type, file_name, file_path, file_size, mime_type, processed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [users[doc.user_idx], taxYears[doc.user_idx], doc.doc_type, doc.file_name, `/uploads/${doc.file_name}`, 102400, 'application/pdf', doc.processed]
      );
    }
    console.log('Documents seeded: 16');

    // Seed Tax Forms (15 tax forms)
    const formInserts = [
      { user_idx: 0, form_type: '1040', status: 'draft' },
      { user_idx: 1, form_type: '1040', status: 'completed' },
      { user_idx: 2, form_type: '1040', status: 'submitted' },
      { user_idx: 2, form_type: 'Schedule C', status: 'submitted' },
      { user_idx: 3, form_type: '1040', status: 'draft' },
      { user_idx: 4, form_type: '1040', status: 'completed' },
      { user_idx: 5, form_type: '1040', status: 'draft' },
      { user_idx: 6, form_type: '1040', status: 'draft' },
      { user_idx: 7, form_type: '1040', status: 'completed' },
      { user_idx: 8, form_type: '1040', status: 'draft' },
      { user_idx: 9, form_type: '1040', status: 'completed' },
      { user_idx: 10, form_type: '1040', status: 'submitted' },
      { user_idx: 11, form_type: '1040', status: 'draft' },
      { user_idx: 12, form_type: '1040', status: 'draft' },
      { user_idx: 13, form_type: '1040', status: 'completed' }
    ];

    for (const form of formInserts) {
      await pool.query(
        `INSERT INTO tax_forms (user_id, tax_year_id, form_type, status, form_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [users[form.user_idx], taxYears[form.user_idx], form.form_type, form.status, JSON.stringify({ generated: true })]
      );
    }
    console.log('Tax Forms seeded: 15');

    // Seed Audit Log (15+ entries)
    const auditInserts = [
      { user_idx: 0, action: 'LOGIN', entity_type: 'user', entity_id: 1 },
      { user_idx: 0, action: 'CREATE', entity_type: 'income_source', entity_id: 1 },
      { user_idx: 1, action: 'LOGIN', entity_type: 'user', entity_id: 2 },
      { user_idx: 1, action: 'UPDATE', entity_type: 'profile', entity_id: 2 },
      { user_idx: 2, action: 'LOGIN', entity_type: 'user', entity_id: 3 },
      { user_idx: 2, action: 'UPLOAD', entity_type: 'document', entity_id: 1 },
      { user_idx: 3, action: 'LOGIN', entity_type: 'user', entity_id: 4 },
      { user_idx: 3, action: 'CREATE', entity_type: 'deduction', entity_id: 1 },
      { user_idx: 4, action: 'LOGIN', entity_type: 'user', entity_id: 5 },
      { user_idx: 5, action: 'LOGIN', entity_type: 'user', entity_id: 6 },
      { user_idx: 5, action: 'CALCULATE', entity_type: 'tax_calculation', entity_id: 1 },
      { user_idx: 6, action: 'LOGIN', entity_type: 'user', entity_id: 7 },
      { user_idx: 7, action: 'LOGIN', entity_type: 'user', entity_id: 8 },
      { user_idx: 8, action: 'LOGIN', entity_type: 'user', entity_id: 9 },
      { user_idx: 9, action: 'LOGIN', entity_type: 'user', entity_id: 10 },
      { user_idx: 10, action: 'SUBMIT', entity_type: 'tax_form', entity_id: 1 }
    ];

    for (const audit of auditInserts) {
      await pool.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [users[audit.user_idx], audit.action, audit.entity_type, audit.entity_id, '192.168.1.1']
      );
    }
    console.log('Audit Log seeded: 16');

    console.log('\n=== Database seeding completed successfully! ===');
    console.log('Summary:');
    console.log('- Users: 15');
    console.log('- Tax Years: 15');
    console.log('- Income Sources: 17');
    console.log('- Deductions: 18');
    console.log('- Tax Credits: 16');
    console.log('- Dependents: 15');
    console.log('- Expense Categories: 15');
    console.log('- User Expenses: 16');
    console.log('- AI Tax Advice: 16');
    console.log('- Tax Calculations: 15');
    console.log('- Documents: 16');
    console.log('- Tax Forms: 15');
    console.log('- Audit Log: 16');
    console.log('\nTest Login: email: john.doe@email.com, password: password123');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
