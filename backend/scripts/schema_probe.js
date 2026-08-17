require('dotenv').config();
const { Client } = require('pg');
const c = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: false,
});

async function run() {
  await c.connect();
  const tables = [
    'message_templates', 'campaigns', 'campaign_messages',
    'contacts', 'contact_lists', 'contact_list_members',
    'tenants', 'users',
  ];
  for (const t of tables) {
    const r = await c.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [t]
    );
    console.log('\n-- ' + t);
    r.rows.forEach((row) => console.log('  ' + row.column_name + ' (' + row.data_type + ')'));
  }
  await c.end();
}
run().catch((e) => { console.error(e.message); process.exit(1); });
