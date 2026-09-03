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
  // Accept token from cookie OR Authorization: Bearer header
  let token = req.cookies?.[process.env.JWT_COOKIE_NAME || 'vdaj_access_token'];
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

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
  // NOTE: For impersonation sessions, decoded.tenantId is the TARGET tenant's ID
  // and decoded.is_impersonating = true. We surface this so /auth/me can tell
  // the frontend to restore the impersonation banner on page refresh.
  req.user = {
    id:       user.id,
    email:    user.email,
    firstName: user.first_name,
    lastName:  user.last_name,
    role:      user.role,
    tenantId:  user.tenant_id,
    // Impersonation fields — only present when token is scoped
    isImpersonating:  decoded.is_impersonating  || false,
    originalUserId:   decoded.original_user_id  || null,
  };

  // Attach tenant context (fallback to primary active tenant if not explicitly assigned, e.g. super_admin)
  let activeTenantId = user.tenant_id;
  let activeTenant = user.t_id ? {
    id:             user.t_id,
    name:           user.tenant_name,
    wabaId:         user.waba_id,
    phoneNumberId:  user.phone_number_id,
    metaSystemToken: user.meta_system_token,
    timezone:        user.timezone,
    maxMessagesPerDay:   user.max_messages_per_day,
    monthlyMessageQuota: user.monthly_message_quota,
    enabledFeatures: user.enabled_features || [],
  } : null;

  if (!activeTenantId) {
    const { rows: [primaryT] } = await query(
      `SELECT id, name, is_active, waba_id, phone_number_id, meta_system_token, timezone,
              max_messages_per_day, monthly_message_quota, enabled_features
       FROM tenants
       WHERE deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 1`
    );
    if (primaryT) {
      activeTenantId = primaryT.id;
      req.user.tenantId = primaryT.id;
      activeTenant = {
        id:             primaryT.id,
        name:           primaryT.name,
        wabaId:         primaryT.waba_id,
        phoneNumberId:  primaryT.phone_number_id,
        metaSystemToken: primaryT.meta_system_token,
        timezone:        primaryT.timezone,
        maxMessagesPerDay:   primaryT.max_messages_per_day,
        monthlyMessageQuota: primaryT.monthly_message_quota,
        enabledFeatures: primaryT.enabled_features || [],
      };
    }
  }

  if (activeTenant) {
    if (user.tenant_id && !user.tenant_active) {
      throw new AppError('Tenant is inactive.', 403, 'ERR_VDAJ_TENANT_002');
    }
    req.tenant = activeTenant;
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
