const { body, param, query, validationResult } = require('express-validator');

// Sanitize and validate middleware
const sanitizeMiddleware = (req, res, next) => {
  // Recursively sanitize string values in an object
  const sanitizeObj = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        // Remove null bytes
        sanitized[key] = obj[key].replace(/\0/g, '');
        // Trim whitespace
        sanitized[key] = sanitized[key].trim();
        // Prevent SQL injection patterns (basic)
        sanitized[key] = sanitized[key].replace(/['";\\]/g, (match) => {
          return '\\' + match;
        });
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = sanitizeObj(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
    return sanitized;
  };

  // Sanitize body
  if (req.body) {
    req.body = sanitizeObj(req.body);
  }

  // Sanitize query params
  if (req.query) {
    req.query = sanitizeObj(req.query);
  }

  next();
};

// Validation rules for common operations
const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain a special character'),
  body('firstName').trim().isLength({ min: 1, max: 100 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1, max: 100 }).withMessage('Last name is required'),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 1 }).withMessage('Password is required'),
];

const validatePasswordReset = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
];

const validatePasswordUpdate = [
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain a special character'),
];

const validateIncome = [
  body('sourceType').isIn(['W-2', '1099-NEC', '1099-INT', '1099-DIV', '1099-MISC']).withMessage('Invalid source type'),
  body('employerName').trim().isLength({ min: 1, max: 255 }).withMessage('Employer name is required'),
  body('wages').optional().isFloat({ min: 0 }).withMessage('Wages must be a positive number'),
];

const validateDeduction = [
  body('category').trim().isLength({ min: 1, max: 100 }).withMessage('Category is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
];

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().trim(),
  query('sortBy').optional().isString().trim(),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

const validateBulkOperation = [
  body('ids').isArray({ min: 1 }).withMessage('At least one ID is required'),
  body('ids.*').isInt({ min: 1 }).withMessage('Each ID must be a positive integer'),
];

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

module.exports = {
  sanitizeMiddleware,
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  validatePasswordUpdate,
  validateIncome,
  validateDeduction,
  validatePagination,
  validateBulkOperation,
  handleValidationErrors
};
