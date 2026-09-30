/**
 * VDAJ Services — Analytics Routes
 *
 * GET /analytics/overview  — KPI cards (snapshots + live fallback)
 * GET /analytics/trend     — Daily trend (snapshots + live fallback)
 * GET /analytics/campaigns — Per-campaign performance table
 *
 * Sprint 3 fix:
 *   - overview and trend now read from analytics_snapshots (fast, pre-aggregated).
 *   - When snapshots are empty (tenant never ran a campaign), queries fall back
 *     to live aggregation from campaign_messages so the page is never blank.
 *   - POST /analytics/snapshot — trigger manual on-demand aggregation.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { sendSuccess, catchAsync } = require('../middleware/responseHandler');
const { authenticate } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const { aggregateTenantSnapshot } = require('../workers/analyticsWorker');

router.use(authenticate, requireTenant);

// ── GET /analytics/overview ────────────────────────────────────
router.get('/overview', catchAsync(async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const tid  = (!isSuperAdmin && req.user.tenantId) ? req.user.tenantId : (req.query.tenantId || null);
  const days = Math.min(parseInt(req.query.days || 30, 10), 365);

  const { rows: overviewRows } = await query(
    `WITH live_by_date AS (
       SELECT
         msg_time::date AS date,
         COUNT(*) FILTER (WHERE status IN ('sent','delivered','read'))::int AS msgs_sent,
         COUNT(*) FILTER (WHERE status IN ('delivered','read'))::int AS msgs_delivered,
         COUNT(*) FILTER (WHERE status = 'read')::int AS msgs_read,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS msgs_failed
       FROM (
         SELECT status::text, COALESCE(sent_at, created_at) AS msg_time, tenant_id FROM campaign_messages
         UNION ALL
         SELECT status::text, created_at AS msg_time, tenant_id FROM inbox_messages WHERE direction = 'outbound'
       ) m
       WHERE (CAST($1 AS UUID) IS NULL OR tenant_id = $1)
         AND msg_time >= NOW() - make_interval(days => $2)
       GROUP BY msg_time::date
     ),
     snaps_by_date AS (
       SELECT
         snapshot_date::date AS date,
         msgs_sent,
         msgs_delivered,
         msgs_read,
         msgs_failed,
         opt_outs,
         new_contacts
       FROM analytics_snapshots
       WHERE (CAST($1 AS UUID) IS NULL OR tenant_id = $1)
         AND snapshot_date >= CURRENT_DATE - make_interval(days => $2)
         AND snapshot_date < CURRENT_DATE
     ),
     combined AS (
       SELECT
         COALESCE(l.date, s.date)::text AS date,
         GREATEST(COALESCE(l.msgs_sent, 0), COALESCE(s.msgs_sent, 0))::int AS msgs_sent,
         GREATEST(COALESCE(l.msgs_delivered, 0), COALESCE(s.msgs_delivered, 0))::int AS msgs_delivered,
         GREATEST(COALESCE(l.msgs_read, 0), COALESCE(s.msgs_read, 0))::int AS msgs_read,
         GREATEST(COALESCE(l.msgs_failed, 0), COALESCE(s.msgs_failed, 0))::int AS msgs_failed,
         COALESCE(s.opt_outs, 0)::int AS opt_outs,
         COALESCE(s.new_contacts, 0)::int AS new_contacts
       FROM live_by_date l
       FULL OUTER JOIN snaps_by_date s ON l.date = s.date
     )
     SELECT
       COALESCE(SUM(msgs_sent), 0)::int AS total_sent,
       COALESCE(SUM(LEAST(msgs_delivered, msgs_sent)), 0)::int AS total_delivered,
       COALESCE(SUM(LEAST(msgs_read, msgs_delivered, msgs_sent)), 0)::int AS total_read,
       COALESCE(SUM(msgs_failed), 0)::int AS total_failed,
       COALESCE(SUM(opt_outs), 0)::int AS total_opt_outs,
       COALESCE(SUM(new_contacts), 0)::int AS total_new_contacts,
       COUNT(DISTINCT date)::int AS days_tracked
     FROM combined`,
    [tid, days]
  );

  const o = overviewRows[0] || {};

  // ── Campaign summary ───────────────────────────────────────────
  const { rows: [camps] } = await query(
    `SELECT
       COUNT(*)::int                                     AS total_campaigns,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status = 'running')::int   AS running,
       COUNT(*) FILTER (WHERE status = 'draft')::int     AS draft
     FROM campaigns
     WHERE deleted_at IS NULL
       AND (CAST($1 AS UUID) IS NULL OR tenant_id = $1)`,
    [tid]
  );

  // ── Contact summary ────────────────────────────────────────────
  const { rows: [contacts] } = await query(
    `SELECT
       COUNT(*)::int                                     AS total_contacts,
       COUNT(*) FILTER (WHERE status = 'active')::int    AS active_contacts,
       COUNT(*) FILTER (WHERE status = 'opted_out')::int AS opted_out
     FROM contacts
     WHERE 1=1
       AND (CAST($1 AS UUID) IS NULL OR tenant_id = $1)`,
    [tid]
  );

  // ── Derived rates (ensuring delivery/read don't exceed sent) ────
  const totalSent      = parseInt(o.total_sent || 0, 10);
  const totalDelivered = Math.min(parseInt(o.total_delivered || 0, 10), totalSent);
  const totalRead      = Math.min(parseInt(o.total_read || 0, 10), totalDelivered);
  const totalFailed    = parseInt(o.total_failed || 0, 10);
  const totalOptOuts   = parseInt(o.total_opt_outs || 0, 10);

  const deliveryRate = totalSent > 0
    ? parseFloat(Math.min((totalDelivered / totalSent) * 100, 100).toFixed(1))
    : 0;
  const readRate = totalDelivered > 0
    ? parseFloat(Math.min((totalRead / totalDelivered) * 100, 100).toFixed(1))
    : 0;
  const optOutRate = totalSent > 0
    ? parseFloat(((totalOptOuts / totalSent) * 100).toFixed(2))
    : 0;
  const failureRate = totalSent > 0
    ? parseFloat(((totalFailed / totalSent) * 100).toFixed(1))
    : 0;

  return sendSuccess(res, {
    messages: {
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      totalOptOuts,
      totalNewContacts: parseInt(o.total_new_contacts || 0, 10),
      daysTracked:      parseInt(o.days_tracked || 0, 10),
      total_sent:       totalSent,
      total_delivered:  totalDelivered,
      total_read:       totalRead,
      total_failed:     totalFailed,
      total_opt_outs:   totalOptOuts,
      deliveryRate,
      readRate,
      optOutRate,
      failureRate,
    },
    campaigns: {
      total:           parseInt(camps?.total_campaigns || 0, 10),
      total_campaigns: parseInt(camps?.total_campaigns || 0, 10),
      completed:       camps?.completed || 0,
      running:         camps?.running || 0,
      draft:           camps?.draft || 0,
    },
    contacts: {
      total:           parseInt(contacts?.total_contacts || 0, 10),
      total_contacts:  parseInt(contacts?.total_contacts || 0, 10),
      active:          contacts?.active_contacts || 0,
      active_contacts: contacts?.active_contacts || 0,
      optedOut:        contacts?.opted_out || 0,
      opted_out:       contacts?.opted_out || 0,
    },
  });
}));

// ── GET /analytics/trend ───────────────────────────────────────
router.get('/trend', catchAsync(async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const tid  = (!isSuperAdmin && req.user.tenantId) ? req.user.tenantId : (req.query.tenantId || null);
  const days = Math.min(parseInt(req.query.days || 30, 10), 365);

  const { rows: trendRows } = await query(
    `WITH live_by_date AS (
       SELECT
         msg_time::date AS date,
         COUNT(*) FILTER (WHERE status IN ('sent','delivered','read'))::int AS msgs_sent,
         COUNT(*) FILTER (WHERE status IN ('delivered','read'))::int AS msgs_delivered,
         COUNT(*) FILTER (WHERE status = 'read')::int AS msgs_read,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS msgs_failed
       FROM (
         SELECT status::text, COALESCE(sent_at, created_at) AS msg_time, tenant_id FROM campaign_messages
         UNION ALL
         SELECT status::text, created_at AS msg_time, tenant_id FROM inbox_messages WHERE direction = 'outbound'
       ) m
       WHERE (CAST($1 AS UUID) IS NULL OR tenant_id = $1)
         AND msg_time >= NOW() - make_interval(days => $2)
       GROUP BY msg_time::date
     ),
     snaps_by_date AS (
       SELECT
         snapshot_date::date AS date,
         msgs_sent,
         msgs_delivered,
         msgs_read,
         msgs_failed,
         opt_outs,
         new_contacts
       FROM analytics_snapshots
       WHERE (CAST($1 AS UUID) IS NULL OR tenant_id = $1)
         AND snapshot_date >= CURRENT_DATE - make_interval(days => $2)
         AND snapshot_date < CURRENT_DATE
     ),
     combined AS (
       SELECT
         COALESCE(l.date, s.date)::text AS date,
         GREATEST(COALESCE(l.msgs_sent, 0), COALESCE(s.msgs_sent, 0))::int AS msgs_sent,
         GREATEST(COALESCE(l.msgs_delivered, 0), COALESCE(s.msgs_delivered, 0))::int AS msgs_delivered,
         GREATEST(COALESCE(l.msgs_read, 0), COALESCE(s.msgs_read, 0))::int AS msgs_read,
         GREATEST(COALESCE(l.msgs_failed, 0), COALESCE(s.msgs_failed, 0))::int AS msgs_failed,
         COALESCE(s.opt_outs, 0)::int AS opt_outs,
         COALESCE(s.new_contacts, 0)::int AS new_contacts
       FROM live_by_date l
       FULL OUTER JOIN snaps_by_date s ON l.date = s.date
     )
     SELECT
       date,
       msgs_sent,
       LEAST(msgs_delivered, msgs_sent)::int AS msgs_delivered,
       LEAST(msgs_read, msgs_delivered, msgs_sent)::int AS msgs_read,
       msgs_failed,
       opt_outs,
       new_contacts,
       CASE WHEN msgs_sent > 0
            THEN LEAST(ROUND((LEAST(msgs_delivered, msgs_sent)::numeric / msgs_sent) * 100, 1), 100.0)
            ELSE 0 END AS delivery_rate,
       CASE WHEN LEAST(msgs_delivered, msgs_sent) > 0
            THEN LEAST(ROUND((LEAST(msgs_read, msgs_delivered, msgs_sent)::numeric / LEAST(msgs_delivered, msgs_sent)) * 100, 1), 100.0)
            ELSE 0 END AS read_rate
     FROM combined
     ORDER BY date ASC`,
    [tid, days]
  );

  return sendSuccess(res, trendRows);
}));

// ── GET /analytics/campaigns ───────────────────────────────────
// Per-campaign performance table — always live from campaigns table.
router.get('/campaigns', catchAsync(async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const tid = (!isSuperAdmin && req.user.tenantId) ? req.user.tenantId : (req.query.tenantId || null);
  const { limit = 20, offset = 0 } = req.query;

  const tCampCond = tid ? 'AND tenant_id = $1' : '';
  const params = tid ? [tid, parseInt(limit, 10), parseInt(offset, 10)] : [parseInt(limit, 10), parseInt(offset, 10)];
  const limIdx = tid ? '$2' : '$1';
  const offIdx = tid ? '$3' : '$2';

  const { rows } = await query(
    `SELECT
       id,
       name,
       status,
       total_count,
       sent_count,
       delivered_count,
       read_count,
       failed_count,
       CASE WHEN total_count > 0
            THEN ROUND((sent_count::numeric / total_count) * 100, 1)
            ELSE 0 END                             AS send_rate,
       CASE WHEN sent_count > 0
            THEN ROUND((read_count::numeric / sent_count) * 100, 1)
            ELSE 0 END                             AS read_rate,
       CASE WHEN sent_count > 0
            THEN ROUND((failed_count::numeric / sent_count) * 100, 1)
            ELSE 0 END                             AS failure_rate,
       started_at,
       created_at,
       COUNT(*) OVER()                             AS total_count_all
     FROM campaigns
     WHERE deleted_at IS NULL
       ${tCampCond}
     ORDER BY created_at DESC
     LIMIT ${limIdx} OFFSET ${offIdx}`,
    params
  );

  const total = parseInt(rows[0]?.total_count_all || 0, 10);

  return sendSuccess(res, rows, 'Campaign analytics fetched.', 200, {
    total,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });
}));

// ── POST /analytics/snapshot ───────────────────────────────────
// Manual trigger: forces a snapshot aggregation for today (or a given date).
// Useful after a campaign completes or for debugging.
// Body (optional): { date: 'YYYY-MM-DD' }
router.post('/snapshot', catchAsync(async (req, res) => {
  const date = req.body?.date || new Date().toISOString().slice(0, 10);
  const snap = await aggregateTenantSnapshot(req.user.tenantId, date);
  return sendSuccess(res, snap, `Snapshot computed for ${date}.`);
}));

module.exports = router;
