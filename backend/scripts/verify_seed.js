require('dotenv').config();
const { Client } = require('pg');
const c = new Client({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, ssl: false,
});
const tables = [
  'tenants','users','contacts','contact_lists','contact_list_members',
  'message_templates','campaigns','campaign_messages',
  'analytics_snapshots','inbox_conversations','inbox_messages','subscriptions',
];
async function run() {
  await c.connect();
  console.log('\nRow counts after seeding:\n');
  for (const t of tables) {
    const r = await c.query('SELECT COUNT(*) AS n FROM ' + t);
    console.log('  ' + t.padEnd(30) + r.rows[0].n);
  }
  await c.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
