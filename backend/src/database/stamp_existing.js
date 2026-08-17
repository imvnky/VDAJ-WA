/**
 * One-time stamp script: records already-applied migrations into
 * schema_migrations so the idempotent runner can skip them going forward.
 *
 * Run once: node src/database/stamp_existing.js
 */

require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

const DB_DIR = path.join(__dirname);
const MIGRATIONS = [
  { name: 'schema_v1',       file: path.join(DB_DIR, 'schema.sql') },
  { name: 'schema_v2',       file: path.join(DB_DIR, 'schema_v2.sql') },
  { name: 'v3_flow_builder', file: path.join(DB_DIR, 'migrations', 'v3_flow_builder.sql') },
];

async function stamp() {
  await client.connect();
  console.log('Connected to PostgreSQL.\n');

  // Ensure tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum   VARCHAR(64)
    )
  `);

  for (const m of MIGRATIONS) {
    let checksum = null;
    if (fs.existsSync(m.file)) {
      const content = fs.readFileSync(m.file, 'utf8');
      checksum = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    }

    const { rowCount } = await client.query(
      `INSERT INTO schema_migrations (name, checksum)
       VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING`,
      [m.name, checksum]
    );

    if (rowCount > 0) {
      console.log('  STAMPED:          ' + m.name);
    } else {
      console.log('  ALREADY RECORDED: ' + m.name);
    }
  }

  console.log('\nDone. npm run migrate will now skip these and only apply future migrations.');
  await client.end();
}

stamp().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
