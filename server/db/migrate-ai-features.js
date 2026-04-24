const { pool } = require('../config/database');
require('dotenv').config();

const migrations = `
-- AI Audit Risk Scores table
CREATE TABLE IF NOT EXISTS ai_audit_risks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  overall_risk VARCHAR(20) DEFAULT 'low',
  risk_score INTEGER DEFAULT 0,
  risk_factors JSONB DEFAULT '[]',
  positive_factors JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Tax Planning Scenarios table
CREATE TABLE IF NOT EXISTS ai_tax_planning (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  scenario_name VARCHAR(255) NOT NULL,
  scenario_type VARCHAR(100) NOT NULL,
  description TEXT,
  current_tax DECIMAL(12,2) DEFAULT 0,
  projected_tax DECIMAL(12,2) DEFAULT 0,
  potential_savings DECIMAL(12,2) DEFAULT 0,
  assumptions JSONB DEFAULT '{}',
  action_items JSONB DEFAULT '[]',
  priority VARCHAR(20) DEFAULT 'medium',
  is_implemented BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Receipt Scans table
CREATE TABLE IF NOT EXISTS ai_receipt_scans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  vendor VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE,
  category VARCHAR(100),
  description TEXT,
  items JSONB DEFAULT '[]',
  is_tax_deductible BOOLEAN DEFAULT false,
  deduction_category VARCHAR(100),
  confidence VARCHAR(20) DEFAULT 'medium',
  raw_ocr_data JSONB,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  is_imported BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Estimated Tax Calculations table
CREATE TABLE IF NOT EXISTS ai_estimated_taxes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  quarter INTEGER NOT NULL,
  due_date DATE NOT NULL,
  estimated_income DECIMAL(12,2) DEFAULT 0,
  estimated_deductions DECIMAL(12,2) DEFAULT 0,
  estimated_tax DECIMAL(12,2) DEFAULT 0,
  required_payment DECIMAL(12,2) DEFAULT 0,
  ytd_payments DECIMAL(12,2) DEFAULT 0,
  remaining_balance DECIMAL(12,2) DEFAULT 0,
  safe_harbor_amount DECIMAL(12,2) DEFAULT 0,
  penalty_risk VARCHAR(20) DEFAULT 'none',
  ai_recommendations JSONB DEFAULT '[]',
  calculation_details JSONB DEFAULT '{}',
  is_paid BOOLEAN DEFAULT false,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  paid_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Deduction Finder Results table
CREATE TABLE IF NOT EXISTS ai_deduction_finder (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  deduction_name VARCHAR(255) NOT NULL,
  description TEXT,
  estimated_amount DECIMAL(12,2) DEFAULT 0,
  requirements TEXT,
  irs_reference VARCHAR(100),
  confidence VARCHAR(20) DEFAULT 'medium',
  is_claimed BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_risks_user ON ai_audit_risks(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_risks_tax_year ON ai_audit_risks(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_tax_planning_user ON ai_tax_planning(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_planning_tax_year ON ai_tax_planning(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_user ON ai_receipt_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_tax_year ON ai_receipt_scans(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_estimated_taxes_user ON ai_estimated_taxes(user_id);
CREATE INDEX IF NOT EXISTS idx_estimated_taxes_tax_year ON ai_estimated_taxes(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_deduction_finder_user ON ai_deduction_finder(user_id);
CREATE INDEX IF NOT EXISTS idx_deduction_finder_tax_year ON ai_deduction_finder(tax_year_id);
`;

async function migrate() {
  try {
    console.log('Running AI features migrations...');
    await pool.query(migrations);
    console.log('AI features migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
