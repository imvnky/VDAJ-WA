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

module.exports = { aggregateTenantSnapshot, runDailyAggregation, startAnalyticsCron };
