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
      return sendSuccess(res, null, 'super_admin platform user has no default tenant profile.');
    }
  } else {
    tenantId = req.user.tenantId;
    if (!tenantId) {
      return sendSuccess(res, null, 'User is not associated with a tenant.');
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

// ── GET /tenants/me/waba-health — WABA health for current tenant ─
// Returns quality rating, messaging tier, daily limit, and usage.
// Available to all authenticated tenant roles; super_admin must pass ?tenantId=.
router.get('/me/waba-health', catchAsync(async (req, res) => {
  let tenantId;
  if (req.user.role === 'super_admin') {
    tenantId = req.query.tenantId || null;
    if (!tenantId) {
      return sendSuccess(res, null, 'super_admin platform user has no default WABA health profile.');
    }
  } else {
    tenantId = req.user.tenantId;
    if (!tenantId) {
      return sendSuccess(res, null, 'User is not associated with a tenant.');
    }
  }

  // Translate integer tier → human-readable daily limit
  const TIER_LIMITS = { 1: 1000, 2: 10000, 3: 100000, 4: 999999 };

  const { rows: [health] } = await query(
    `SELECT
       quality_rating,
       messaging_tier,
       msgs_sent_today,
       msgs_sent_today_date,
       display_phone_number,
       verified_name,
       waba_health_synced_at,
       (phone_number_id IS NOT NULL AND meta_system_token IS NOT NULL) AS waba_connected
     FROM tenants
     WHERE id = $1 AND deleted_at IS NULL`,
    [tenantId]
  );

  if (!health) throw new AppError('Tenant not found.', 404, 'ERR_VDAJ_TENANT_001');

  // Reset msgs_sent_today counter if date has rolled over (UTC)
  const todayUTC = new Date().toISOString().slice(0, 10);
  const storedDate = health.msgs_sent_today_date
    ? new Date(health.msgs_sent_today_date).toISOString().slice(0, 10)
    : null;

  const msgsSentToday = storedDate === todayUTC ? (health.msgs_sent_today || 0) : 0;
  const tier          = health.messaging_tier || 1;
  const dailyLimit    = TIER_LIMITS[tier] || 1000;

  return sendSuccess(res, {
    quality_rating:        health.quality_rating  || 'GREEN',
    messaging_tier:        tier,
    daily_limit:           dailyLimit,
    msgs_sent_today:       msgsSentToday,
    usage_pct:             Math.round((msgsSentToday / dailyLimit) * 100),
    display_phone_number:  health.display_phone_number  || null,
    verified_name:         health.verified_name          || null,
    waba_connected:        health.waba_connected,
    waba_health_synced_at: health.waba_health_synced_at || null,
  }, 'WABA health retrieved.');
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

// ── GET /tenants/me/team — List users for this tenant ──────────
router.get('/me/team', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId || req.query.tenantId;
  if (!tenantId) return sendSuccess(res, [], 'No tenant associated.');

  const { rows } = await query(
    `SELECT id, first_name, last_name, email, role, created_at, last_login_at
       FROM users
      WHERE tenant_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    [tenantId]
  );
  return sendSuccess(res, rows, 'Team members fetched.');
}));

// ── POST /tenants/me/invite — Invite a team member ─────────────
router.post('/me/invite', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId || req.body.tenantId;
  if (!tenantId) throw new AppError('Not associated with a tenant.', 400, 'ERR_VDAJ_TENANT_003');

  const { email, role = 'tenant_user', firstName = '', lastName = '' } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Valid email is required.', 400, 'ERR_VDAJ_VAL_001');
  }
  const VALID_ROLES = ['tenant_admin', 'tenant_user'];
  if (!VALID_ROLES.includes(role)) {
    throw new AppError(`Role must be one of: ${VALID_ROLES.join(', ')}.`, 400, 'ERR_VDAJ_VAL_002');
  }

  // Upsert: if user already exists (same email across tenants), associate with this tenant.
  // Otherwise create a new placeholder user. In production you'd send an invite email here.
  const tempPassword = require('crypto').randomBytes(16).toString('hex');
  const bcrypt = require('bcryptjs');
  const hashed = await bcrypt.hash(tempPassword, 12);

  const { rows: [user] } = await query(
    `INSERT INTO users (tenant_id, email, first_name, last_name, role, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE
       SET tenant_id = $1, role = $5, updated_at = NOW()
     RETURNING id, email, first_name, last_name, role, created_at`,
    [tenantId, email.toLowerCase().trim(), firstName.trim(), lastName.trim(), role, hashed]
  );

  return sendCreated(res, { ...user, tempPassword }, 'Team member invited.');
}));

// ── PATCH /tenants/me — Update tenant account settings ─────────
router.patch('/me', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId || req.body.tenantId;
  if (!tenantId) throw new AppError('Not associated with a tenant.', 400, 'ERR_VDAJ_TENANT_003');

  const { name, timezone, country_code } = req.body;

  const { rows: [tenant] } = await query(
    `UPDATE tenants
        SET name         = COALESCE($2, name),
            timezone     = COALESCE($3, timezone),
            country_code = COALESCE($4, country_code),
            updated_at   = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, name, timezone, country_code, updated_at`,
    [tenantId, name?.trim() || null, timezone || null, country_code || null]
  );
  if (!tenant) throw new AppError('Tenant not found.', 404, 'ERR_VDAJ_TENANT_001');
  return sendSuccess(res, tenant, 'Settings updated.');
}));

// ── GET /tenants/me/compliance — Consent & quality audit ────────
router.get('/me/compliance', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId || req.query.tenantId;
  if (!tenantId) {
    return sendSuccess(res, { optInBreakdown: [], totalOptedOut: 0, qualityRating: 'GREEN' }, 'No tenant associated.');
  }

  // Opt-in breakdown by source
  const { rows: optInBreakdown } = await query(
    `SELECT opt_in_source AS source, COUNT(*) AS count
       FROM contacts
      WHERE tenant_id = $1
        AND opted_in_at IS NOT NULL
        AND deleted_at IS NULL
      GROUP BY opt_in_source
      ORDER BY count DESC`,
    [tenantId]
  );

  // Opt-out rate
  const { rows: [rates] } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'opted_out') AS opted_out_count,
       COUNT(*) AS total_count
       FROM contacts
      WHERE tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId]
  );

  // Contacts without opt-in (compliance risk)
  const { rows: [noOptin] } = await query(
    `SELECT COUNT(*) AS count
       FROM contacts
      WHERE tenant_id = $1
        AND opted_in_at IS NULL
        AND status = 'active'
        AND deleted_at IS NULL`,
    [tenantId]
  );

  // WABA quality from tenant row
  const { rows: [waba] } = await query(
    `SELECT quality_rating, messaging_tier, msgs_sent_today, waba_health_synced_at
       FROM tenants WHERE id = $1`,
    [tenantId]
  );

  const optOutRate = rates.total_count > 0
    ? parseFloat(((rates.opted_out_count / rates.total_count) * 100).toFixed(1))
    : 0;

  return sendSuccess(res, {
    opt_in_breakdown:      optInBreakdown,
    opted_out_count:       parseInt(rates.opted_out_count, 10),
    total_contacts:        parseInt(rates.total_count, 10),
    opt_out_rate_pct:      optOutRate,
    contacts_missing_optin: parseInt(noOptin.count, 10),
    quality_rating:        waba?.quality_rating || 'GREEN',
    messaging_tier:        waba?.messaging_tier || 1,
    msgs_sent_today:       waba?.msgs_sent_today || 0,
    waba_health_synced_at: waba?.waba_health_synced_at || null,
  }, 'Compliance data fetched.');
}));

module.exports = router;
