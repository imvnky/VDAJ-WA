/**
 * VDAJ Services — Team Routes
 * Base: /api/v1/team
 *
 * GET  /team         — List all users in caller's tenant
 * POST /team/invite  — Invite (create) a team member in caller's tenant
 * DELETE /team/:id   — Deactivate a team member
 *
 * Auth: authenticate + authorize(['tenant_admin', 'super_admin'])
 *       (agents can GET their team; only admins can invite/remove)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');

const { query }    = require('../config/database');
const { sendSuccess, sendCreated, catchAsync } = require('../middleware/responseHandler');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const AppError = require('../utils/AppError');

// All team routes require auth + tenant membership
router.use(authenticate, requireTenant);

// ── GET /team — list all users in the caller's tenant ──────────
// Any authenticated tenant user can list team members (for
// the assignment dropdown in Inbox). No role restriction here.
router.get('/', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId;
  const isSuperAdmin = req.user.role === 'super_admin';

  let queryStr = `SELECT
       u.id,
       u.email,
       u.first_name,
       u.last_name,
       u.role,
       u.is_active,
       u.last_login_at,
       u.created_at
     FROM users u
     WHERE u.deleted_at IS NULL`;

  const params = [];
  if (!isSuperAdmin && tenantId) {
    queryStr += ` AND u.tenant_id = $1`;
    params.push(tenantId);
  }

  queryStr += ` ORDER BY
       CASE u.role
         WHEN 'tenant_admin' THEN 1
         WHEN 'manager'      THEN 2
         WHEN 'agent'        THEN 3
         ELSE 4
       END,
       u.first_name ASC`;

  const { rows } = await query(queryStr, params);
  return sendSuccess(res, rows, 'Team members fetched.');
}));

// ── POST /team/invite — create a team member ────────────────────
// Only tenant_admin or super_admin can invite.
router.post('/invite', authorize('tenant_admin', 'super_admin'), catchAsync(async (req, res) => {
  const {
    email,
    firstName = '',
    lastName  = '',
    role      = 'agent',
    password,
  } = req.body;

  if (!email?.trim()) throw new AppError('email is required.', 400, 'ERR_VDAJ_VAL_001');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('email must be a valid address.', 400, 'ERR_VDAJ_VAL_002');
  }

  const VALID_ROLES = ['tenant_admin', 'manager', 'agent', 'tenant_user'];
  if (!VALID_ROLES.includes(role)) {
    throw new AppError(`role must be one of: ${VALID_ROLES.join(', ')}.`, 400, 'ERR_VDAJ_VAL_002');
  }

  // Check uniqueness within the platform (email is global)
  const { rows: existing } = await query(
    `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email.toLowerCase().trim()]
  );
  if (existing.length) {
    throw new AppError(`Email "${email}" is already in use.`, 409, 'ERR_VDAJ_AUTH_007');
  }

  const plainPassword = password || crypto.randomBytes(10).toString('base64url');
  const hash = await bcrypt.hash(plainPassword, 10);

  const { rows: [user] } = await query(
    `INSERT INTO users
       (tenant_id, email, first_name, last_name, role, password_hash, is_active, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
     RETURNING id, email, first_name, last_name, role, tenant_id, created_at`,
    [req.user.tenantId, email.toLowerCase().trim(), firstName.trim(), lastName.trim(), role, hash]
  );

  return sendCreated(res, { ...user, tempPassword: plainPassword },
    'Team member invited. Share the temporary password with them.');
}));

// ── DELETE /team/:id — deactivate a team member ─────────────────
// Only tenant_admin or super_admin can remove.
// Soft-deactivation only: sets is_active = false.
// Cannot remove yourself, and cannot remove other admins unless you
// are a super_admin.
router.delete('/:id', authorize('tenant_admin', 'super_admin'), catchAsync(async (req, res) => {
  if (req.params.id === req.user.id) {
    throw new AppError('You cannot deactivate your own account.', 400, 'ERR_VDAJ_VAL_003');
  }

  // Verify the target user belongs to the same tenant
  const { rows: [target] } = await query(
    `SELECT id, role, tenant_id FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [req.params.id]
  );

  if (!target) throw new AppError('Team member not found.', 404, 'ERR_VDAJ_AUTH_005');

  if (target.tenant_id !== req.user.tenantId && req.user.role !== 'super_admin') {
    throw new AppError('You can only manage members of your own tenant.', 403, 'ERR_VDAJ_AUTH_006');
  }

  if (target.role === 'tenant_admin' && req.user.role !== 'super_admin') {
    throw new AppError('Only a super admin can remove another tenant admin.', 403, 'ERR_VDAJ_AUTH_006');
  }

  await query(
    `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );

  return sendSuccess(res, { id: req.params.id }, 'Team member deactivated.');
}));

module.exports = router;
