'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function fixPastMessages() {
  console.log('\n=== UPDATING PAST MESSAGES TO READ STATUS ===\n');

  // 1. Add updated_at column to inbox_messages if it does not exist
  try {
    await query(`ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
    console.log('Ensured updated_at column exists on inbox_messages.');
  } catch (colErr) {
    console.warn('Column check skipped:', colErr.message);
  }

  // 2. Promote outbound messages to read for conversations that have had inbound customer replies
  const resOut = await query(`
    UPDATE inbox_messages
    SET status = 'read'
    WHERE direction = 'outbound'
      AND status IN ('sent', 'delivered')
      AND conversation_id IN (
        SELECT DISTINCT conversation_id FROM inbox_messages WHERE direction = 'inbound'
      )
    RETURNING id, conversation_id, status;
  `);

  console.log(`Updated ${resOut.rowCount} outbound messages to 'read' (double tick).`);

  // 3. Also update any button message body if null
  const resBtn = await query(`
    UPDATE inbox_messages
    SET body = 'Quick Reply: Interested'
    WHERE message_type = 'button' AND (body IS NULL OR body = '')
    RETURNING id;
  `);

  console.log(`Updated ${resBtn.rowCount} button message bodies.`);

  await pool.end();
  console.log('\n✅ Done! Past messages successfully updated.');
}

fixPastMessages().catch(async (err) => {
  console.error(err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
