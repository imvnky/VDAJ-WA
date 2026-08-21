/**
 * VDAJ Services — Auth & RBAC Middleware
 * JWT validation (HTTP-only cookie) + role-based access guard
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('./responseHandler');

// ============================================================
// AUTHENTICATE — Validate JWT from HTTP-only cookie
// ============================================================

const authenticate = catchAsync(async (req, res, next) => {
  const token = req.cookies?.[process.env.JWT_COOKIE_NAME || 'vdaj_access_token'];

  if (!token) {
    throw new AppError('Authentication token is missing.', 401, 'ERR_VDAJ_AUTH_003');
  }

  // Verify token — throws JsonWebTokenError or TokenExpiredError (handled by globalErrorHandler)
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Fetch user from DB (ensures account wasn't deleted/deactivated mid-session)
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
            u.tenant_id, t.id AS t_id, t.name AS tenant_name, t.is_active AS tenant_active,
            t.waba_id, t.phone_number_id, t.meta_system_token, t.timezone,
            t.max_messages_per_day, t.monthly_message_quota, t.enabled_features
     FROM users u
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [decoded.sub]
  );

  if (!rows.length) {
    throw new AppError('User no longer exists.', 401, 'ERR_VDAJ_AUTH_004');
  }

  const user = rows[0];

  if (!user.is_active) {
    throw new AppError('Account is inactive.', 403, 'ERR_VDAJ_AUTH_002');
  }

  // Attach user to request
  req.user = {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    tenantId: user.tenant_id,
  };

  // Attach tenant context (null for super_admin)
  if (user.tenant_id) {
    if (!user.tenant_active) {
      throw new AppError('Tenant is inactive.', 403, 'ERR_VDAJ_TENANT_002');
    }
    req.tenant = {
      id: user.t_id,
      name: user.tenant_name,
      wabaId: user.waba_id,
      phoneNumberId: user.phone_number_id,
      metaSystemToken: user.meta_system_token,
      timezone: user.timezone,
      maxMessagesPerDay: user.max_messages_per_day,
      monthlyMessageQuota: user.monthly_message_quota,
      // Feature flags — used by frontend for RBAC sidebar gating
      enabledFeatures: user.enabled_features || [],
    };
  }

  next();
});

// ============================================================
// AUTHORIZE — Role-based access control guard
// Usage: authorize('super_admin') | authorize('tenant_admin', 'super_admin')
// ============================================================

const authorize = (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated.', 401, 'ERR_VDAJ_AUTH_003'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403, 'ERR_VDAJ_AUTH_006'));
    }
    next();
  };

// ============================================================
// TENANT ISOLATION — Ensure user can only access their own tenant
// ============================================================

const enforceTenantIsolation = (req, res, next) => {
  // super_admin bypasses all tenant checks
  if (req.user.role === 'super_admin') return next();

  const tenantIdFromParam = req.params.tenantId;
  if (tenantIdFromParam && tenantIdFromParam !== req.user.tenantId) {
    return next(new AppError('Access denied to this tenant.', 403, 'ERR_VDAJ_AUTH_006'));
  }

  next();
};

module.exports = { authenticate, authorize, enforceTenantIsolation };
