const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
require('dotenv').config();

const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { sanitizeMiddleware } = require('./middleware/sanitize');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const taxYearRoutes = require('./routes/taxYears');
const incomeRoutes = require('./routes/income');
const deductionRoutes = require('./routes/deductions');
const creditRoutes = require('./routes/credits');
const dependentRoutes = require('./routes/dependents');
const documentRoutes = require('./routes/documents');
const expenseRoutes = require('./routes/expenses');
const calculationRoutes = require('./routes/calculations');
const adviceRoutes = require('./routes/advice');
const dashboardRoutes = require('./routes/dashboard');
const formRoutes = require('./routes/forms');
const aiRoutes = require('./routes/ai');
const advancedRoutes = require('./routes/advanced');
const aiFeaturesRoutes = require('./routes/ai-features');

const app = express();

// Security headers via helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Input sanitization
app.use(sanitizeMiddleware);

// Rate limiting on all API routes
app.use('/api', apiLimiter);

// Stricter rate limiting on auth routes
app.use('/api/auth', authLimiter);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tax-years', taxYearRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/deductions', deductionRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/dependents', dependentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/calculations', calculationRoutes);
app.use('/api/advice', adviceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/advanced', advancedRoutes);
app.use('/api/ai-features', aiFeaturesRoutes);
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/cpa', require('./routes/cpaWorkflow'));
app.use('/api/engagement', require('./routes/engagementLetters'));
app.use('/api/utilities', require('./routes/utilities'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

const PORT = process.env.PORT || 5001;
app.use('/api/tax-scenarios', require('./routes/taxScenarios')); app.use('/api/estimated-tax-planner', require('./routes/estimatedTaxPlanner')); app.use('/api/multi-state-planner', require('./routes/multiStatePlanner')); app.use('/api/document-auto-categorize', require('./routes/documentAutoCategorize')); app.use('/api/engagement-esign', require('./routes/engagementEsign')); app.use('/api/irs-notice-responder', require('./routes/irsNoticeResponder'));
app.use('/api/k1-intake-review', require('./routes/k1IntakeReview'));

// === Batch 08 Gaps & Frontend Mounts ===
app.use('/api/gap-no-state-local-tax-optimization-ai', require('./routes/gapNoStateLocalTaxOptimizationAi'));
app.use('/api/gap-no-estimated-payment-planning-ai', require('./routes/gapNoEstimatedPaymentPlanningAi'));
app.use('/api/gap-no-automated-audit-risk-early-warning-monitor', require('./routes/gapNoAutomatedAuditRiskEarlyWarningMonitor'));
app.use('/api/gap-no-e-filing-integration-efin-irs-mef', require('./routes/gapNoEFilingIntegrationEfinIrsMef'));
app.use('/api/gap-limited-cpa-coordination-beyond-engagement-letters', require('./routes/gapLimitedCpaCoordinationBeyondEngagementLetters'));
app.use('/api/gap-no-tax-plan-comparison-standard-vs-itemized-visualizations', require('./routes/gapNoTaxPlanComparisonStandardVsItemizedVisualizations'));
app.use('/api/gap-no-year-over-year-comparison-and-anomaly-detection', require('./routes/gapNoYearOverYearComparisonAndAnomalyDetection'));
app.use('/api/gap-no-webhooks-notifications-system', require('./routes/gapNoWebhooksNotificationsSystem'));
app.use('/api/gap-no-audit-log-subsystem', require('./routes/gapNoAuditLogSubsystem'));
app.use('/api/gap-limited-integrations-module-exists-but-not-deeply-wired', require('./routes/gapLimitedIntegrationsModuleExistsButNotDeeplyWired'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

module.exports = app;
