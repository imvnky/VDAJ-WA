#!/usr/bin/env node
/**
 * VDAJ Services — Super-Admin Bootstrap
 * ─────────────────────────────────────
 * Idempotently creates/updates the super_admin user on every deploy.
 * Safe to run many times — uses ON CONFLICT DO UPDATE.
 *
 * Credentials are pulled from env vars (set them in Render dashboard):
 *   SUPER_ADMIN_EMAIL    (default: admin@vdajservices.com)
 *   SUPER_ADMIN_PASSWORD (default: VDAJAdmin@2025!)
 *
 * Run automatically via npm prestart before the server starts.
 */

'use strict';

require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const RED    = (s) => `\x1b[31m${s}\x1b[0m`;
const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`;

async function bootstrap() {
  const email    = process.env.SUPER_ADMIN_EMAIL    || 'admin@vdajservices.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'VDAJAdmin@2025!';

  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}` +
    `@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}` +
    `/${process.env.DB_NAME}`;

  const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_URL
      ? { rejectUnauthorized: false }   // Render's managed DB needs this
      : (process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false),
  });

  console.log(BOLD('\n━━━  VDAJ Bootstrap  ━━━'));

  try {
    await client.connect();

    // Check if the users table exists yet (migration may not have run)
    const { rows: tableCheck } = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    `);

    if (!tableCheck.length) {
      console.log(YELLOW('  ⊘ Users table not found — skipping bootstrap (migration not yet applied)'));
      return;
    }

    // Generate a fresh bcrypt hash
    const hash = await bcrypt.hash(password, 12);

    const { rows } = await client.query(
      `INSERT INTO users
         (email, password_hash, first_name, last_name, role, is_active, is_verified)
       VALUES ($1, $2, 'Venkatesh', 'Joshi', 'super_admin', TRUE, TRUE)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             is_active     = TRUE,
             is_verified   = TRUE,
             updated_at    = NOW()
       RETURNING id, email, role, is_active, is_verified`,
      [email, hash]
    );

    const u = rows[0];
    console.log(GREEN(`  ✔ Super-admin ready: ${u.email} (role=${u.role}, verified=${u.is_verified})`));

    // Quick sanity-check: verify the hash round-trips correctly
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      console.error(RED('  ✖ bcrypt self-check FAILED — password hash is corrupt!'));
      process.exit(1);
    }
    console.log(GREEN('  ✔ bcrypt self-check passed'));

  } catch (err) {
    // Don't crash the server if bootstrap fails — just warn
    console.error(RED(`  ✖ Bootstrap error: ${err.message}`));
    console.error(YELLOW('  ⚠ Server will still start — manually run: npm run seed:admin'));
  } finally {
    await client.end();
    console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }
}

bootstrap();
