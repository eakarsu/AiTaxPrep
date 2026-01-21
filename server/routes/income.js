const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all income sources for a tax year
router.get('/tax-year/:taxYearId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.* FROM income_sources i
       JOIN tax_years ty ON i.tax_year_id = ty.id
       WHERE i.tax_year_id = $1 AND ty.user_id = $2
       ORDER BY i.wages DESC`,
      [req.params.taxYearId, req.user.id]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      sourceType: row.source_type,
      employerName: row.employer_name,
      employerEin: row.employer_ein,
      employerAddress: row.employer_address,
      wages: parseFloat(row.wages) || 0,
      federalTaxWithheld: parseFloat(row.federal_tax_withheld) || 0,
      stateTaxWithheld: parseFloat(row.state_tax_withheld) || 0,
      socialSecurityWages: parseFloat(row.social_security_wages) || 0,
      socialSecurityTax: parseFloat(row.social_security_tax) || 0,
      medicareWages: parseFloat(row.medicare_wages) || 0,
      medicareTax: parseFloat(row.medicare_tax) || 0,
      otherIncome: parseFloat(row.other_income) || 0,
      description: row.description,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Get income sources error:', error);
    res.status(500).json({ error: 'Failed to get income sources' });
  }
});

// Get single income source
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.* FROM income_sources i
       JOIN tax_years ty ON i.tax_year_id = ty.id
       WHERE i.id = $1 AND ty.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income source not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      taxYearId: row.tax_year_id,
      sourceType: row.source_type,
      employerName: row.employer_name,
      employerEin: row.employer_ein,
      employerAddress: row.employer_address,
      wages: parseFloat(row.wages) || 0,
      federalTaxWithheld: parseFloat(row.federal_tax_withheld) || 0,
      stateTaxWithheld: parseFloat(row.state_tax_withheld) || 0,
      socialSecurityWages: parseFloat(row.social_security_wages) || 0,
      socialSecurityTax: parseFloat(row.social_security_tax) || 0,
      medicareWages: parseFloat(row.medicare_wages) || 0,
      medicareTax: parseFloat(row.medicare_tax) || 0,
      otherIncome: parseFloat(row.other_income) || 0,
      description: row.description
    });
  } catch (error) {
    console.error('Get income source error:', error);
    res.status(500).json({ error: 'Failed to get income source' });
  }
});

// Create income source
router.post('/', async (req, res) => {
  try {
    const {
      taxYearId, sourceType, employerName, employerEin, employerAddress,
      wages, federalTaxWithheld, stateTaxWithheld, socialSecurityWages,
      socialSecurityTax, medicareWages, medicareTax, otherIncome, description
    } = req.body;

    // Verify tax year belongs to user
    const tyResult = await db.query(
      'SELECT id FROM tax_years WHERE id = $1 AND user_id = $2',
      [taxYearId, req.user.id]
    );

    if (tyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tax year not found' });
    }

    const result = await db.query(
      `INSERT INTO income_sources (
         user_id, tax_year_id, source_type, employer_name, employer_ein,
         employer_address, wages, federal_tax_withheld, state_tax_withheld,
         social_security_wages, social_security_tax, medicare_wages,
         medicare_tax, other_income, description
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        req.user.id, taxYearId, sourceType, employerName, employerEin,
        employerAddress, wages || 0, federalTaxWithheld || 0, stateTaxWithheld || 0,
        socialSecurityWages || 0, socialSecurityTax || 0, medicareWages || 0,
        medicareTax || 0, otherIncome || 0, description
      ]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      sourceType: row.source_type,
      employerName: row.employer_name,
      wages: parseFloat(row.wages) || 0,
      federalTaxWithheld: parseFloat(row.federal_tax_withheld) || 0
    });
  } catch (error) {
    console.error('Create income source error:', error);
    res.status(500).json({ error: 'Failed to create income source' });
  }
});

// Update income source
router.put('/:id', async (req, res) => {
  try {
    const {
      sourceType, employerName, employerEin, employerAddress,
      wages, federalTaxWithheld, stateTaxWithheld, socialSecurityWages,
      socialSecurityTax, medicareWages, medicareTax, otherIncome, description
    } = req.body;

    const result = await db.query(
      `UPDATE income_sources SET
         source_type = COALESCE($1, source_type),
         employer_name = COALESCE($2, employer_name),
         employer_ein = COALESCE($3, employer_ein),
         employer_address = COALESCE($4, employer_address),
         wages = COALESCE($5, wages),
         federal_tax_withheld = COALESCE($6, federal_tax_withheld),
         state_tax_withheld = COALESCE($7, state_tax_withheld),
         social_security_wages = COALESCE($8, social_security_wages),
         social_security_tax = COALESCE($9, social_security_tax),
         medicare_wages = COALESCE($10, medicare_wages),
         medicare_tax = COALESCE($11, medicare_tax),
         other_income = COALESCE($12, other_income),
         description = COALESCE($13, description),
         updated_at = NOW()
       WHERE id = $14 AND user_id = $15
       RETURNING *`,
      [
        sourceType, employerName, employerEin, employerAddress,
        wages, federalTaxWithheld, stateTaxWithheld, socialSecurityWages,
        socialSecurityTax, medicareWages, medicareTax, otherIncome, description,
        req.params.id, req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income source not found' });
    }

    res.json({ message: 'Income source updated successfully' });
  } catch (error) {
    console.error('Update income source error:', error);
    res.status(500).json({ error: 'Failed to update income source' });
  }
});

// Delete income source
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM income_sources WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income source not found' });
    }

    res.json({ message: 'Income source deleted successfully' });
  } catch (error) {
    console.error('Delete income source error:', error);
    res.status(500).json({ error: 'Failed to delete income source' });
  }
});

// Get income summary for tax year
router.get('/tax-year/:taxYearId/summary', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         source_type,
         COUNT(*) as count,
         SUM(wages) as total_wages,
         SUM(other_income) as total_other,
         SUM(federal_tax_withheld) as fed_withheld
       FROM income_sources i
       JOIN tax_years ty ON i.tax_year_id = ty.id
       WHERE i.tax_year_id = $1 AND ty.user_id = $2
       GROUP BY source_type`,
      [req.params.taxYearId, req.user.id]
    );

    res.json(result.rows.map(row => ({
      sourceType: row.source_type,
      count: parseInt(row.count),
      totalWages: parseFloat(row.total_wages) || 0,
      totalOther: parseFloat(row.total_other) || 0,
      federalWithheld: parseFloat(row.fed_withheld) || 0
    })));
  } catch (error) {
    console.error('Get income summary error:', error);
    res.status(500).json({ error: 'Failed to get income summary' });
  }
});

module.exports = router;
