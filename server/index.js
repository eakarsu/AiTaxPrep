const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { sanitizeMiddleware } = require('./middleware/sanitize');
const governanceRouter = require('./governance');

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
const signedAccess = (req, res, next) => {
  const secret = process.env.JWT_SECRET || '';
  const token = req.headers.authorization && req.headers.authorization.match(/^Bearer (.+)$/)?.[1];
  if (secret.length < 32) return res.status(503).json({ error: 'secure JWT configuration required' });
  try {
    const claims = jwt.verify(token || '', secret, { algorithms: ['HS256'] });
    if (!claims.tenantId || !claims.role || !Array.isArray(claims.subjectIds)) throw new Error('claims');
    req.user = claims; return next();
  } catch (_) { return res.status(401).json({ error: 'signed tenant, role, and subject scope required' }); }
};

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
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Static files for uploads
app.use('/uploads', signedAccess, express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/governance', governanceRouter);
app.use('/api', signedAccess);
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
if (process.env.ENABLE_GENERATED_FEATURES === 'true' && process.env.NODE_ENV !== 'production') {
  app.use('/api/generated/tax-scenarios', require('./routes/taxScenarios'));
  app.use('/api/generated/estimated-tax-planner', require('./routes/estimatedTaxPlanner'));
  app.use('/api/generated/multi-state-planner', require('./routes/multiStatePlanner'));
  app.use('/api/generated/document-auto-categorize', require('./routes/documentAutoCategorize'));
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

module.exports = app;
