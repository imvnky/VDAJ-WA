#!/usr/bin/env node
/**
 * VDAJ Services — Automated Database Migration Runner
 *
 * Usage:
 *   npm run migrate            (from backend/)
 *   DATABASE_URL=... node src/database/migrate.js
 *
 * Behaviour:
 *   1. Creates a `schema_migrations` tracking table if it doesn't exist.
 *   2. Runs each SQL file in MIGRATION_ORDER.
 *   3. Skips any migration that is already recorded as applied (fully idempotent).
 *   4. Wraps each file in a BEGIN/COMMIT transaction — rolls back on error.
 *   5. Prints a clear pass/skip/fail summary at the end.
 *
 * All SQL files already use IF NOT EXISTS / ON CONFLICT DO NOTHING,
 * so they are safe to re-run, but the tracking table prevents even that.
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ── Migration order matters — V1 must precede V2, V2 must precede V3 ──
const DB_DIR = path.join(__dirname);
const MIGRATION_ORDER = [
  { name: 'schema_v1',           file: path.join(DB_DIR, 'schema.sql') },
  { name: 'schema_v2',           file: path.join(DB_DIR, 'schema_v2.sql') },
  { name: 'v3_flow_builder',     file: path.join(DB_DIR, 'migrations', 'v3_flow_builder.sql') },
  { name: '002_bsp_compliance',  file: path.join(DB_DIR, 'migrations', '002_bsp_compliance.sql') },
];

// ── ANSI colour helpers ────────────────────────────────────────
const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const RED    = (s) => `\x1b[31m${s}\x1b[0m`;
const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM    = (s) => `\x1b[2m${s}\x1b[0m`;

async function run() {
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}` +
    `@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}` +
    `/${process.env.DB_NAME}`;

  const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_URL
      ? { rejectUnauthorized: false }  // Render managed DB — self-signed certs
      : (process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false),
  });

  console.log(BOLD('\n━━━  VDAJ Migration Runner  ━━━\n'));

  try {
    await client.connect();
    console.log(GREEN('✔ Connected to PostgreSQL\n'));

    // ── Bootstrap: create the tracking table ──────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(255) NOT NULL UNIQUE,
        applied_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        checksum     VARCHAR(64)
      );
    `);

    // ── Fetch already-applied migrations ──────────────────────
    const { rows: applied } = await client.query(
      `SELECT name FROM schema_migrations`
    );
    const appliedSet = new Set(applied.map((r) => r.name));

    // ── Run each migration in order ───────────────────────────
    const results = { applied: [], skipped: [], failed: [] };

    for (const migration of MIGRATION_ORDER) {
      const label = DIM(`[${migration.name}]`);

      if (appliedSet.has(migration.name)) {
        console.log(`  ${YELLOW('⊘ SKIP')}  ${label}  — already applied`);
        results.skipped.push(migration.name);
        continue;
      }

      if (!fs.existsSync(migration.file)) {
        console.log(`  ${RED('✖ MISS')}  ${label}  — file not found: ${migration.file}`);
        results.failed.push(migration.name);
        continue;
      }

      const sql = fs.readFileSync(migration.file, 'utf8');

      // Simple checksum (not crypto-grade, just for auditing)
      const checksum = require('crypto')
        .createHash('sha256')
        .update(sql)
        .digest('hex')
        .slice(0, 16);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)`,
          [migration.name, checksum]
        );
        await client.query('COMMIT');
        console.log(`  ${GREEN('✔ APPLY')}  ${label}  ${DIM(`sha256:${checksum}`)}`);
        results.applied.push(migration.name);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ${RED('✖ FAIL')}  ${label}`);
        console.error(`         ${RED(err.message)}`);
        results.failed.push(migration.name);

        // Stop on first failure — dependent migrations must not run
        console.error(RED('\n  Migration halted due to error above.\n'));
        break;
      }
    }

    // ── Summary ───────────────────────────────────────────────
    console.log('\n' + BOLD('━━━  Summary  ━━━'));
    console.log(`  ${GREEN('Applied:')}  ${results.applied.length}`);
    console.log(`  ${YELLOW('Skipped:')}  ${results.skipped.length}`);
    console.log(`  ${RED('Failed:')}   ${results.failed.length}`);

    if (results.applied.length > 0) {
      console.log('\n  Applied migrations:');
      results.applied.forEach((n) => console.log(`    ${GREEN('+')} ${n}`));
    }

    console.log('');

    if (results.failed.length > 0) {
      process.exit(1);
    }

  } catch (err) {
    console.error(RED('\nFATAL: Could not connect to database.'));
    console.error(RED(err.message));
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
