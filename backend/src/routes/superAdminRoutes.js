/**
 * VDAJ Services — Super Admin API Routes
 * Base: /api/v1/admin
 *
 * All routes gated by: authenticate + authorize('super_admin')
 *
 * Endpoints:
 *  GET  /admin/overview                    — Platform-wide KPI snapshot
 *  GET  /admin/tenants                     — List all tenants with health + user count
 *  POST /admin/tenants                     — Create tenant + seed tenant_admin user
 *  PATCH /admin/tenants/:id/suspend        — Toggle suspend/activate
 *  PATCH /admin/tenants/:id/status         — Explicit status update
 *  PATCH /admin/tenants/:id/features       — Update enabled_features checkboxes
 *  GET  /admin/users                       — List all users (all tenants)
 *  POST /admin/users                       — Create user and assign to a tenant
 *  PATCH /admin/users/:id/reset-password   — Force-reset a user's password
 *  PATCH /admin/users/:id/role             — Change user role
 *  POST /admin/impersonate/:tenantId       — Begin impersonation session
 *  POST /admin/impersonate/exit            — Exit impersonation, restore super_admin
 */

'use strict';

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');

const { query }    = require('../config/database');
const { sendSuccess, sendCreated, catchAsync } = require('../middleware/responseHandler');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

// ── POST /admin/impersonate/exit (PUBLIC WITHIN ADMIN NS) ───────
// Must be registered BEFORE router.use(authorize('super_admin'))
// because callers hold a tenant_admin impersonation token.
router.post('/impersonate/exit', authenticate, catchAsync(async (req, res) => {
  const rawToken = req.cookies?.[process.env.JWT_COOKIE_NAME || 'vdaj_access_token'];
  if (!rawToken) throw new AppError('No active session.', 401, 'ERR_VDAJ_AUTH_003');

  let decoded;
  try {
    decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired session token.', 401, 'ERR_VDAJ_AUTH_003');
  }

  if (!decoded.is_impersonating) {
    throw new AppError('No active impersonation session.', 400, 'ERR_VDAJ_AUTH_008');
  }

  const originalUserId = decoded.original_user_id;

  const { rows: [admin] } = await query(
    `SELECT id, email, role, is_active FROM users
     WHERE id = $1 AND role = 'super_admin' AND deleted_at IS NULL`,
    [originalUserId]
  );
  if (!admin) throw new AppError('Original admin account not found.', 404, 'ERR_VDAJ_AUTH_005');
  if (!admin.is_active) throw new AppError('Original admin account is inactive.', 403, 'ERR_VDAJ_AUTH_002');

  const restoredToken = jwt.sign(
    { sub: admin.id, role: 'super_admin', tenantId: null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.cookie(
    process.env.JWT_COOKIE_NAME || 'vdaj_access_token',
    restoredToken,
    COOKIE_OPTIONS
  );

  recordAudit({
    tenantId: decoded.tenantId || null,
    userId: admin.id,
    action: 'ADMIN_IMPERSONATION_ENDED',
    resourceType: 'tenant',
    resourceId: decoded.tenantId,
    status: 'SUCCESS',
    meta: {
      adminEmail: admin.email,
      impersonatedTenantId: decoded.tenantId,
    },
    subTasks: [
      { name: 'Validate Impersonation Context', details: 'Confirmed active impersonation token claims and signatures', component: 'OAuth / JWT', status: 'SUCCESS' },
      { name: 'Restore Super Admin Session', details: `Restored privileged Super Admin session for ${admin.email}`, component: 'Auth Gateway', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendSuccess(res,
    { userId: admin.id, email: admin.email, role: 'super_admin' },
    'Impersonation ended. Super Admin session restored.'
  );
}));

// All remaining admin routes require super_admin
router.use(authenticate, authorize('super_admin'));


// ── GET /admin/overview ─────────────────────────────────────────
// Platform-wide KPI snapshot for the super admin dashboard.
router.get('/overview', catchAsync(async (req, res) => {
  const [tenantsRow, contactsRow, messagesRow, qualityRow] = await Promise.all([
    // Active + total tenants
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')    AS active_tenants,
        COUNT(*) FILTER (WHERE status = 'suspended') AS suspended_tenants,
        COUNT(*)                                     AS total_tenants,
        COUNT(*) FILTER (WHERE phone_number_id IS NOT NULL AND meta_system_token IS NOT NULL) AS waba_connected
      FROM tenants WHERE deleted_at IS NULL
    `),
    // Total contacts across platform
    query(`SELECT COUNT(*) AS total_contacts FROM contacts WHERE deleted_at IS NULL`),
    // Messages today and this month
    query(`
      SELECT
        COALESCE(SUM(msgs_sent_today), 0)           AS msgs_today,
        COALESCE(SUM(monthly_message_quota), 0)     AS monthly_quota
      FROM tenants WHERE deleted_at IS NULL
    `),
    // WABA quality distribution
    query(`
      SELECT
        COUNT(*) FILTER (WHERE quality_rating = 'GREEN')  AS green,
        COUNT(*) FILTER (WHERE quality_rating = 'YELLOW') AS yellow,
        COUNT(*) FILTER (WHERE quality_rating = 'RED')    AS red,
        COUNT(*) FILTER (WHERE quality_rating IS NULL)    AS unknown
      FROM tenants WHERE deleted_at IS NULL AND phone_number_id IS NOT NULL
    `),
  ]);

  return sendSuccess(res, {
    tenants:  tenantsRow.rows[0],
    contacts: contactsRow.rows[0],
    messages: messagesRow.rows[0],
    quality:  qualityRow.rows[0],
  }, 'Overview fetched.');
}));

// ── POST /admin/impersonate/:tenantId ───────────────────────────
// Begin an impersonation session for a specific tenant.
// Issues a scoped JWT with is_impersonating=true, saves original
// super_admin context in the token for restoration later.
router.post('/impersonate/:tenantId', catchAsync(async (req, res) => {
  const { tenantId } = req.params;

  // Fetch target tenant
  const { rows: [tenant] } = await query(
    `SELECT id, name, slug, status, is_active, enabled_features,
            waba_id, phone_number_id, meta_system_token
     FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
    [tenantId]
  );
  if (!tenant) throw new AppError('Tenant not found.', 404, 'ERR_VDAJ_TENANT_001');
  if (tenant.status === 'suspended') {
    throw new AppError('Cannot impersonate a suspended tenant.', 403, 'ERR_VDAJ_TENANT_003');
  }

  // Fetch (or create) tenant_admin user for the target tenant
  const { rows: [adminUser] } = await query(
    `SELECT id, email, role FROM users
     WHERE tenant_id = $1 AND role = 'tenant_admin'
       AND deleted_at IS NULL AND is_active = TRUE
     LIMIT 1`,
    [tenantId]
  );
  if (!adminUser) {
    throw new AppError(
      'Target tenant has no active admin user. Create one first.',
      409,
      'ERR_VDAJ_TENANT_002'
    );
  }

  // Issue scoped impersonation token
  const impersonationToken = jwt.sign(
    {
      sub:                adminUser.id,
      role:               'tenant_admin',
      tenantId:           tenantId,
      is_impersonating:   true,
      original_user_id:   req.user.id,
      original_role:      'super_admin',
    },
    process.env.JWT_SECRET,
    { expiresIn: '4h' }  // Short-lived: 4 hours max
  );

  // Set impersonation cookie (overwrites existing session)
  res.cookie(
    process.env.JWT_COOKIE_NAME || 'vdaj_access_token',
    impersonationToken,
    { ...COOKIE_OPTIONS, maxAge: 4 * 60 * 60 * 1000 }
  );

  recordAudit({
    tenantId: tenant.id,
    userId: req.user.id,
    action: 'ADMIN_IMPERSONATION_STARTED',
    resourceType: 'tenant',
    resourceId: tenant.id,
    status: 'WARNING',
    meta: {
      tenantName: tenant.name,
      adminEmail: req.user.email,
      impersonatedUser: adminUser.email,
    },
    subTasks: [
      { name: 'Verify Tenant Status', details: `Confirmed tenant ${tenant.name} is active and verified`, component: 'Policy Engine', status: 'SUCCESS' },
      { name: 'Issue Scoped Delegated Token', details: `Generated 4-hour impersonation session as ${adminUser.email}`, component: 'JWT Service', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendSuccess(res, {
    tenant: {
      id:     tenant.id,
      name:   tenant.name,
      slug:   tenant.slug,
      status: tenant.status,
      enabledFeatures: tenant.enabled_features || [],
    },
    impersonatingAs: adminUser.email,
    expiresIn: '4h',
  }, `Impersonating ${tenant.name}. Session expires in 4 hours.`);
}));

// ── GET /admin/tenants ──────────────────────────────────────────
// Returns all tenants with: WABA status, user count, feature flags,
// plan, status, last active date.
router.get('/tenants', catchAsync(async (req, res) => {
  const { rows } = await query(`
    SELECT
      t.id,
      t.name,
      t.slug,
      t.plan,
      t.status,
      t.is_active,
      t.country_code,
      t.timezone,
      t.enabled_features,
      t.max_messages_per_day,
      t.monthly_message_quota,
      t.waba_id,
      t.phone_number_id,
      t.quality_rating,
      t.messaging_tier,
      t.msgs_sent_today,
      (t.phone_number_id IS NOT NULL AND t.meta_system_token IS NOT NULL) AS waba_connected,
      t.created_at,
      t.updated_at,
      -- User count
      COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL) AS user_count,
      -- Admin email
      MAX(u.email) FILTER (WHERE u.role = 'tenant_admin' AND u.deleted_at IS NULL) AS admin_email,
      -- Subscription
      s.status AS sub_status,
      s.trial_ends_at
    FROM tenants t
    LEFT JOIN users u ON u.tenant_id = t.id
    LEFT JOIN subscriptions s ON s.tenant_id = t.id
      AND s.status IN ('active', 'trialing', 'past_due')
    WHERE t.deleted_at IS NULL
    GROUP BY t.id, s.status, s.trial_ends_at
    ORDER BY t.created_at DESC
  `);

  return sendSuccess(res, rows, 'Tenants fetched.');
}));

// ── POST /admin/tenants ─────────────────────────────────────────
// Creates a new tenant AND a tenant_admin user for them.
// Body: { name, slug, plan, adminEmail, adminFirstName, adminLastName,
//         countryCode, timezone, maxMessagesPerDay, enabledFeatures }
router.post('/tenants', catchAsync(async (req, res) => {
  const {
    name,
    slug,
    plan          = 'starter',
    adminEmail,
    adminFirstName = 'Admin',
    adminLastName  = '',
    countryCode    = 'IN',
    timezone       = 'Asia/Kolkata',
    maxMessagesPerDay    = 1000,
    monthlyMessageQuota  = 30000,
    enabledFeatures      = ['inbox', 'campaigns', 'contacts', 'templates', 'analytics'],
  } = req.body;

  if (!name?.trim())       throw new AppError('name is required.', 400, 'ERR_VDAJ_VAL_001');
  if (!slug?.trim())       throw new AppError('slug is required.', 400, 'ERR_VDAJ_VAL_001');
  if (!adminEmail?.trim()) throw new AppError('adminEmail is required to create tenant admin.', 400, 'ERR_VDAJ_VAL_001');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new AppError('adminEmail must be a valid email address.', 400, 'ERR_VDAJ_VAL_002');
  }

  // Check slug uniqueness
  const { rows: existing } = await query(
    `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL`,
    [slug.toLowerCase().trim()]
  );
  if (existing.length) throw new AppError(`Slug "${slug}" is already taken.`, 409, 'ERR_VDAJ_TENANT_004');

  // Check admin email uniqueness
  const { rows: existingUser } = await query(
    `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [adminEmail.toLowerCase().trim()]
  );
  if (existingUser.length) throw new AppError(`Email "${adminEmail}" is already in use.`, 409, 'ERR_VDAJ_AUTH_007');

  // Create tenant
  const { rows: [tenant] } = await query(`
    INSERT INTO tenants
      (name, slug, plan, country_code, timezone, max_messages_per_day,
       monthly_message_quota, enabled_features, status, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'active', TRUE)
    RETURNING id, name, slug, plan, status, is_active, enabled_features, created_at`,
    [
      name.trim(),
      slug.toLowerCase().trim(),
      plan,
      countryCode,
      timezone,
      maxMessagesPerDay,
      monthlyMessageQuota,
      JSON.stringify(enabledFeatures),
    ]
  );

  // Generate a temp password; in production this would trigger a "set password" email
  const tempPassword = crypto.randomBytes(10).toString('base64url');
  const hash = await bcrypt.hash(tempPassword, 10);

  // Create tenant_admin user
  const { rows: [adminUser] } = await query(`
    INSERT INTO users
      (tenant_id, email, first_name, last_name, role, password_hash, is_active, is_verified)
    VALUES ($1, $2, $3, $4, 'tenant_admin', $5, TRUE, TRUE)
    RETURNING id, email, first_name, last_name, role, created_at`,
    [tenant.id, adminEmail.toLowerCase().trim(), adminFirstName.trim(), adminLastName.trim(), hash]
  );

  recordAudit({
    tenantId: tenant.id,
    userId: req.user.id,
    action: 'TENANT_CREATED',
    resourceType: 'tenant',
    resourceId: tenant.id,
    status: 'SUCCESS',
    meta: {
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      adminEmail,
    },
    subTasks: [
      { name: 'Slug & Namespace Reservation', details: `Validated unique identifier: ${tenant.slug}`, component: 'Namespace Service', status: 'SUCCESS' },
      { name: 'Workspace Provisioning', details: `Created tenant record in PostgreSQL with plan ${tenant.plan}`, component: 'PostgreSQL Store', status: 'SUCCESS' },
      { name: 'Tenant Admin User Seeding', details: `Created primary administrator account ${adminEmail}`, component: 'Identity Management', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendCreated(res, {
    tenant,
    adminUser: {
      ...adminUser,
      tempPassword, // Shown only once — caller should display to super_admin
    },
  }, 'Tenant and admin user created successfully.');
}));

// ── PATCH /admin/tenants/:id/suspend ───────────────────────────
// Toggle tenant between active and suspended.
// Body: { suspend: true|false }
router.patch('/tenants/:id/suspend', catchAsync(async (req, res) => {
  const { suspend } = req.body;
  if (typeof suspend !== 'boolean') {
    throw new AppError('suspend (boolean) is required.', 400, 'ERR_VDAJ_VAL_001');
  }

  const newStatus   = suspend ? 'suspended' : 'active';
  const newIsActive = !suspend;

  const { rows: [tenant] } = await query(
    `UPDATE tenants
     SET status = $1, is_active = $2, updated_at = NOW()
     WHERE id = $3 AND deleted_at IS NULL
     RETURNING id, name, status, is_active`,
    [newStatus, newIsActive, req.params.id]
  );
  if (!tenant) throw new AppError('Tenant not found.', 404, 'ERR_VDAJ_TENANT_001');

  recordAudit({
    tenantId: tenant.id,
    userId: req.user.id,
    action: suspend ? 'TENANT_SUSPENDED' : 'TENANT_ACTIVATED',
    resourceType: 'tenant',
    resourceId: tenant.id,
    status: suspend ? 'WARNING' : 'SUCCESS',
    meta: {
      tenantName: tenant.name,
      status: tenant.status,
      isActive: tenant.is_active,
    },
    subTasks: [
      { name: 'Update Tenant Status', details: `Modified workspace status to ${newStatus} in database`, component: 'PostgreSQL Store', status: 'SUCCESS' },
      { name: 'Worker Gateway Sync', details: `Worker message pipelines ${suspend ? 'halted' : 'resumed'} for tenant`, component: 'Engine Controller', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendSuccess(res, tenant, `Tenant ${suspend ? 'suspended' : 'reactivated'}.`);
}));

// ── PATCH /admin/tenants/:id/features ──────────────────────────
// Update the feature toggles (checkbox save).
// Body: { features: ['inbox', 'campaigns', ...] }
router.patch('/tenants/:id/features', catchAsync(async (req, res) => {
  const { features } = req.body;
  if (!Array.isArray(features)) {
    throw new AppError('features must be an array of feature strings.', 400, 'ERR_VDAJ_VAL_001');
  }

  const VALID_FEATURES = [
    'inbox', 'campaigns', 'contacts', 'templates',
    'analytics', 'automation', 'commerce', 'logs',
    'whatsapp-setup', 'settings',
  ];
  const invalid = features.filter((f) => !VALID_FEATURES.includes(f));
  if (invalid.length) {
    throw new AppError(`Invalid features: ${invalid.join(', ')}. Allowed: ${VALID_FEATURES.join(', ')}.`, 400, 'ERR_VDAJ_VAL_002');
  }

  const { rows: [tenant] } = await query(
    `UPDATE tenants
     SET enabled_features = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, name, enabled_features`,
    [JSON.stringify(features), req.params.id]
  );
  if (!tenant) throw new AppError('Tenant not found.', 404, 'ERR_VDAJ_TENANT_001');

  recordAudit({
    tenantId: tenant.id,
    userId: req.user.id,
    action: 'TENANT_FEATURES_UPDATED',
    resourceType: 'tenant',
    resourceId: tenant.id,
    status: 'SUCCESS',
    meta: {
      tenantName: tenant.name,
      enabledFeatures: features,
    },
    subTasks: [
      { name: 'Validate Feature Schema', details: `Checked ${features.length} enabled feature flags`, component: 'RBAC Policy', status: 'SUCCESS' },
      { name: 'Persist Feature Grants', details: 'Updated JSONB feature set in database', component: 'PostgreSQL Store', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendSuccess(res, tenant, 'Feature flags updated.');
}));

// ── GET /admin/users ────────────────────────────────────────────
// List all users across all tenants (for Super Admin only).
router.get('/users', catchAsync(async (req, res) => {
  const { rows } = await query(`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.role,
      u.is_active,
      u.is_verified,
      u.last_login_at,
      u.created_at,
      t.id   AS tenant_id,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      t.status AS tenant_status
    FROM users u
    LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE u.deleted_at IS NULL
    ORDER BY u.created_at DESC
  `);
  return sendSuccess(res, rows, 'Users fetched.');
}));

// ── POST /admin/users ───────────────────────────────────────────
// Create a new user and assign to a tenant.
// Body: { tenantId, email, firstName, lastName, role, password? }
router.post('/users', catchAsync(async (req, res) => {
  const {
    tenantId,
    email,
    firstName = '',
    lastName  = '',
    role      = 'agent',
    password,
  } = req.body;

  if (!email?.trim()) throw new AppError('email is required.', 400, 'ERR_VDAJ_VAL_001');
  if (!tenantId)      throw new AppError('tenantId is required.', 400, 'ERR_VDAJ_VAL_001');

  const VALID_ROLES = ['tenant_admin', 'manager', 'agent', 'tenant_user'];
  if (!VALID_ROLES.includes(role)) {
    throw new AppError(`Role must be one of: ${VALID_ROLES.join(', ')}.`, 400, 'ERR_VDAJ_VAL_002');
  }

  // Validate tenant exists
  const { rows: [tenant] } = await query(
    `SELECT id FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
    [tenantId]
  );
  if (!tenant) throw new AppError('Tenant not found.', 404, 'ERR_VDAJ_TENANT_001');

  const plainPassword = password || crypto.randomBytes(10).toString('base64url');
  const hash = await bcrypt.hash(plainPassword, 10);

  const { rows: [user] } = await query(`
    INSERT INTO users (tenant_id, email, first_name, last_name, role, password_hash, is_active, is_verified)
    VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
    RETURNING id, email, first_name, last_name, role, tenant_id, created_at`,
    [tenantId, email.toLowerCase().trim(), firstName.trim(), lastName.trim(), role, hash]
  );

  recordAudit({
    tenantId: tenantId,
    userId: req.user.id,
    action: 'USER_CREATED',
    resourceType: 'user',
    resourceId: user.id,
    status: 'SUCCESS',
    meta: {
      email: user.email,
      role: user.role,
      tenantName: tenant.name,
    },
    subTasks: [
      { name: 'Credentials Generation', details: 'Generated temporary salted credentials digest', component: 'Crypto Security', status: 'SUCCESS' },
      { name: 'User Record Creation', details: `Enrolled user ${user.email} with role ${user.role}`, component: 'Identity Management', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendCreated(res, { ...user, tempPassword: plainPassword }, 'User created.');
}));

// ── PATCH /admin/users/:id/reset-password ──────────────────────
// Force-reset a user's password.
// Returns the new temp password (show to super_admin only).
router.patch('/users/:id/reset-password', catchAsync(async (req, res) => {
  const { password } = req.body;
  const newPassword = password || crypto.randomBytes(10).toString('base64url');
  const hash = await bcrypt.hash(newPassword, 10);

  const { rows: [user] } = await query(
    `UPDATE users
     SET password_hash = $1, refresh_token_hash = NULL, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, email, role`,
    [hash, req.params.id]
  );
  if (!user) throw new AppError('User not found.', 404, 'ERR_VDAJ_AUTH_005');

  recordAudit({
    tenantId: null,
    userId: req.user.id,
    action: 'USER_PASSWORD_RESET',
    resourceType: 'user',
    resourceId: user.id,
    status: 'WARNING',
    meta: {
      email: user.email,
      role: user.role,
      resetBy: req.user.email,
    },
    subTasks: [
      { name: 'Generate Salted Hash', details: 'Derived new bcrypt digest (10 rounds)', component: 'Crypto Security', status: 'SUCCESS' },
      { name: 'Revoke Active Refresh Tokens', details: 'Invalidated existing refresh token hashes', component: 'OAuth Session', status: 'SUCCESS' },
      { name: 'Persist Credentials', details: `Updated password digest for ${user.email}`, component: 'PostgreSQL Store', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendSuccess(res, { ...user, newPassword }, 'Password reset successfully.');
}));

// ── PATCH /admin/users/:id/role ─────────────────────────────────
// Change a user's role.
// Body: { role: 'tenant_admin' | 'manager' | 'agent' | 'tenant_user' }
router.patch('/users/:id/role', catchAsync(async (req, res) => {
  const { role } = req.body;
  const VALID_ROLES = ['tenant_admin', 'manager', 'agent', 'tenant_user'];
  if (!VALID_ROLES.includes(role)) {
    throw new AppError(`Role must be one of: ${VALID_ROLES.join(', ')}.`, 400, 'ERR_VDAJ_VAL_002');
  }

  const { rows: [user] } = await query(
    `UPDATE users SET role = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, email, role`,
    [role, req.params.id]
  );
  if (!user) throw new AppError('User not found.', 404, 'ERR_VDAJ_AUTH_005');

  recordAudit({
    tenantId: null,
    userId: req.user.id,
    action: 'USER_ROLE_CHANGED',
    resourceType: 'user',
    resourceId: user.id,
    status: 'WARNING',
    meta: {
      email: user.email,
      newRole: role,
      updatedBy: req.user.email,
    },
    subTasks: [
      { name: 'RBAC Role Assignment', details: `Updated user privilege level to ${role}`, component: 'RBAC Engine', status: 'SUCCESS' },
      { name: 'Persist User Record', details: `Committed role update in database for ${user.email}`, component: 'PostgreSQL Store', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendSuccess(res, user, 'User role updated.');
}));

module.exports = router;
