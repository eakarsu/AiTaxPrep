// CPA coordination workflow.
// PRODUCT-DECISION: a single optional CPA may be assigned to each user. The
// CPA can leave review notes against the user's tax year. Statuses:
// `draft -> with_cpa -> approved -> filed`. Override allowed states via
// CPA_WORKFLOW_STATES (CSV).
const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const STATES = (process.env.CPA_WORKFLOW_STATES || 'draft,with_cpa,approved,filed').split(',');

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS cpa_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        tax_year_id INTEGER NOT NULL,
        cpa_email VARCHAR(200),
        cpa_name VARCHAR(200),
        status VARCHAR(40) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS cpa_review_notes (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES cpa_assignments(id) ON DELETE CASCADE,
        author VARCHAR(40) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.error('cpa workflow init error:', e.message);
  }
})();

router.get('/', async (req, res) => {
  const userId = req.user.id;
  try {
    const r = await db.query('SELECT * FROM cpa_assignments WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return res.json({ assignments: r.rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/assign', async (req, res) => {
  const userId = req.user.id;
  const { tax_year_id, cpa_email, cpa_name } = req.body || {};
  if (!tax_year_id) return res.status(400).json({ error: 'tax_year_id required' });
  try {
    const r = await db.query(
      'INSERT INTO cpa_assignments (user_id, tax_year_id, cpa_email, cpa_name, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [userId, tax_year_id, cpa_email || null, cpa_name || null, 'with_cpa']
    );
    return res.json({ assignment: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/:id/status', async (req, res) => {
  const userId = req.user.id;
  const { status } = req.body || {};
  if (!STATES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATES.join(', ')}` });
  }
  try {
    const r = await db.query(
      'UPDATE cpa_assignments SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [status, req.params.id, userId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'assignment not found' });
    return res.json({ assignment: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/:id/notes', async (req, res) => {
  const { author = 'cpa', body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body required' });
  try {
    const r = await db.query(
      'INSERT INTO cpa_review_notes (assignment_id, author, body) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, author, body]
    );
    return res.json({ note: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/:id/notes', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM cpa_review_notes WHERE assignment_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    return res.json({ notes: r.rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
