'use strict';
const express = require('express');
const db = require('../config/database');
const router = express.Router();

router.post('/tax-guidance', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || !Object.keys(req.body).length) return res.status(400).json({ error: 'tax_context_required' });
    const serialized = JSON.stringify(req.body);
    if (/ssn|social.?security|taxpayer.?name|address|date.?of.?birth/i.test(serialized)) return res.status(400).json({ error: 'sensitive_taxpayer_data_rejected' });
    const { OPENROUTER_API_KEY: key, OPENROUTER_MODEL: model, OPENROUTER_BASE_URL: base } = process.env;
    if (base !== 'https://openrouter.ai/api/v1' || !key || !model) throw new Error('OpenRouter runtime configuration is incomplete');
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [
        { role: 'system', content: 'Give concise educational tax-filing guidance with assumptions, relevant forms, and a recommendation to confirm with a qualified preparer.' },
        { role: 'user', content: serialized },
      ] }),
    });
    if (!response.ok) throw new Error(`OpenRouter request failed with status ${response.status}`);
    const body = await response.json();
    const result = body.choices?.[0]?.message?.content;
    if (!result) throw new Error('OpenRouter returned no usable content');
    const saved = await db.query(
      `INSERT INTO tax_runtime_ai_results(user_id,input,result,model)
       VALUES($1,$2::jsonb,$3::jsonb,$4) RETURNING id,created_at`,
      [req.user.userId, serialized, JSON.stringify({ text: result }), body.model || model],
    );
    return res.json({ success: true, result, model: body.model || model, persisted: saved.rows[0] });
  } catch (error) {
    console.error('Runtime AI error:', error.message);
    return res.status(502).json({ error: 'provider_request_failed' });
  }
});

module.exports = router;
