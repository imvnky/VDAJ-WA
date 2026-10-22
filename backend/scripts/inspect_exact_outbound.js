'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();
const { query, pool } = require('../src/config/database');

async function inspectExact() {
  console.log('\n=== LATEST OUTBOUND MESSAGES IN INBOX ===\n');

  const { rows } = await query(
    `SELECT m.id, m.wa_message_id, m.status, m.error_code, m.created_at, m.body, c.phone_e164, c.display_name
     FROM inbox_messages m
     JOIN inbox_conversations c ON c.id = m.conversation_id
     WHERE m.direction = 'outbound'
     ORDER BY m.created_at DESC LIMIT 3`
  );

  for (const r of rows) {
    console.log({
      time: r.created_at,
      to: r.phone_e164,
      name: r.display_name,
      status: r.status,
      error_code: r.error_code,
      wa_message_id: r.wa_message_id,
      body: r.body.slice(0, 60) + '...'
    });
  }

  await pool.end();
}

inspectExact().catch(async e => {
  console.error(e);
  try { await pool.end(); } catch {}
});
