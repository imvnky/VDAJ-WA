require('dotenv').config();
const { query } = require('../src/config/database');

async function run() {
  try {
    const tid = null;
    const days = 30;

    // Test query 1
    const { rows: r1 } = await query(
      `SELECT
         COALESCE(SUM(msgs_sent),       0)::int AS total_sent,
         COALESCE(SUM(msgs_delivered),  0)::int AS total_delivered,
         COALESCE(SUM(msgs_read),       0)::int AS total_read,
         COALESCE(SUM(msgs_failed),     0)::int AS total_failed,
         COALESCE(SUM(opt_outs),        0)::int AS total_opt_outs,
         COALESCE(SUM(new_contacts),    0)::int AS total_new_contacts,
         COUNT(DISTINCT snapshot_date)::int     AS days_tracked
       FROM analytics_snapshots
       WHERE (CAST($1 AS UUID) IS NULL OR tenant_id = $1)
         AND snapshot_date >= CURRENT_DATE - make_interval(days => $2)`,
      [tid, days]
    );
    console.log('r1 SUCCESS:', r1);

    // Test query 2 (fallback)
    const { rows: r2 } = await query(
      `SELECT
         COALESCE(COUNT(*) FILTER (WHERE cm.status IN ('sent','delivered','read')), 0)::int AS total_sent,
         COALESCE(COUNT(*) FILTER (WHERE cm.status = 'delivered'),                  0)::int AS total_delivered,
         COALESCE(COUNT(*) FILTER (WHERE cm.status = 'read'),                       0)::int AS total_read,
         COALESCE(COUNT(*) FILTER (WHERE cm.status = 'failed'),                     0)::int AS total_failed,
         0::int AS total_opt_outs,
         0::int AS total_new_contacts,
         0::int AS days_tracked
       FROM campaign_messages cm
       JOIN campaigns c ON c.id = cm.campaign_id
       WHERE (CAST($1 AS UUID) IS NULL OR cm.tenant_id = $1)
         AND cm.created_at >= NOW() - make_interval(days => $2)`,
      [tid, days]
    );
    console.log('r2 SUCCESS:', r2);

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

run();
