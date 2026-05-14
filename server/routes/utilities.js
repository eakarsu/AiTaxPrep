// Mechanical utilities for AiTaxPrep:
//   1. multi-state filer summary — POST /utilities/multistate
//   2. document auto-categorization — POST /utilities/auto-categorize
//   3. tax plan visualization — POST /utilities/visualization
const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 1. Multi-state filer summary.
// Input: { residency_state, income_by_state: {CA: 50000, NY: 20000}, days_by_state: {CA: 200, NY: 165} }
// Output: state apportionment + which returns to file (resident, part-year, non-resident).
router.post('/multistate', (req, res) => {
  const { residency_state, income_by_state = {}, days_by_state = {} } = req.body || {};
  if (!residency_state) return res.status(400).json({ error: 'residency_state required' });
  const totalIncome = Object.values(income_by_state).reduce((a, b) => a + Number(b || 0), 0) || 1;
  const summaries = Object.keys(income_by_state).map((state) => {
    const days = Number(days_by_state[state] || 0);
    let returnType = 'non_resident';
    if (state === residency_state && days >= 183) returnType = 'resident';
    else if (state === residency_state && days < 183) returnType = 'part_year';
    else if (days >= 183) returnType = 'resident_alt';
    return {
      state,
      income: Number(income_by_state[state]),
      pct_of_total: Math.round(((Number(income_by_state[state]) / totalIncome) * 1000)) / 10,
      days,
      return_type: returnType,
    };
  });
  return res.json({
    residency_state,
    total_income: totalIncome,
    state_summaries: summaries,
    note: 'Reciprocity agreements not modeled — verify state-specific rules.',
  });
});

// 2. Document auto-categorization (regex-based).
// PRODUCT-DECISION: simple keyword classifier. Real OCR + ML categorization gated on env DOC_CATEGORIZER_PROVIDER.
const CATEGORIES = [
  { id: 'w2', label: 'W-2 Wage Statement', patterns: [/\bw-?2\b/i, /wage and tax statement/i, /employer.*EIN/i] },
  { id: '1099_int', label: '1099-INT (Interest)', patterns: [/\b1099-?int\b/i, /interest income/i] },
  { id: '1099_div', label: '1099-DIV (Dividends)', patterns: [/\b1099-?div\b/i, /dividends and distributions/i] },
  { id: '1099_b', label: '1099-B (Brokerage)', patterns: [/\b1099-?b\b/i, /proceeds from broker/i] },
  { id: '1099_misc', label: '1099-MISC', patterns: [/\b1099-?misc\b/i] },
  { id: '1099_nec', label: '1099-NEC (Contractor)', patterns: [/\b1099-?nec\b/i, /nonemployee compensation/i] },
  { id: 'k1', label: 'Schedule K-1', patterns: [/schedule k-?1/i, /\bk-?1\b/i] },
  { id: 'mortgage', label: 'Mortgage Interest (1098)', patterns: [/\b1098\b/i, /mortgage interest statement/i] },
  { id: 'donation', label: 'Charitable Donation', patterns: [/donation receipt/i, /charitable contribution/i] },
  { id: 'medical', label: 'Medical Expense', patterns: [/explanation of benefits/i, /\bEOB\b/i, /medical bill/i] },
];

router.post('/auto-categorize', (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const matches = [];
  for (const c of CATEGORIES) {
    for (const p of c.patterns) {
      if (p.test(text)) {
        matches.push({ category: c.id, label: c.label, pattern: String(p) });
        break;
      }
    }
  }
  return res.json({ matches, top_category: matches[0] ? matches[0].category : 'unknown' });
});

// 3. Tax plan visualization.
// Input: { scenarios: [{name, taxable_income, federal_tax, state_tax, refund, owed}, ...] }
// Output: chart-ready data (bar chart per scenario) plus deltas vs. baseline.
router.post('/visualization', (req, res) => {
  const { scenarios = [] } = req.body || {};
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return res.status(400).json({ error: 'scenarios array required' });
  }
  const baseline = scenarios[0];
  const baseTotal = (baseline.federal_tax || 0) + (baseline.state_tax || 0);
  const series = scenarios.map((s, idx) => {
    const total = (s.federal_tax || 0) + (s.state_tax || 0);
    const delta = total - baseTotal;
    return {
      name: s.name || `Scenario ${idx + 1}`,
      taxable_income: s.taxable_income || 0,
      federal_tax: s.federal_tax || 0,
      state_tax: s.state_tax || 0,
      total_tax: total,
      net_refund: (s.refund || 0) - (s.owed || 0),
      delta_from_baseline: delta,
      delta_pct: baseTotal === 0 ? 0 : Math.round((delta / baseTotal) * 1000) / 10,
    };
  });
  return res.json({ baseline: series[0], scenarios: series });
});

module.exports = router;
