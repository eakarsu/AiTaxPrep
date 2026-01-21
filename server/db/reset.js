const { pool } = require('../config/database');
require('dotenv').config();

async function reset() {
  try {
    console.log('Resetting database...');

    // Drop all tables in reverse order of dependencies
    const dropTables = `
      DROP TABLE IF EXISTS audit_log CASCADE;
      DROP TABLE IF EXISTS tax_forms CASCADE;
      DROP TABLE IF EXISTS user_expenses CASCADE;
      DROP TABLE IF EXISTS expense_categories CASCADE;
      DROP TABLE IF EXISTS ai_tax_advice CASCADE;
      DROP TABLE IF EXISTS tax_calculations CASCADE;
      DROP TABLE IF EXISTS documents CASCADE;
      DROP TABLE IF EXISTS dependents CASCADE;
      DROP TABLE IF EXISTS tax_credits CASCADE;
      DROP TABLE IF EXISTS deductions CASCADE;
      DROP TABLE IF EXISTS income_sources CASCADE;
      DROP TABLE IF EXISTS tax_years CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `;

    await pool.query(dropTables);
    console.log('All tables dropped successfully!');
    console.log('Run "npm run db:migrate && npm run db:seed" to recreate and populate the database.');
    process.exit(0);
  } catch (error) {
    console.error('Reset failed:', error);
    process.exit(1);
  }
}

reset();
