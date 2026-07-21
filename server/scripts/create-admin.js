'use strict';

const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') {
    throw new Error('Explicit bootstrap acknowledgement is required');
  }
  const email = (process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD || '';
  const suppliedName = (process.env.PROVISION_ADMIN_NAME || '').trim();
  const [firstName, ...lastNameParts] = suppliedName.split(/\s+/);
  const lastName = lastNameParts.join(' ') || 'Administrator';
  if (!email || !firstName || password.length < 12) {
    throw new Error('Admin email, name, and a 12+ character password are required');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users
       (email, password_hash, first_name, last_name, role, email_verified,
        failed_login_attempts, locked_until)
     VALUES ($1, $2, $3, $4, 'admin', true, 0, NULL)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       role = EXCLUDED.role,
       email_verified = true,
       failed_login_attempts = 0,
       locked_until = NULL`,
    [email, passwordHash, firstName, lastName]
  );
  console.log('Administrator provisioned.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
