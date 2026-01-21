const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const {
      firstName, lastName, phone, filingStatus,
      addressStreet, addressCity, addressState, addressZip,
      dateOfBirth
    } = req.body;

    const result = await db.query(
      `UPDATE users SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         phone = COALESCE($3, phone),
         filing_status = COALESCE($4, filing_status),
         address_street = COALESCE($5, address_street),
         address_city = COALESCE($6, address_city),
         address_state = COALESCE($7, address_state),
         address_zip = COALESCE($8, address_zip),
         date_of_birth = COALESCE($9, date_of_birth),
         updated_at = NOW()
       WHERE id = $10
       RETURNING id, email, first_name, last_name, phone, filing_status,
                 address_street, address_city, address_state, address_zip, date_of_birth`,
      [firstName, lastName, phone, filingStatus, addressStreet, addressCity, addressState, addressZip, dateOfBirth, req.user.id]
    );

    const user = result.rows[0];

    // Log update
    await db.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'UPDATE', 'profile', req.user.id]
    );

    res.json({
      message: 'Profile updated successfully',
      user: {
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
        dateOfBirth: user.date_of_birth
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = {};

    // Total tax years
    const taxYearsResult = await db.query(
      'SELECT COUNT(*) as count FROM tax_years WHERE user_id = $1',
      [req.user.id]
    );
    stats.totalTaxYears = parseInt(taxYearsResult.rows[0].count);

    // Total income sources
    const incomeResult = await db.query(
      'SELECT COUNT(*) as count FROM income_sources WHERE user_id = $1',
      [req.user.id]
    );
    stats.totalIncomeSources = parseInt(incomeResult.rows[0].count);

    // Total deductions
    const deductionsResult = await db.query(
      'SELECT COUNT(*) as count FROM deductions WHERE user_id = $1',
      [req.user.id]
    );
    stats.totalDeductions = parseInt(deductionsResult.rows[0].count);

    // Total documents
    const docsResult = await db.query(
      'SELECT COUNT(*) as count FROM documents WHERE user_id = $1',
      [req.user.id]
    );
    stats.totalDocuments = parseInt(docsResult.rows[0].count);

    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

module.exports = router;
