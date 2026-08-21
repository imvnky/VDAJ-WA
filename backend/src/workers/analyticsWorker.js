/**
 * VDAJ Services — Analytics Snapshot Aggregation Worker
 *
 * Two execution modes:
 *   1. CRON mode — called by server.js on a schedule (daily at 00:10 UTC).
 *      Aggregates the PREVIOUS day's campaign_messages for every tenant.
 *
 *   2. ON-DEMAND mode — exported as aggregateTenantSnapshot(tenantId, date).
 *      Called from campaignRoutes after a campaign completes, so metrics
 *      update immediately without waiting for the next cron cycle.
 *
 * Strategy:
 *   - Single SQL aggregation query per tenant per date (no N+1).
 *   - INSERT ... ON CONFLICT (tenant_id, snapshot_date) DO UPDATE —
 *     fully idempotent, safe to re-run as many times as needed.
 *   - Also counts new contacts and opt-outs for the target date.
 *   - Never crashes the caller — all errors are logged and swallowed.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { getWABAHealth } = require('../services/metaApiService');

// ─────────────────────────────────────────────────────────────────
// Core aggregation function — one tenant, one date
// ─────────────────────────────────────────────────────────────────

/**
 * Compute and upsert a single analytics_snapshots row for one tenant+date.
 * @param {string} tenantId
 * @param {Date|string} targetDate — defaults to yesterday (UTC)
 * @returns {Promise<object>} upserted snapshot row
 */
async function aggregateTenantSnapshot(tenantId, targetDate) {
  const date = targetDate
    ? new Date(targetDate).toISOString().slice(0, 10)
    : new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); // yesterday UTC

  // ── Aggregate campaign_messages for this tenant+date ──────────
  const { rows: [agg] } = await query(
    `SELECT
       COALESCE(COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')), 0) AS msgs_sent,
       COALESCE(COUNT(*) FILTER (WHERE status = 'delivered'),                  0) AS msgs_delivered,
       COALESCE(COUNT(*) FILTER (WHERE status = 'read'),                       0) AS msgs_read,
       COALESCE(COUNT(*) FILTER (WHERE status = 'failed'),                     0) AS msgs_failed
     FROM campaign_messages
     WHERE tenant_id     = $1
       AND sent_at::date = $2::date`,
    [tenantId, date]
  );

  // ── Opt-out events for this date ──────────────────────────────
  const { rows: [optOutRow] } = await query(
    `SELECT COUNT(*) AS opt_outs
     FROM opt_out_events
     WHERE tenant_id    = $1
       AND created_at::date = $2::date`,
    [tenantId, date]
  );

  // ── New contacts created on this date ─────────────────────────
  const { rows: [contactRow] } = await query(
    `SELECT COUNT(*) AS new_contacts
     FROM contacts
     WHERE tenant_id        = $1
       AND created_at::date = $2::date`,
    [tenantId, date]
  );

  const snap = {
    msgs_sent:      parseInt(agg.msgs_sent,      10),
    msgs_delivered: parseInt(agg.msgs_delivered, 10),
    msgs_read:      parseInt(agg.msgs_read,      10),
    msgs_failed:    parseInt(agg.msgs_failed,    10),
    opt_outs:       parseInt(optOutRow.opt_outs, 10),
    new_contacts:   parseInt(contactRow.new_contacts, 10),
  };

  // ── Upsert into analytics_snapshots ───────────────────────────
  const { rows: [saved] } = await query(
    `INSERT INTO analytics_snapshots
       (tenant_id, snapshot_date,
        msgs_sent, msgs_delivered, msgs_read, msgs_failed,
        opt_outs, new_contacts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, snapshot_date) DO UPDATE
       SET msgs_sent      = EXCLUDED.msgs_sent,
           msgs_delivered = EXCLUDED.msgs_delivered,
           msgs_read      = EXCLUDED.msgs_read,
           msgs_failed    = EXCLUDED.msgs_failed,
           opt_outs       = EXCLUDED.opt_outs,
           new_contacts   = EXCLUDED.new_contacts
     RETURNING *`,
    [
      tenantId, date,
      snap.msgs_sent,
      snap.msgs_delivered,
      snap.msgs_read,
      snap.msgs_failed,
      snap.opt_outs,
      snap.new_contacts,
    ]
  );

  // Compute rates for logging only (stored as derived values in routes)
  const deliveryRate = snap.msgs_sent > 0
    ? ((snap.msgs_delivered / snap.msgs_sent) * 100).toFixed(1)
    : '0.0';
  const readRate = snap.msgs_delivered > 0
    ? ((snap.msgs_read / snap.msgs_delivered) * 100).toFixed(1)
    : '0.0';

  logger.debug('Analytics snapshot upserted', {
    tenantId,
    date,
    ...snap,
    deliveryRate: `${deliveryRate}%`,
    readRate:     `${readRate}%`,
  });

  return saved;
}

// ─────────────────────────────────────────────────────────────────
// Batch runner — processes ALL tenants for a given date
// ─────────────────────────────────────────────────────────────────

/**
 * Run aggregation for every active tenant.
 * @param {Date|string} [targetDate] — defaults to yesterday
 */
async function runDailyAggregation(targetDate) {
  const date = targetDate
    ? new Date(targetDate).toISOString().slice(0, 10)
    : new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  logger.info('Analytics aggregation started', { date });

  const { rows: tenants } = await query(
    `SELECT id FROM tenants WHERE deleted_at IS NULL AND is_active = TRUE`
  );

  let success = 0;
  let failed  = 0;

  for (const tenant of tenants) {
    try {
      await aggregateTenantSnapshot(tenant.id, date);
      success++;
    } catch (err) {
      failed++;
      logger.error('Failed to aggregate tenant snapshot', {
        tenantId: tenant.id,
        date,
        error: err.message,
      });
      // Continue — one tenant failure must not block the rest
    }
  }

  logger.info('Analytics aggregation complete', { date, success, failed, total: tenants.length });
}

// ─────────────────────────────────────────────────────────────────
// Cron scheduler — registers daily job when this module is loaded
// ─────────────────────────────────────────────────────────────────

/**
 * Starts the daily cron job.
 * Call this from server.js once during startup.
 * Uses setInterval instead of a cron library to avoid a new dependency.
 *
 * Schedule: fires at the next 00:10 UTC, then every 24 hours.
 */
function startAnalyticsCron() {
  const scheduleDaily = () => {
    const now  = new Date();
    // Next 00:10 UTC
    const next = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,  // tomorrow
      0, 10, 0, 0           // 00:10:00 UTC
    ));
    const msUntilNext = next.getTime() - now.getTime();

    logger.info('Analytics cron scheduled', {
      nextRun: next.toISOString(),
      msUntilNext,
    });

    setTimeout(async () => {
      try {
        await runDailyAggregation();
      } catch (err) {
        logger.error('Analytics cron run failed', { error: err.message });
      }
      // Reschedule after each run
      scheduleDaily();
    }, msUntilNext);
  };

  scheduleDaily();
}

// ─────────────────────────────────────────────────────────────────
// WABA Health Sync — per-tenant quality rating + messaging tier
// ─────────────────────────────────────────────────────────────────

/**
 * Map Meta's messaging_limit_tier string to an integer tier number.
 * Meta tier strings: 'TIER_1K' | 'TIER_10K' | 'TIER_100K' | 'TIER_UNLIMITED' | 'UNLIMITED'
 *
 * @param {string|null} tierStr
 * @returns {number} 1 | 2 | 3 | 4
 */
function parseTier(tierStr) {
  if (!tierStr) return 1;
  const s = tierStr.toUpperCase();
  if (s.includes('100K') || s === 'TIER_100K') return 3;
  if (s.includes('10K')  || s === 'TIER_10K')  return 2;
  if (s.includes('UNLIMITED'))                  return 4;
  return 1; // TIER_1K or unknown → safest default
}

/**
 * Tier-to-daily-limit lookup (messages per day).
 * @param {number} tier
 * @returns {number}
 */
function tierDailyLimit(tier) {
  const limits = { 1: 1000, 2: 10000, 3: 100000, 4: 999999 };
  return limits[tier] || 1000;
}

/**
 * Fetch WABA health for all active tenants that have WhatsApp configured,
 * update the tenants table, and auto-pause any running campaigns whose
 * tenant's quality rating has dropped to RED.
 *
 * Never throws — individual tenant failures are logged and skipped.
 */
async function syncWABAHealth() {
  logger.info('WABA health sync started');

  const { rows: tenants } = await query(`
    SELECT id, phone_number_id, meta_system_token, quality_rating AS prev_rating
    FROM tenants
    WHERE is_active = TRUE
      AND deleted_at IS NULL
      AND phone_number_id IS NOT NULL
      AND meta_system_token IS NOT NULL
  `);

  if (tenants.length === 0) {
    logger.info('WABA health sync: no configured tenants, skipping.');
    return;
  }

  let success = 0;
  let failed  = 0;

  for (const tenant of tenants) {
    try {
      const health = await getWABAHealth(tenant.phone_number_id, tenant.meta_system_token);

      const newRating = (health.quality_rating || 'GREEN').toUpperCase();
      const newTier   = parseTier(health.messaging_limit_tier);

      await query(
        `UPDATE tenants
           SET quality_rating        = $2,
               messaging_tier        = $3,
               display_phone_number  = COALESCE($4, display_phone_number),
               verified_name         = COALESCE($5, verified_name),
               waba_health_synced_at = NOW(),
               updated_at            = NOW()
         WHERE id = $1`,
        [
          tenant.id,
          newRating,
          newTier,
          health.display_phone_number || null,
          health.verified_name        || null,
        ]
      );

      // ── Auto-pause running campaigns when quality drops to RED ──────
      // A RED quality rating means Meta has flagged this number and may
      // stop delivery. Pausing protects the sender reputation and avoids
      // wasting message quota on undeliverable sends.
      if (newRating === 'RED' && tenant.prev_rating !== 'RED') {
        const { rowCount } = await query(
          `UPDATE campaigns
             SET status = 'paused', updated_at = NOW()
           WHERE tenant_id = $1 AND status = 'running'`,
          [tenant.id]
        );
        if (rowCount > 0) {
          logger.warn('Campaigns auto-paused: quality rating dropped to RED', {
            tenantId:     tenant.id,
            pausedCount:  rowCount,
          });
        }
      }

      logger.debug('WABA health synced', {
        tenantId:    tenant.id,
        quality:     newRating,
        tier:        newTier,
        dailyLimit:  tierDailyLimit(newTier),
      });

      success++;
    } catch (err) {
      failed++;
      logger.error('WABA health sync failed for tenant', {
        tenantId: tenant.id,
        error:    err.message,
        code:     err.errorCode,
      });
      // Continue — one tenant failure must not block the rest
    }
  }

  logger.info('WABA health sync complete', { success, failed, total: tenants.length });
}

/**
 * Registers the WABA health sync cron.
 * Fires every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC.
 * Uses the same setInterval/setTimeout pattern as startAnalyticsCron
 * to avoid adding a new npm dependency.
 *
 * Call this from server.js during startup.
 */
function startWABAHealthCron() {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  // Compute ms until the next 6-hour mark (00, 06, 12, 18 UTC)
  const scheduleNext = () => {
    const now     = new Date();
    const utcHour = now.getUTCHours();
    const nextMark = Math.ceil((utcHour + 1) / 6) * 6; // next 0/6/12/18
    const next    = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      nextMark % 24, 0, 0, 0
    ));
    // If nextMark >= 24, bump to tomorrow 00:00
    if (nextMark >= 24) {
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(0);
    }
    const msUntilNext = next.getTime() - Date.now();

    logger.info('WABA health cron scheduled', {
      nextRun:    next.toISOString(),
      msUntilNext,
    });

    setTimeout(async () => {
      try {
        await syncWABAHealth();
      } catch (err) {
        logger.error('WABA health cron run failed', { error: err.message });
      }
      scheduleNext(); // reschedule after each run
    }, msUntilNext);
  };

  // Run immediately on startup so health data is fresh right away
  syncWABAHealth().catch((err) =>
    logger.error('WABA health initial sync failed', { error: err.message })
  );

  scheduleNext();
}

module.exports = { aggregateTenantSnapshot, runDailyAggregation, startAnalyticsCron, syncWABAHealth, startWABAHealthCron };
