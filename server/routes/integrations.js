// External integrations for AiTaxPrep.
// All routes 503 when env vars unset.
//
// Required env vars by integration:
//   IRS e-file:       IRS_EFIN, IRS_EFILE_API_KEY
//   State e-file:     STATE_EFILE_API_KEY (single key, jurisdiction in body)
//   Stripe billing:   STRIPE_SECRET_KEY
//   Plaid bank:       PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV
//   DocuSign:         DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_PRIVATE_KEY
const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function require503(envVars) {
  const missing = envVars.filter((v) => !process.env[v]);
  return missing.length > 0 ? missing : null;
}

router.post('/efile/irs', async (req, res) => {
  const missing = require503(['IRS_EFIN', 'IRS_EFILE_API_KEY']);
  if (missing) {
    return res.status(503).json({
      error: 'IRS e-file not configured',
      missing: missing.join(', '),
      configure: 'Set IRS e-file env vars to enable federal filing.',
    });
  }
  return res.json({ ok: true, provider: 'irs', simulated: true, accepted: true });
});

router.post('/efile/state', async (req, res) => {
  const missing = require503(['STATE_EFILE_API_KEY']);
  if (missing) {
    return res.status(503).json({
      error: 'State e-file not configured',
      missing: missing.join(', '),
      configure: 'Set STATE_EFILE_API_KEY to enable state filing.',
    });
  }
  const { state } = req.body || {};
  return res.json({ ok: true, provider: 'state', state: state || 'unknown', simulated: true });
});

router.post('/billing/stripe', async (req, res) => {
  const missing = require503(['STRIPE_SECRET_KEY']);
  if (missing) {
    return res.status(503).json({
      error: 'Stripe not configured',
      missing: missing.join(', '),
      configure: 'Set STRIPE_SECRET_KEY to enable plan upgrade billing.',
    });
  }
  return res.json({ ok: true, provider: 'stripe', simulated: true });
});

router.post('/bank/plaid', async (req, res) => {
  const missing = require503(['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV']);
  if (missing) {
    return res.status(503).json({
      error: 'Plaid not configured',
      missing: missing.join(', '),
      configure: 'Set Plaid env vars to enable bank import.',
    });
  }
  return res.json({ ok: true, provider: 'plaid', transactions: [], simulated: true });
});

router.post('/sign/docusign', async (req, res) => {
  const missing = require503(['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_PRIVATE_KEY']);
  if (missing) {
    return res.status(503).json({
      error: 'DocuSign not configured',
      missing: missing.join(', '),
      configure: 'Set DocuSign env vars to enable engagement letter signing.',
    });
  }
  return res.json({ ok: true, provider: 'docusign', envelope_id: 'simulated', simulated: true });
});

module.exports = router;
