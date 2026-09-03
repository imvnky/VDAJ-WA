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

  const tSnapCond = tid ? 'AND tenant_id = $1' : '';
  const tMsgCond  = tid ? 'AND cm.tenant_id = $1' : '';
  const tCampCond = tid ? 'AND tenant_id = $1' : '';
  const tContCond = tid ? 'AND tenant_id = $1' : '';
  const tParams   = tid ? [tid] : [];

  // ── Primary: pre-aggregated snapshots ─────────────────────────
  const { rows: snapshotRows } = await query(
    `SELECT
       COALESCE(SUM(msgs_sent),       0)::int AS total_sent,
       COALESCE(SUM(msgs_delivered),  0)::int AS total_delivered,
       COALESCE(SUM(msgs_read),       0)::int AS total_read,
       COALESCE(SUM(msgs_failed),     0)::int AS total_failed,
       COALESCE(SUM(opt_outs),        0)::int AS total_opt_outs,
       COALESCE(SUM(new_contacts),    0)::int AS total_new_contacts,
       COUNT(DISTINCT snapshot_date)::int     AS days_tracked
     FROM analytics_snapshots
     WHERE snapshot_date >= CURRENT_DATE - ${days}
       ${tSnapCond}`,
    tParams
  );

  let o = snapshotRows[0];

  // ── Fallback: live aggregation when snapshots are empty ────────
  if (!o || parseInt(o.total_sent, 10) === 0) {
    const { rows: liveRows } = await query(
      `SELECT
         COALESCE(COUNT(*) FILTER (WHERE cm.status IN ('sent','delivered','read')), 0)::int AS total_sent,
         COALESCE(COUNT(*) FILTER (WHERE cm.status = 'delivered'),                  0)::int AS total_delivered,
         COALESCE(COUNT(*) FILTER (WHERE cm.status = 'read'),                       0)::int AS total_read,
         COALESCE(COUNT(*) FILTER (WHERE cm.status = 'failed'),                     0)::int AS total_failed,
         0::int AS total_opt_outs,
         0::int AS total_new_contacts,
         0::int AS days_tracked
       FROM campaign_messages cm
       WHERE cm.created_at >= NOW() - INTERVAL '${days} days'
         ${tMsgCond}`,
      tParams
    );
    o = liveRows[0] || {};
  }

  // ── Campaign summary ───────────────────────────────────────────
  const { rows: [camps] } = await query(
    `SELECT
       COUNT(*)::int                                        AS total_campaigns,
       COUNT(*) FILTER (WHERE status = 'completed')::int    AS completed,
       COUNT(*) FILTER (WHERE status = 'running')::int      AS running,
       COUNT(*) FILTER (WHERE status = 'draft')::int        AS draft
     FROM campaigns
     WHERE deleted_at IS NULL
       ${tCampCond}`,
    tParams
  );

  // ── Contact summary ────────────────────────────────────────────
  const { rows: [contacts] } = await query(
    `SELECT
       COUNT(*)::int                                        AS total_contacts,
       COUNT(*) FILTER (WHERE status = 'active')::int       AS active_contacts,
       COUNT(*) FILTER (WHERE status = 'opted_out')::int    AS opted_out
     FROM contacts
     WHERE 1=1
       ${tContCond}`,
    tParams
  );

  // ── Derived rates ──────────────────────────────────────────────
  const totalSent      = parseInt(o.total_sent || 0, 10);
  const totalDelivered = parseInt(o.total_delivered || 0, 10);
  const totalRead      = parseInt(o.total_read || 0, 10);
  const totalFailed    = parseInt(o.total_failed || 0, 10);
  const totalOptOuts   = parseInt(o.total_opt_outs || 0, 10);

  const deliveryRate = totalSent > 0
    ? parseFloat(((totalDelivered / totalSent) * 100).toFixed(1))
    : 0;
  const readRate = totalDelivered > 0
    ? parseFloat(((totalRead / totalDelivered) * 100).toFixed(1))
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
      // Snake_case aliases for frontend backwards compatibility
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

  const tSnapCond = tid ? 'AND tenant_id = $1' : '';
  const tMsgCond  = tid ? 'AND cm.tenant_id = $1' : '';
  const tParams   = tid ? [tid] : [];

  // ── Primary: snapshot-based trend ─────────────────────────────
  const { rows: snapRows } = await query(
    `SELECT
       snapshot_date::text AS date,
       msgs_sent,
       msgs_delivered,
       msgs_read,
       msgs_failed,
       opt_outs,
       new_contacts,
       CASE WHEN msgs_sent > 0
            THEN ROUND((msgs_delivered::numeric / msgs_sent) * 100, 1)
            ELSE 0 END AS delivery_rate,
       CASE WHEN msgs_delivered > 0
            THEN ROUND((msgs_read::numeric / msgs_delivered) * 100, 1)
            ELSE 0 END AS read_rate
     FROM analytics_snapshots
     WHERE snapshot_date >= CURRENT_DATE - ${days}
       ${tSnapCond}
     ORDER BY snapshot_date ASC`,
    tParams
  );

  if (snapRows.length > 0) {
    return sendSuccess(res, snapRows);
  }

  // ── Fallback: live aggregation grouped by day ──────────────────
  const { rows: liveRows } = await query(
    `SELECT
       COALESCE(cm.sent_at::date, cm.created_at::date)::text AS date,
       COUNT(*) FILTER (WHERE cm.status IN ('sent','delivered','read'))::int AS msgs_sent,
       COUNT(*) FILTER (WHERE cm.status = 'delivered')::int                  AS msgs_delivered,
       COUNT(*) FILTER (WHERE cm.status = 'read')::int                       AS msgs_read,
       COUNT(*) FILTER (WHERE cm.status = 'failed')::int                     AS msgs_failed,
       0::int                                                                AS opt_outs,
       0::int                                                                AS new_contacts,
       CASE WHEN COUNT(*) FILTER (WHERE cm.status IN ('sent','delivered','read')) > 0
            THEN ROUND(
              COUNT(*) FILTER (WHERE cm.status = 'delivered')::numeric /
              NULLIF(COUNT(*) FILTER (WHERE cm.status IN ('sent','delivered','read')), 0) * 100, 1
            )
            ELSE 0 END                                                       AS delivery_rate,
       CASE WHEN COUNT(*) FILTER (WHERE cm.status = 'delivered') > 0
            THEN ROUND(
              COUNT(*) FILTER (WHERE cm.status = 'read')::numeric /
              NULLIF(COUNT(*) FILTER (WHERE cm.status = 'delivered'), 0) * 100, 1
            )
            ELSE 0 END                                                       AS read_rate
     FROM campaign_messages cm
     WHERE cm.created_at >= NOW() - INTERVAL '${days} days'
       ${tMsgCond}
     GROUP BY 1
     ORDER BY 1 ASC`,
    tParams
  );

  return sendSuccess(res, liveRows);
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
