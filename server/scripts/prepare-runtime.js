'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  if (process.env.ALLOW_SCHEMA_MIGRATION !== 'true') throw new Error('ALLOW_SCHEMA_MIGRATION=true is required');
  execFileSync(process.execPath, [path.resolve(__dirname, '../db/migrate.js')], { stdio: 'inherit', env: process.env });
  const { pool } = require('../config/database');
  try {
    await pool.query(fs.readFileSync(path.resolve(__dirname, '../migrations/001_governed_workflows.sql'), 'utf8'));
    await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(30) NOT NULL DEFAULT 'info', title TEXT NOT NULL, message TEXT NOT NULL,
      action_url TEXT, is_read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tax_runtime_ai_results (
      id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), input JSONB NOT NULL,
      result JSONB NOT NULL, model TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const email = String(process.env.PROVISION_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.PROVISION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '');
    if (!email || password.length < 12) throw new Error('Runtime administrator credentials are required');
    await pool.query(
      `INSERT INTO users(email,password_hash,first_name,last_name,role,email_verified,failed_login_attempts,locked_until)
       VALUES($1,$2,'Runtime','Administrator','admin',true,0,NULL)
       ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,first_name='Runtime',last_name='Administrator',role='admin',email_verified=true,failed_login_attempts=0,locked_until=NULL`,
      [email, await bcrypt.hash(password, 12)],
    );
  } finally { await pool.end(); }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
