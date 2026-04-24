const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { passwordResetLimiter } = require('../middleware/rateLimiter');
const { validateRegistration, validateLogin, validatePasswordReset, validatePasswordUpdate, handleValidationErrors } = require('../middleware/sanitize');
const { requireRole } = require('../middleware/rbac');

// Password strength checker
function checkPasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    noCommon: !['password', '12345678', 'qwerty', 'abc123'].some(p => password.toLowerCase().includes(p))
  };

  const score = Object.values(checks).filter(Boolean).length;
  let strength = 'weak';
  if (score >= 5) strength = 'strong';
  else if (score >= 3) strength = 'medium';

  return { checks, score, strength, maxScore: 6 };
}

// Check password strength endpoint
router.post('/check-password-strength', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required' });
  res.json(checkPasswordStrength(password));
});

// Register new user with validation
router.post('/register', validateRegistration, handleValidationErrors, async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Password strength check
    const strength = checkPasswordStrength(password);
    if (strength.strength === 'weak') {
      return res.status(400).json({
        error: 'Password is too weak',
        passwordStrength: strength
      });
    }

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, email_verification_token, email_verification_expires, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', false)
       RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, firstName, lastName, phone, verificationToken, verificationExpires]
    );

    const user = result.rows[0];

    // Create default tax year
    await db.query(
      'INSERT INTO tax_years (user_id, year, status) VALUES ($1, $2, $3)',
      [user.id, new Date().getFullYear(), 'in_progress']
    );

    // Generate token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Log registration
    await db.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [user.id, 'REGISTER', 'user', user.id]
    );

    // Create welcome notification
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, action_url)
       VALUES ($1, 'info', 'Welcome to AI Tax Prep!', 'Your account has been created. Please verify your email to access all features.', '/profile')`,
      [user.id]
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      verificationToken,
      emailVerificationRequired: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, filing_status, role, email_verified,
              failed_login_attempts, locked_until
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        error: 'Account temporarily locked',
        message: `Too many failed login attempts. Try again in ${minutesLeft} minute(s).`,
        lockedUntil: user.locked_until
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Increment failed attempts
      const attempts = (user.failed_login_attempts || 0) + 1;
      let lockUntil = null;
      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
      }
      await db.query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockUntil, user.id]
      );
      return res.status(401).json({
        error: 'Invalid credentials',
        attemptsRemaining: Math.max(0, 5 - attempts)
      });
    }

    // Reset failed attempts on successful login
    await db.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
      [user.id]
    );

    // Generate token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Log login
    await db.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [user.id, 'LOGIN', 'user', user.id]
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        filingStatus: user.filing_status,
        role: user.role || 'user',
        emailVerified: user.email_verified || false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, phone, filing_status,
              address_street, address_city, address_state, address_zip,
              date_of_birth, role, email_verified, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];

    // Get unread notifications count
    const notifResult = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      filingStatus: user.filing_status,
      address: {
        street: user.address_street,
        city: user.address_city,
        state: user.address_state,
        zip: user.address_zip
      },
      dateOfBirth: user.date_of_birth,
      role: user.role || 'user',
      emailVerified: user.email_verified || false,
      unreadNotifications: parseInt(notifResult.rows[0].count),
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update password with strength validation
router.put('/password', authMiddleware, validatePasswordUpdate, handleValidationErrors, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Password strength check
    const strength = checkPasswordStrength(newPassword);
    if (strength.strength === 'weak') {
      return res.status(400).json({
        error: 'New password is too weak',
        passwordStrength: strength
      });
    }

    // Get current password hash
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newPasswordHash, req.user.id]);

    // Create notification
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'success', 'Password Updated', 'Your password has been changed successfully.')`,
      [req.user.id]
    );

    res.json({ message: 'Password updated successfully', passwordStrength: strength });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Request password reset
router.post('/forgot-password', passwordResetLimiter, validatePasswordReset, handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;

    const result = await db.query('SELECT id, email, first_name FROM users WHERE email = $1', [email]);

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If the email exists, a reset link will be sent.' });
    }

    const user = result.rows[0];

    // Invalidate any existing tokens
    await db.query('UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false', [user.id]);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetToken, expiresAt]
    );

    // Log the action
    await db.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [user.id, 'PASSWORD_RESET_REQUEST', 'user', user.id]
    );

    // In production, you would send an email here
    // For now, return the token (in dev mode only)
    res.json({
      message: 'If the email exists, a reset link will be sent.',
      ...(process.env.NODE_ENV !== 'production' && { resetToken, expiresAt })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Password strength check
    const strength = checkPasswordStrength(newPassword);
    if (strength.strength === 'weak') {
      return res.status(400).json({
        error: 'New password is too weak',
        passwordStrength: strength
      });
    }

    // Find valid token
    const result = await db.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1 AND prt.used = false AND prt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetRecord = result.rows[0];

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $2', [newPasswordHash, resetRecord.user_id]);

    // Mark token as used
    await db.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetRecord.id]);

    // Log
    await db.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [resetRecord.user_id, 'PASSWORD_RESET_COMPLETE', 'user', resetRecord.user_id]
    );

    // Create notification
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'success', 'Password Reset Complete', 'Your password has been successfully reset.')`,
      [resetRecord.user_id]
    );

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await db.query(
      `SELECT id, email FROM users
       WHERE email_verification_token = $1 AND email_verification_expires > NOW() AND email_verified = false`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const user = result.rows[0];

    // Mark email as verified
    await db.query(
      `UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Log
    await db.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [user.id, 'EMAIL_VERIFIED', 'user', user.id]
    );

    // Notification
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'success', 'Email Verified!', 'Your email has been verified. You now have full access to all features.')`,
      [user.id]
    );

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Resend verification email
router.post('/resend-verification', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT id, email, email_verified FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    if (user.email_verified) {
      return res.json({ message: 'Email is already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
      [verificationToken, verificationExpires, user.id]
    );

    res.json({
      message: 'Verification email resent',
      ...(process.env.NODE_ENV !== 'production' && { verificationToken })
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification' });
  }
});

// Get notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

module.exports = router;
