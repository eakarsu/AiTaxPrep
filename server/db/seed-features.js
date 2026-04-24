const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

async function seedFeatures() {
  try {
    console.log('Seeding feature data...');

    // Get existing users
    const usersResult = await pool.query('SELECT id, email FROM users ORDER BY id LIMIT 15');
    const users = usersResult.rows;

    if (users.length === 0) {
      console.log('No users found. Run main seed first.');
      process.exit(1);
    }

    // ============================================================
    // 1. Update user roles (RBAC) - 15 users with different roles
    // ============================================================
    const roleUpdates = [
      { idx: 0, role: 'user', email_verified: true },    // john.doe - regular user, verified
      { idx: 1, role: 'user', email_verified: true },    // jane.smith
      { idx: 2, role: 'accountant', email_verified: true }, // bob.wilson - accountant
      { idx: 3, role: 'user', email_verified: false },   // alice.johnson - unverified
      { idx: 4, role: 'user', email_verified: true },    // charlie.brown
      { idx: 5, role: 'admin', email_verified: true },   // diana.ross - admin
      { idx: 6, role: 'user', email_verified: true },    // edward.miller
      { idx: 7, role: 'user', email_verified: false },   // fiona.garcia - unverified
      { idx: 8, role: 'accountant', email_verified: true }, // george.martinez - accountant
      { idx: 9, role: 'user', email_verified: true },    // helen.anderson
      { idx: 10, role: 'admin', email_verified: true },  // ivan.thomas - admin
      { idx: 11, role: 'user', email_verified: true },   // julia.jackson
      { idx: 12, role: 'user', email_verified: false },  // kevin.white - unverified
      { idx: 13, role: 'user', email_verified: true },   // laura.harris
      { idx: 14, role: 'accountant', email_verified: true }, // mike.clark - accountant
    ];

    for (const update of roleUpdates) {
      await pool.query(
        'UPDATE users SET role = $1, email_verified = $2 WHERE id = $3',
        [update.role, update.email_verified, users[update.idx].id]
      );
    }
    console.log('User roles updated: 15 (3 admin, 3 accountant, 9 user)');

    // ============================================================
    // 2. Password Reset Tokens - 15 entries
    // ============================================================
    const resetTokens = [];
    for (let i = 0; i < 15; i++) {
      const token = crypto.randomBytes(32).toString('hex');
      const hoursAgo = [1, 2, 3, 0.5, 24, 12, 6, 48, 0.25, 36, 4, 8, 72, 0.1, 16][i];
      const used = [false, true, true, false, true, false, true, true, false, true, false, true, true, false, false][i];
      const expiresAt = new Date(Date.now() + (used ? -1 : 1) * hoursAgo * 60 * 60 * 1000);

      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at, used) VALUES ($1, $2, $3, $4)',
        [users[i].id, token, expiresAt, used]
      );
      resetTokens.push(token);
    }
    console.log('Password reset tokens seeded: 15');

    // ============================================================
    // 3. Email Verification Tokens - 15 entries
    // ============================================================
    for (let i = 0; i < 15; i++) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Only set tokens for unverified users
      if (!roleUpdates[i].email_verified) {
        await pool.query(
          'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
          [token, expires, users[i].id]
        );
      }
    }
    console.log('Email verification tokens seeded: 15');

    // ============================================================
    // 4. User Sessions (RBAC tracking) - 15 entries
    // ============================================================
    const sessions = [
      { idx: 0, ip: '192.168.1.100', agent: 'Mozilla/5.0 Chrome/120', active: true },
      { idx: 1, ip: '192.168.1.101', agent: 'Mozilla/5.0 Firefox/121', active: true },
      { idx: 2, ip: '10.0.0.50', agent: 'Mozilla/5.0 Safari/17', active: true },
      { idx: 3, ip: '172.16.0.25', agent: 'Mozilla/5.0 Edge/120', active: false },
      { idx: 4, ip: '192.168.2.100', agent: 'Mozilla/5.0 Chrome/119', active: true },
      { idx: 5, ip: '10.0.1.100', agent: 'Mozilla/5.0 Chrome/120', active: true },
      { idx: 6, ip: '192.168.1.200', agent: 'Mozilla/5.0 Firefox/120', active: false },
      { idx: 7, ip: '172.16.1.50', agent: 'Mozilla/5.0 Safari/16', active: true },
      { idx: 8, ip: '10.0.2.75', agent: 'Mozilla/5.0 Chrome/120', active: true },
      { idx: 9, ip: '192.168.3.100', agent: 'Mozilla/5.0 Edge/119', active: false },
      { idx: 10, ip: '10.0.0.100', agent: 'Mozilla/5.0 Chrome/121', active: true },
      { idx: 11, ip: '192.168.1.150', agent: 'Mozilla/5.0 Firefox/121', active: true },
      { idx: 12, ip: '172.16.2.25', agent: 'Mozilla/5.0 Chrome/118', active: false },
      { idx: 13, ip: '10.0.3.50', agent: 'Mozilla/5.0 Safari/17', active: true },
      { idx: 14, ip: '192.168.4.100', agent: 'Mozilla/5.0 Chrome/120', active: true },
    ];

    for (const sess of sessions) {
      const tokenHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
      await pool.query(
        `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, is_active, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [users[sess.idx].id, tokenHash, sess.ip, sess.agent, sess.active, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      );
    }
    console.log('User sessions seeded: 15');

    // ============================================================
    // 5. Notifications (Toast notifications) - 16 entries
    // ============================================================
    const notifications = [
      { idx: 0, type: 'info', title: 'Welcome to AI Tax Prep!', message: 'Your account has been created successfully. Start by entering your income information.', url: '/income' },
      { idx: 0, type: 'success', title: 'W-2 Imported', message: 'Your W-2 from Tech Corp Inc has been successfully imported and processed.', url: '/income' },
      { idx: 0, type: 'warning', title: 'Missing Documents', message: 'You have 2 income sources without supporting documents. Upload them to avoid delays.', url: '/documents' },
      { idx: 1, type: 'info', title: 'Tax Deadline Reminder', message: 'The federal tax filing deadline is April 15, 2025. Make sure to file on time!', url: '/forms' },
      { idx: 1, type: 'success', title: 'Deduction Found!', message: 'AI found a potential $1,540 IRA contribution deduction you may have missed.', url: '/deduction-finder' },
      { idx: 2, type: 'warning', title: 'Audit Risk Alert', message: 'Your audit risk score has changed to medium. Review the recommendations.', url: '/audit-risk' },
      { idx: 2, type: 'success', title: 'Tax Return Submitted', message: 'Your 2024 federal tax return has been successfully e-filed.', url: '/efile' },
      { idx: 3, type: 'error', title: 'Email Not Verified', message: 'Please verify your email address to access all features.', url: '/profile' },
      { idx: 4, type: 'info', title: 'Estimated Tax Due', message: 'Your Q1 2025 estimated tax payment of $1,150 is due on April 15.', url: '/estimated-taxes' },
      { idx: 5, type: 'success', title: 'Admin: New User Registered', message: 'A new user (test@example.com) has registered on the platform.', url: null },
      { idx: 6, type: 'info', title: 'Tax Planning Update', message: 'New tax planning scenarios are available based on your updated income.', url: '/tax-planning' },
      { idx: 7, type: 'warning', title: 'Receipt Scan Failed', message: 'Unable to process one of your uploaded receipts. Please re-upload.', url: '/receipt-scanner' },
      { idx: 8, type: 'success', title: 'Bulk Import Complete', message: '12 expense records have been imported from your bank statement.', url: '/expenses' },
      { idx: 9, type: 'info', title: 'State Return Ready', message: 'Your California state tax return is ready for review.', url: '/state-returns' },
      { idx: 10, type: 'success', title: 'Password Changed', message: 'Your password has been successfully updated.', url: '/profile' },
      { idx: 11, type: 'warning', title: 'Incomplete Filing', message: 'Your tax return is 75% complete. Finish the remaining sections to file.', url: '/interview' },
    ];

    for (const notif of notifications) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, action_url, is_read)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [users[notif.idx].id, notif.type, notif.title, notif.message, notif.url, Math.random() > 0.5]
      );
    }
    console.log('Notifications seeded: 16');

    // ============================================================
    // 6. Rate Limit Log entries - 15 entries
    // ============================================================
    const rateLimits = [
      { ip: '192.168.1.100', endpoint: '/api/auth/login', count: 5 },
      { ip: '192.168.1.101', endpoint: '/api/auth/login', count: 3 },
      { ip: '10.0.0.50', endpoint: '/api/auth/register', count: 2 },
      { ip: '172.16.0.25', endpoint: '/api/auth/forgot-password', count: 4 },
      { ip: '192.168.2.100', endpoint: '/api/income', count: 45 },
      { ip: '10.0.1.100', endpoint: '/api/deductions', count: 30 },
      { ip: '192.168.1.200', endpoint: '/api/ai/chat', count: 20 },
      { ip: '172.16.1.50', endpoint: '/api/documents', count: 15 },
      { ip: '10.0.2.75', endpoint: '/api/auth/login', count: 10 },
      { ip: '192.168.3.100', endpoint: '/api/calculations', count: 8 },
      { ip: '10.0.0.100', endpoint: '/api/auth/login', count: 1 },
      { ip: '192.168.1.150', endpoint: '/api/credits', count: 12 },
      { ip: '172.16.2.25', endpoint: '/api/expenses', count: 25 },
      { ip: '10.0.3.50', endpoint: '/api/auth/register', count: 3 },
      { ip: '192.168.4.100', endpoint: '/api/advice', count: 7 },
    ];

    for (const rl of rateLimits) {
      await pool.query(
        'INSERT INTO rate_limit_log (ip_address, endpoint, request_count) VALUES ($1, $2, $3)',
        [rl.ip, rl.endpoint, rl.count]
      );
    }
    console.log('Rate limit logs seeded: 15');

    // ============================================================
    // 7. Bulk Operations Log - 15 entries
    // ============================================================
    const bulkOps = [
      { idx: 0, op: 'delete', entity: 'income_sources', ids: [1, 2, 3], details: { deletedCount: 3 } },
      { idx: 0, op: 'update', entity: 'deductions', ids: [1, 2], details: { updatedCount: 2, updates: { isItemized: true } } },
      { idx: 1, op: 'delete', entity: 'user_expenses', ids: [5, 6, 7, 8], details: { deletedCount: 4 } },
      { idx: 2, op: 'update', entity: 'tax_credits', ids: [3, 4, 5], details: { updatedCount: 3 } },
      { idx: 2, op: 'delete', entity: 'documents', ids: [10, 11], details: { deletedCount: 2 } },
      { idx: 3, op: 'update', entity: 'income_sources', ids: [12, 13, 14], details: { updatedCount: 3 } },
      { idx: 5, op: 'delete', entity: 'notifications', ids: [1, 2, 3, 4, 5], details: { deletedCount: 5, reason: 'admin cleanup' } },
      { idx: 5, op: 'update', entity: 'users', ids: [1, 2, 3], details: { updatedCount: 3, updates: { role: 'user' } } },
      { idx: 6, op: 'delete', entity: 'deductions', ids: [20, 21], details: { deletedCount: 2 } },
      { idx: 8, op: 'update', entity: 'tax_credits', ids: [8, 9], details: { updatedCount: 2 } },
      { idx: 9, op: 'delete', entity: 'user_expenses', ids: [15, 16, 17], details: { deletedCount: 3 } },
      { idx: 10, op: 'update', entity: 'income_sources', ids: [1, 2, 3, 4, 5], details: { updatedCount: 5, updates: { sourceType: 'W-2' } } },
      { idx: 11, op: 'delete', entity: 'dependents', ids: [5, 6], details: { deletedCount: 2 } },
      { idx: 13, op: 'update', entity: 'deductions', ids: [25, 26, 27], details: { updatedCount: 3, updates: { category: 'Medical Expenses' } } },
      { idx: 14, op: 'delete', entity: 'documents', ids: [30, 31, 32], details: { deletedCount: 3 } },
    ];

    for (const op of bulkOps) {
      await pool.query(
        `INSERT INTO bulk_operations_log (user_id, operation_type, entity_type, entity_ids, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [users[op.idx].id, op.op, op.entity, JSON.stringify(op.ids), JSON.stringify(op.details)]
      );
    }
    console.log('Bulk operations log seeded: 15');

    // ============================================================
    // 8. Additional Audit Log entries for new features - 16 entries
    // ============================================================
    const auditEntries = [
      { idx: 0, action: 'PASSWORD_RESET_REQUEST', entity_type: 'user' },
      { idx: 0, action: 'PASSWORD_RESET_COMPLETE', entity_type: 'user' },
      { idx: 1, action: 'EMAIL_VERIFIED', entity_type: 'user' },
      { idx: 2, action: 'ROLE_CHANGED', entity_type: 'user' },
      { idx: 3, action: 'BULK_DELETE', entity_type: 'income_sources' },
      { idx: 4, action: 'BULK_UPDATE', entity_type: 'deductions' },
      { idx: 5, action: 'CSV_EXPORT', entity_type: 'income_sources' },
      { idx: 5, action: 'ADMIN_USER_UPDATE', entity_type: 'user' },
      { idx: 6, action: 'PASSWORD_CHANGE', entity_type: 'user' },
      { idx: 7, action: 'PASSWORD_RESET_REQUEST', entity_type: 'user' },
      { idx: 8, action: 'BULK_DELETE', entity_type: 'tax_credits' },
      { idx: 9, action: 'CSV_EXPORT', entity_type: 'deductions' },
      { idx: 10, action: 'ROLE_CHANGED', entity_type: 'user' },
      { idx: 11, action: 'EMAIL_VERIFIED', entity_type: 'user' },
      { idx: 12, action: 'ACCOUNT_LOCKED', entity_type: 'user' },
      { idx: 14, action: 'BULK_UPDATE', entity_type: 'income_sources' },
    ];

    for (const entry of auditEntries) {
      await pool.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [users[entry.idx].id, entry.action, entry.entity_type, users[entry.idx].id, '192.168.1.' + (entry.idx + 100)]
      );
    }
    console.log('Additional audit log entries seeded: 16');

    // ============================================================
    // Summary
    // ============================================================
    console.log('\n=== Feature seeding completed successfully! ===');
    console.log('Summary:');
    console.log('- User Roles: 15 (3 admin, 3 accountant, 9 user)');
    console.log('- Password Reset Tokens: 15');
    console.log('- Email Verification Tokens: 15');
    console.log('- User Sessions: 15');
    console.log('- Notifications: 16');
    console.log('- Rate Limit Logs: 15');
    console.log('- Bulk Operations Log: 15');
    console.log('- Audit Log (new features): 16');
    console.log('\nRoles:');
    console.log('  Admin: diana.ross@email.com, ivan.thomas@email.com');
    console.log('  Accountant: bob.wilson@email.com, george.martinez@email.com, mike.clark@email.com');
    console.log('  Unverified: alice.johnson@email.com, fiona.garcia@email.com, kevin.white@email.com');

    process.exit(0);
  } catch (error) {
    console.error('Feature seeding failed:', error);
    process.exit(1);
  }
}

seedFeatures();
