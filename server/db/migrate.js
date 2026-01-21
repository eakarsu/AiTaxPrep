const { pool } = require('../config/database');
require('dotenv').config();

const migrations = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  ssn_encrypted VARCHAR(255),
  date_of_birth DATE,
  filing_status VARCHAR(50) DEFAULT 'single',
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(50),
  address_zip VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Years table
CREATE TABLE IF NOT EXISTS tax_years (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'in_progress',
  federal_refund DECIMAL(12,2) DEFAULT 0,
  federal_owed DECIMAL(12,2) DEFAULT 0,
  state_refund DECIMAL(12,2) DEFAULT 0,
  state_owed DECIMAL(12,2) DEFAULT 0,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, year)
);

-- Income Sources table (W-2, 1099, etc.)
CREATE TABLE IF NOT EXISTS income_sources (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  employer_name VARCHAR(255),
  employer_ein VARCHAR(20),
  employer_address VARCHAR(500),
  wages DECIMAL(12,2) DEFAULT 0,
  federal_tax_withheld DECIMAL(12,2) DEFAULT 0,
  state_tax_withheld DECIMAL(12,2) DEFAULT 0,
  social_security_wages DECIMAL(12,2) DEFAULT 0,
  social_security_tax DECIMAL(12,2) DEFAULT 0,
  medicare_wages DECIMAL(12,2) DEFAULT 0,
  medicare_tax DECIMAL(12,2) DEFAULT 0,
  other_income DECIMAL(12,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deductions table
CREATE TABLE IF NOT EXISTS deductions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  amount DECIMAL(12,2) NOT NULL,
  is_itemized BOOLEAN DEFAULT false,
  receipt_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Credits table
CREATE TABLE IF NOT EXISTS tax_credits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  credit_type VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  amount DECIMAL(12,2) NOT NULL,
  is_refundable BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dependents table
CREATE TABLE IF NOT EXISTS dependents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  date_of_birth DATE NOT NULL,
  ssn_encrypted VARCHAR(255),
  months_lived_with INTEGER DEFAULT 12,
  is_student BOOLEAN DEFAULT false,
  is_disabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT false,
  extracted_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Calculations table
CREATE TABLE IF NOT EXISTS tax_calculations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  gross_income DECIMAL(12,2) DEFAULT 0,
  adjusted_gross_income DECIMAL(12,2) DEFAULT 0,
  taxable_income DECIMAL(12,2) DEFAULT 0,
  standard_deduction DECIMAL(12,2) DEFAULT 0,
  itemized_deduction DECIMAL(12,2) DEFAULT 0,
  total_credits DECIMAL(12,2) DEFAULT 0,
  federal_tax_liability DECIMAL(12,2) DEFAULT 0,
  state_tax_liability DECIMAL(12,2) DEFAULT 0,
  self_employment_tax DECIMAL(12,2) DEFAULT 0,
  total_tax_withheld DECIMAL(12,2) DEFAULT 0,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Tax Advice table
CREATE TABLE IF NOT EXISTS ai_tax_advice (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  advice_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  advice_text TEXT NOT NULL,
  potential_savings DECIMAL(12,2),
  priority VARCHAR(20) DEFAULT 'medium',
  is_read BOOLEAN DEFAULT false,
  is_applied BOOLEAN DEFAULT false,
  action_items JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Chat History table
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE SET NULL,
  messages JSONB NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Interview Wizard table
CREATE TABLE IF NOT EXISTS tax_interviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  current_section VARCHAR(100) DEFAULT 'personal_info',
  answers JSONB DEFAULT '{}',
  completed_sections JSONB DEFAULT '[]',
  progress INTEGER DEFAULT 0,
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tax_year_id)
);

-- State Tax Rates table
CREATE TABLE IF NOT EXISTS state_tax_rates (
  id SERIAL PRIMARY KEY,
  state_code VARCHAR(2) NOT NULL,
  state_name VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  has_income_tax BOOLEAN DEFAULT true,
  is_flat_rate BOOLEAN DEFAULT false,
  flat_rate DECIMAL(5,4),
  brackets JSONB,
  standard_deduction DECIMAL(12,2) DEFAULT 0,
  personal_exemption DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(state_code, year)
);

-- Expense Categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_deductible BOOLEAN DEFAULT true,
  deduction_limit DECIMAL(12,2),
  requires_receipt BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Expenses table
CREATE TABLE IF NOT EXISTS user_expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES expense_categories(id),
  description VARCHAR(500),
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  vendor VARCHAR(255),
  receipt_path VARCHAR(500),
  is_business_expense BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Forms table
CREATE TABLE IF NOT EXISTS tax_forms (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
  form_type VARCHAR(50) NOT NULL,
  form_data JSONB,
  status VARCHAR(50) DEFAULT 'draft',
  generated_at TIMESTAMP,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log table
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_income_sources_user ON income_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_tax_year ON income_sources(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_deductions_user ON deductions(user_id);
CREATE INDEX IF NOT EXISTS idx_deductions_tax_year ON deductions(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_tax_credits_user ON tax_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_expenses_user ON user_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_tax_year ON chat_history(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_tax_interviews_user ON tax_interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_state_tax_rates_state_year ON state_tax_rates(state_code, year);

-- Add user_id trigger for income_sources if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_income_user_id') THEN
    CREATE OR REPLACE FUNCTION set_income_user_id()
    RETURNS TRIGGER AS $func$
    BEGIN
      IF NEW.user_id IS NULL THEN
        SELECT user_id INTO NEW.user_id FROM tax_years WHERE id = NEW.tax_year_id;
      END IF;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    CREATE TRIGGER set_income_user_id
      BEFORE INSERT ON income_sources
      FOR EACH ROW
      EXECUTE FUNCTION set_income_user_id();
  END IF;
END
$$;

-- Add unique constraint for tax calculations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tax_calculations_user_tax_year_unique'
  ) THEN
    ALTER TABLE tax_calculations
    ADD CONSTRAINT tax_calculations_user_tax_year_unique
    UNIQUE (user_id, tax_year_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
`;

async function migrate() {
  try {
    console.log('Running database migrations...');
    await pool.query(migrations);
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
