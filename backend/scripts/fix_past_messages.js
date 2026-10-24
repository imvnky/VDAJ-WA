'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function fixPastMessages() {
  console.log('\n=== UPDATING PAST MESSAGES TO READ STATUS ===\n');

  // 1. Promote outbound messages to read for conversations that have had inbound customer replies
  const resOut = await query(`
    UPDATE inbox_messages
    SET status = 'read', updated_at = NOW()
    WHERE direction = 'outbound'
      AND status IN ('sent', 'delivered')
      AND conversation_id IN (
        SELECT DISTINCT conversation_id FROM inbox_messages WHERE direction = 'inbound'
      )
    RETURNING id, conversation_id, status;
  `);

  console.log(`Updated ${resOut.rowCount} outbound messages to 'read' (double tick).`);

  // 2. Also update any button message body if null
  const resBtn = await query(`
    UPDATE inbox_messages
    SET body = 'Quick Reply: Interested', updated_at = NOW()
    WHERE message_type = 'button' AND (body IS NULL OR body = '')
    RETURNING id;
  `);

  console.log(`Updated ${resBtn.rowCount} button message bodies.`);

  await pool.end();
  console.log('Done!');
}

fixPastMessages().catch(async (err) => {
  console.error(err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
