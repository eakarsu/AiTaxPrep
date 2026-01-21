const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

module.exports = app;
