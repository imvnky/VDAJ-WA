'use strict';
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

async function checkLogs() {
  console.log('\n=== CHECKING LATEST LOGS & INBOX MESSAGES ===\n');

  const { rows: lastMsgs } = await query(
    `SELECT id, wa_message_id, direction, status, error_code, created_at, body
     FROM inbox_messages
     WHERE direction = 'outbound'
     ORDER BY created_at DESC LIMIT 3`
  );
  console.log('Last 3 outbound messages:');
  console.log(JSON.stringify(lastMsgs, null, 2));

  // Search logs for webhook activity or errors
  const logsDir = path.resolve(__dirname, '../logs');
  if (fs.existsSync(logsDir)) {
    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log')).sort().reverse();
    console.log('\nLog files found:', files.slice(0, 5));

    for (const f of files.slice(0, 3)) {
      const content = fs.readFileSync(path.join(logsDir, f), 'utf8');
      const lines = content.split('\n');
      const webhookLines = lines.filter(l => l.includes('webhook') || l.includes('Webhook') || l.includes('status') || l.includes('error') || l.includes('failed') || l.includes('wamid'));
      console.log(`\nLast 15 matching lines from ${f}:`);
      console.log(webhookLines.slice(-15).join('\n'));
    }
  }

  await pool.end();
}

checkLogs().catch(async e => {
  console.error(e);
  try { await pool.end(); } catch {}
});
