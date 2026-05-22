const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    feature: 'K-1 Intake Review',
    summary: { formsReceived: 7, missingBasis: 2, passiveLossAtRisk: 18400, reviewStatus: 'Needs CPA review' },
    entities: [
      { name: 'Northlake Partners LP', box: 'Box 1 ordinary income', amount: 21200, issue: 'Basis statement missing' },
      { name: 'Cedar Real Estate Fund', box: 'Box 2 rental income', amount: -8900, issue: 'Passive loss limitation' },
      { name: 'Summit Energy LLC', box: 'Box 20 code Z', amount: 5400, issue: 'QBI detail required' },
    ],
    checklist: [
      'Match each K-1 EIN and entity name to prior-year carryforwards.',
      'Request basis schedules before allowing loss utilization.',
      'Separate passive, portfolio, and self-employment income treatments.',
    ],
  });
});

module.exports = router;
