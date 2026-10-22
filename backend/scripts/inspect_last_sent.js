'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function inspectLastSent() {
  console.log('\n=== INSPECTING RECENT INBOX MESSAGES ===\n');

  const { rows: msgs } = await query(
    `SELECT m.id, m.conversation_id, m.direction, m.message_type, m.status, m.error_code, m.wa_message_id, m.body, m.created_at,
            c.phone_e164, c.display_name
     FROM inbox_messages m
     JOIN inbox_conversations c ON c.id = m.conversation_id
     ORDER BY m.created_at DESC
     LIMIT 5`
  );

  console.log('Recent 5 messages:');
  console.log(JSON.stringify(msgs, null, 2));

  for (const m of msgs) {
    if (m.wa_message_id) {
      console.log(`\n--- Webhook events for wa_message_id: ${m.wa_message_id} ---`);
      const { rows: events } = await query(
        `SELECT event_type, raw_payload, received_at FROM webhook_events
         WHERE meta_message_id = $1 ORDER BY received_at DESC LIMIT 5`,
        [m.wa_message_id]
      );
      console.log(JSON.stringify(events, null, 2));
    }
  }

  console.log('\n--- LATEST 10 WEBHOOK EVENTS RECEIVED FROM META ---');
  const { rows: latestEvents } = await query(
    `SELECT event_type, meta_message_id, raw_payload, received_at FROM webhook_events
     ORDER BY received_at DESC LIMIT 10`
  );
  console.log(JSON.stringify(latestEvents, null, 2));

  await pool.end();
}

inspectLastSent().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
