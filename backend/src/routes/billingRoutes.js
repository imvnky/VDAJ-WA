/**
 * VDAJ Services — Billing Routes
 *
 * GET  /billing/tiers              — Public: list all active subscription tiers
 * GET  /billing/subscription       — Tenant: current subscription + usage + limits
 * POST /billing/checkout-placeholder — Dev: simulate tier upgrade/downgrade
 *
 * Production note: Replace checkout-placeholder with a real Stripe Checkout
 * session creator when going live. All other routes are production-ready.
 */

const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../config/database');
const { sendSuccess, sendCreated, catchAsync } = require('../middleware/responseHandler');
const { authenticate } = require('../middleware/authMiddleware');
const AppError = require('../utils/AppError');

// ── GET /billing/tiers — Public, no auth required ──────────────
// Lists all active subscription tiers for the pricing page.
router.get('/tiers', catchAsync(async (req, res) => {
  const { rows } = await query(
    `SELECT
       id,
       name,
       price_monthly,
       msg_limit,
       contact_limit,
       user_limit,
       features,
       is_active
     FROM subscription_tiers
     WHERE is_active = TRUE
     ORDER BY price_monthly ASC`
  );
  return sendSuccess(res, rows, 'Subscription tiers fetched.');
}));

// All routes below require authentication
router.use(authenticate);

// ── GET /billing/subscription — Authenticated tenant ──────────
// Returns current subscription, tier limits, and live usage counters.
router.get('/subscription', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId || req.query.tenantId;
  if (!tenantId) {
    return sendSuccess(res, null, 'super_admin platform user has no subscription context.');
  }

  // Active or trialing subscription with full tier details
  const { rows: [sub] } = await query(
    `SELECT
       s.id,
       s.status,
       s.stripe_customer_id,
       s.stripe_sub_id,
       s.trial_ends_at,
       s.current_period_start,
       s.current_period_end,
       s.canceled_at,
       s.msgs_used_this_period,
       s.created_at,
       -- Tier
       st.id              AS tier_id,
       st.name            AS tier_name,
       st.price_monthly   AS tier_price,
       st.msg_limit       AS tier_msg_limit,
       st.contact_limit   AS tier_contact_limit,
       st.user_limit      AS tier_user_limit,
       st.features        AS tier_features
     FROM subscriptions s
     JOIN subscription_tiers st ON st.id = s.tier_id
     WHERE s.tenant_id = $1
       AND s.status IN ('active', 'trialing', 'past_due')
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [tenantId]
  );

  if (!sub) {
    // No subscription at all — return a minimal free-tier object so the
    // frontend doesn't crash (tenant can start a trial from the pricing page)
    return sendSuccess(res, {
      status: 'none',
      tier: null,
      usage: { msgsUsed: 0, msgLimit: 0, contactLimit: 0 },
    }, 'No active subscription found.');
  }

  // Live contact count for this tenant
  const { rows: [usage] } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'active')   AS active_contacts,
       COUNT(*) FILTER (WHERE status = 'opted_out') AS opted_out_contacts,
       COUNT(*)                                     AS total_contacts
     FROM contacts WHERE tenant_id = $1`,
    [tenantId]
  );

  // Days remaining in current period / trial
  const periodEnd = sub.current_period_end || sub.trial_ends_at;
  const daysRemaining = periodEnd
    ? Math.max(0, Math.ceil((new Date(periodEnd) - new Date()) / 86_400_000))
    : null;

  const msgsUsed = sub.msgs_used_this_period;
  const msgLimit = sub.tier_msg_limit;
  const msgsRemaining = Math.max(0, msgLimit - msgsUsed);
  const usagePercent = msgLimit > 0 ? Math.min(100, Math.round((msgsUsed / msgLimit) * 100)) : 0;

  return sendSuccess(res, {
    id:                sub.id,
    status:            sub.status,
    stripeCustomerId:  sub.stripe_customer_id,
    stripeSubId:       sub.stripe_sub_id,
    trialEndsAt:       sub.trial_ends_at,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd:  sub.current_period_end,
    canceledAt:        sub.canceled_at,
    daysRemaining,

    tier: {
      id:           sub.tier_id,
      name:         sub.tier_name,
      priceMonthly: sub.tier_price,
      msgLimit:     sub.tier_msg_limit,
      contactLimit: sub.tier_contact_limit,
      userLimit:    sub.tier_user_limit,
      features:     sub.tier_features,
    },

    usage: {
      msgsUsed,
      msgsRemaining,
      msgLimit,
      usagePercent,
      activeContacts:  parseInt(usage.active_contacts,  10),
      totalContacts:   parseInt(usage.total_contacts,   10),
      optedOutContacts: parseInt(usage.opted_out_contacts, 10),
      contactLimit:    sub.tier_contact_limit,
    },
  }, 'Subscription details fetched.');
}));

// ── POST /billing/checkout-placeholder ────────────────────────
// Dev/staging only: simulates upgrading or downgrading to a different tier.
// Body: { tierId: string }
//
// In production, replace this with a Stripe Checkout Session creator that
// returns a session URL for client-side redirect.
router.post('/checkout-placeholder', catchAsync(async (req, res) => {
  const { tierId } = req.body;
  const tenantId = req.user.tenantId;

  if (!tenantId) {
    throw new AppError('Tenant context required.', 400, 'ERR_VDAJ_TENANT_003');
  }
  if (!tierId) {
    throw new AppError('tierId is required.', 400, 'ERR_VDAJ_VAL_001');
  }

  // Validate tier exists and is active
  const { rows: [tier] } = await query(
    `SELECT id, name, msg_limit FROM subscription_tiers WHERE id = $1 AND is_active = TRUE`,
    [tierId]
  );
  if (!tier) {
    throw new AppError('Subscription tier not found or inactive.', 404, 'ERR_VDAJ_BILL_001');
  }

  // Upsert the subscription for this tenant.
  // subscriptions has no UNIQUE(tenant_id), so we SELECT then INSERT-or-UPDATE.
  const { rows: [sub] } = await withTransaction(async (client) => {
    const { rows: existing } = await client.query(
      `SELECT id FROM subscriptions WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId]
    );

    let rows;
    if (existing.length) {
      // Update the most recent subscription
      ({ rows } = await client.query(
        `UPDATE subscriptions
         SET tier_id              = $1,
             status               = 'active',
             current_period_start = NOW(),
             current_period_end   = NOW() + INTERVAL '30 days',
             msgs_used_this_period = 0,
             updated_at           = NOW()
         WHERE id = $2
         RETURNING *`,
        [tierId, existing[0].id]
      ));
    } else {
      // First subscription for this tenant
      ({ rows } = await client.query(
        `INSERT INTO subscriptions
           (tenant_id, tier_id, status, current_period_start, current_period_end, msgs_used_this_period)
         VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '30 days', 0)
         RETURNING *`,
        [tenantId, tierId]
      ));
    }
    return rows;
  });

  return sendCreated(res, {
    subscriptionId: sub.id,
    tier:           tier.name,
    status:         sub.status,
    periodEnd:      sub.current_period_end,
    note:           'This is a simulated checkout. Integrate Stripe for production billing.',
  }, `Switched to ${tier.name} plan (simulated).`);
}));

module.exports = router;
