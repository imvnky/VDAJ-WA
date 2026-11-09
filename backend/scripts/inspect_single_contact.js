'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function main() {
  console.log('=== INSPECTING SAMPLE SMR CONTACTS ===');
  const { rows } = await query(
    `SELECT cm.id, cm.phone_e164, cm.status, cm.meta_message_id,
            cm.sent_at, cm.failed_at, cm.updated_at, cm.error_code, cm.last_error
     FROM campaign_messages cm
     JOIN campaigns c ON c.id = cm.campaign_id
     WHERE c.name ILIKE '%diwali%' AND cm.phone_e164 IN ('+919423737094', '+919422071251', '+919823385743')`
  );
  console.log(JSON.stringify(rows, null, 2));

  // Also check inbox_messages for these wamids
  const wamids = rows.map(r => r.meta_message_id).filter(Boolean);
  if (wamids.length > 0) {
    const { rows: inboxes } = await query(
      `SELECT wa_message_id, status, error_code, body, created_at
       FROM inbox_messages WHERE wa_message_id = ANY($1)`,
      [wamids]
    );
    console.log('=== MATCHING INBOX MESSAGES ===');
    console.log(JSON.stringify(inboxes, null, 2));
  }

  // Check recent status update webhooks
  const { rows: webhooks } = await query(
    `SELECT event_type, meta_message_id, raw_payload, created_at
     FROM webhook_events
     ORDER BY created_at DESC LIMIT 5`
  );
  console.log('=== RECENT WEBHOOK EVENTS ===');
  console.log(JSON.stringify(webhooks, null, 2));

  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});

