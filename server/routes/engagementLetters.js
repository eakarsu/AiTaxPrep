// Engagement letter templates.
// PRODUCT-DECISION: 3 built-in templates (individual_basic, individual_complex,
// business). User can create their own. Override default set via env
// ENGAGEMENT_TEMPLATE_DIR (filesystem). Variables {{client_name}},
// {{tax_year}}, {{fee}}, {{firm}} are replaced server-side at render time.
const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const BUILTIN_TEMPLATES = {
  individual_basic: {
    name: 'Individual — Basic Return',
    body: 'Dear {{client_name}},\n\nThis letter confirms our engagement to prepare your {{tax_year}} federal and state individual income tax returns. Our fee for these services is {{fee}}.\n\nSincerely,\n{{firm}}',
  },
  individual_complex: {
    name: 'Individual — Complex (Schedules C/D/E)',
    body: 'Dear {{client_name}},\n\nThis engagement letter confirms our engagement to prepare your {{tax_year}} federal and state individual income tax returns including Schedule C, D, and/or E activities. Our fee is {{fee}}, billed in stages.\n\nSincerely,\n{{firm}}',
  },
  business: {
    name: 'Business Entity (Form 1120/1120-S/1065)',
    body: 'Dear {{client_name}},\n\nThis engagement letter confirms our engagement to prepare the {{tax_year}} business income tax return for the entity, including supporting schedules. Our fee is {{fee}}.\n\nSincerely,\n{{firm}}',
  },
};

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS engagement_letters (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        template_key VARCHAR(80),
        client_name VARCHAR(200),
        tax_year VARCHAR(8),
        fee VARCHAR(40),
        firm VARCHAR(200),
        rendered TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.error('engagement_letters table init error:', e.message);
  }
})();

function fillTemplate(body, ctx) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(ctx[key] ?? `{{${key}}}`));
}

router.get('/templates', (req, res) => {
  return res.json({ templates: BUILTIN_TEMPLATES });
});

router.post('/render', async (req, res) => {
  const userId = req.user.id;
  const { template_key, client_name, tax_year, fee, firm } = req.body || {};
  const tpl = BUILTIN_TEMPLATES[template_key];
  if (!tpl) return res.status(400).json({ error: 'unknown template_key' });
  const ctx = { client_name: client_name || '', tax_year: tax_year || '', fee: fee || '', firm: firm || '' };
  const rendered = fillTemplate(tpl.body, ctx);
  try {
    const r = await db.query(
      'INSERT INTO engagement_letters (user_id, template_key, client_name, tax_year, fee, firm, rendered) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [userId, template_key, ctx.client_name, ctx.tax_year, ctx.fee, ctx.firm, rendered]
    );
    return res.json({ letter: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  const userId = req.user.id;
  try {
    const r = await db.query('SELECT * FROM engagement_letters WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
    return res.json({ letters: r.rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
