const db = require('../config/database');

// Role hierarchy: admin > accountant > user
const ROLES = {
  admin: 3,
  accountant: 2,
  user: 1
};

// Permissions map
const PERMISSIONS = {
  // Admin-only operations
  'users:list': ['admin'],
  'users:delete': ['admin'],
  'users:update-role': ['admin'],
  'bulk:delete-any': ['admin'],
  'audit:view-all': ['admin'],

  // Admin + Accountant operations
  'reports:export': ['admin', 'accountant'],
  'calculations:override': ['admin', 'accountant'],
  'forms:submit': ['admin', 'accountant'],
  'bulk:update': ['admin', 'accountant', 'user'],

  // All authenticated users
  'income:read': ['admin', 'accountant', 'user'],
  'income:write': ['admin', 'accountant', 'user'],
  'deductions:read': ['admin', 'accountant', 'user'],
  'deductions:write': ['admin', 'accountant', 'user'],
  'credits:read': ['admin', 'accountant', 'user'],
  'credits:write': ['admin', 'accountant', 'user'],
  'documents:read': ['admin', 'accountant', 'user'],
  'documents:write': ['admin', 'accountant', 'user'],
  'profile:read': ['admin', 'accountant', 'user'],
  'profile:write': ['admin', 'accountant', 'user'],
  'export:csv': ['admin', 'accountant', 'user'],
};

// Check if user has required role
const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
      const userRole = result.rows[0]?.role || 'user';

      if (!roles.includes(userRole)) {
        return res.status(403).json({
          error: 'Access denied',
          message: `This action requires one of the following roles: ${roles.join(', ')}`,
          requiredRoles: roles,
          currentRole: userRole
        });
      }

      req.user.role = userRole;
      next();
    } catch (error) {
      console.error('RBAC error:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

// Check specific permission
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
      const userRole = result.rows[0]?.role || 'user';

      const allowedRoles = PERMISSIONS[permission];
      if (!allowedRoles) {
        return res.status(403).json({ error: 'Unknown permission' });
      }

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: 'Permission denied',
          message: `You don't have the '${permission}' permission`,
          requiredPermission: permission,
          currentRole: userRole
        });
      }

      req.user.role = userRole;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

// Middleware to attach role to user
const attachRole = async (req, res, next) => {
  try {
    if (req.user) {
      const result = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
      req.user.role = result.rows[0]?.role || 'user';
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = { requireRole, requirePermission, attachRole, ROLES, PERMISSIONS };
