/**
 * VDAJ Services — Tenant Management Routes
 *
 * GET  /tenants/me        — Self-service: any authenticated tenant user (tenant_user, tenant_admin, super_admin)
 * GET  /tenants           — SuperAdmin: list all tenants
 * POST /tenants           — SuperAdmin: create tenant
 * PATCH /tenants/:id/status — SuperAdmin: activate/deactivate
 *
 * FIX: GET /tenants/me now:
 *  - Accessible to all roles (tenant_user included, not just admin)
 *  - Returns tenant profile + active subscription + tier details
 *  - super_admin can query any tenant via ?tenantId=
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { sendSuccess, sendCreated, catchAsync } = require('../middleware/responseHandler');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const AppError = require('../utils/AppError');

router.use(authenticate);

// ── GET /tenants/me — Self-service tenant profile ───────────────
// Accessible to all authenticated roles.
// super_admin may pass ?tenantId= to inspect any tenant.
router.get('/me', catchAsync(async (req, res) => {
  let tenantId;

  if (req.user.role === 'super_admin') {
    tenantId = req.query.tenantId || null;
    if (!tenantId) {
      // super_admin has no tenant of their own — require explicit param
      throw new AppError(
        'super_admin must provide ?tenantId= to use this endpoint.',
        400,
        'ERR_VDAJ_VAL_005'
      );
    }
  } else {
    tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new AppError('User is not associated with a tenant.', 400, 'ERR_VDAJ_TENANT_003');
    }
  }

  // Fetch tenant with active subscription + tier in one query
  const { rows: [tenant] } = await query(
    `SELECT
       t.id,
       t.name,
       t.slug,
       t.plan,
       t.is_active,
       t.country_code,
       t.timezone,
       t.waba_id,
       t.phone_number_id,
       -- Token existence as boolean — never expose raw token to frontend
       (t.meta_system_token IS NOT NULL) AS meta_connected,
       t.meta_token_expires_at,
       t.max_messages_per_day,
       t.monthly_message_quota,
       t.created_at,
       t.updated_at,
       -- Active subscription
       s.id                   AS sub_id,
       s.status               AS sub_status,
       s.trial_ends_at,
       s.current_period_start,
       s.current_period_end,
       s.msgs_used_this_period,
       -- Subscription tier details
       st.name                AS tier_name,
       st.price_monthly       AS tier_price,
       st.msg_limit           AS tier_msg_limit,
       st.contact_limit       AS tier_contact_limit,
       st.user_limit          AS tier_user_limit,
       st.features            AS tier_features
     FROM tenants t
     LEFT JOIN subscriptions s
       ON s.tenant_id = t.id
       AND s.status IN ('active','trialing','past_due')
     LEFT JOIN subscription_tiers st ON st.id = s.tier_id
     WHERE t.id = $1 AND t.deleted_at IS NULL
     LIMIT 1`,
    [tenantId]
  );

  if (!tenant) throw new AppError('Tenant not found.', 404, 'ERR_VDAJ_TENANT_001');

  // Shape the response — nest subscription data cleanly
  const {
    sub_id, sub_status, trial_ends_at, current_period_start,
    current_period_end, msgs_used_this_period,
    tier_name, tier_price, tier_msg_limit, tier_contact_limit,
    tier_user_limit, tier_features,
    ...tenantCore
  } = tenant;

  const response = {
    ...tenantCore,
    subscription: sub_id ? {
      id:                   sub_id,
      status:               sub_status,
      trialEndsAt:          trial_ends_at,
      currentPeriodStart:   current_period_start,
      currentPeriodEnd:     current_period_end,
      msgsUsedThisPeriod:   msgs_used_this_period,
      tier: tier_name ? {
        name:          tier_name,
        priceMonthly:  tier_price,
        msgLimit:      tier_msg_limit,
        contactLimit:  tier_contact_limit,
        userLimit:     tier_user_limit,
        features:      tier_features,
      } : null,
    } : null,
  };

  return sendSuccess(res, response, 'Tenant profile fetched.');
}));

// ── GET /tenants — SuperAdmin: list all ────────────────────────
router.get('/', authorize('super_admin'), catchAsync(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, slug, plan, is_active, country_code, timezone,
            waba_id, phone_number_id, max_messages_per_day, monthly_message_quota,
            (meta_system_token IS NOT NULL) AS meta_connected,
            created_at, updated_at
     FROM tenants WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
  return sendSuccess(res, rows, 'Tenants fetched.');
}));

// ── POST /tenants — SuperAdmin: create ─────────────────────────
router.post('/', authorize('super_admin'), catchAsync(async (req, res) => {
  const { name, slug, plan, countryCode, timezone, maxMessagesPerDay, monthlyMessageQuota } = req.body;
  if (!name?.trim() || !slug?.trim()) {
    throw new AppError('name and slug are required.', 400, 'ERR_VDAJ_VAL_001');
  }

  const { rows: [tenant] } = await query(
    `INSERT INTO tenants (name, slug, plan, country_code, timezone, max_messages_per_day, monthly_message_quota)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, slug, plan, is_active, country_code, timezone, created_at`,
    [
      name.trim(),
      slug.toLowerCase().trim(),
      plan || 'starter',
      countryCode || 'IN',
      timezone || 'Asia/Kolkata',
      maxMessagesPerDay || 1000,
      monthlyMessageQuota || 30000,
    ]
  );
  return sendCreated(res, tenant, 'Tenant created.');
}));

// ── PATCH /tenants/:id/status — SuperAdmin: toggle active ──────
router.patch('/:id/status', authorize('super_admin'), catchAsync(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    throw new AppError('isActive (boolean) is required.', 400, 'ERR_VDAJ_VAL_001');
  }

  const { rows: [tenant] } = await query(
    `UPDATE tenants
     SET is_active = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, name, is_active`,
    [isActive, req.params.id]
  );
  if (!tenant) throw new AppError('Tenant not found.', 404, 'ERR_VDAJ_TENANT_001');
  return sendSuccess(res, tenant, `Tenant ${isActive ? 'activated' : 'deactivated'}.`);
}));

module.exports = router;
