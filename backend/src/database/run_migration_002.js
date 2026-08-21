/**
 * Run migration 002_bsp_compliance.sql via Node.js using the app's own DB connection.
 * Execute from: d:\VDAJ_Services\Whatsapp-API\backend
 * Command: node src/database/run_migration_002.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Connected as:', (await client.query('SELECT current_user')).rows[0].current_user);

    // Run each ALTER statement individually so we can report per-statement results
    const statements = [
      // contacts — opt-in consent
      `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opted_in_at   TIMESTAMPTZ`,
      `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_in_source VARCHAR(50)`,
      `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_in_proof  TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_no_opt_in ON contacts(tenant_id) WHERE opted_in_at IS NULL AND status = 'active'`,
      // tenants — WABA health
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS quality_rating        VARCHAR(10)  NOT NULL DEFAULT 'GREEN'`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS messaging_tier        SMALLINT     NOT NULL DEFAULT 1`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS msgs_sent_today       INTEGER      NOT NULL DEFAULT 0`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS msgs_sent_today_date  DATE`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS waba_health_synced_at TIMESTAMPTZ`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS display_phone_number  VARCHAR(30)`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS verified_name         VARCHAR(255)`,
      // opt_out_events
      `ALTER TABLE opt_out_events ADD COLUMN IF NOT EXISTS wa_message_id VARCHAR(255)`,
      // inbox_conversations
      `ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ`,
      `UPDATE inbox_conversations SET last_inbound_at = last_message_at WHERE last_inbound_at IS NULL AND last_message_at IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_conv_last_inbound ON inbox_conversations(last_inbound_at) WHERE last_inbound_at IS NOT NULL`,
      // opt_in_events (already created by partial run, but ensure idempotent)
      `CREATE TABLE IF NOT EXISTS opt_in_events (
         id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
         tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
         contact_id  UUID                 REFERENCES contacts(id) ON DELETE SET NULL,
         phone_e164  VARCHAR(20) NOT NULL,
         source      VARCHAR(50) NOT NULL,
         proof       TEXT,
         ip_address  VARCHAR(45),
         created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         CONSTRAINT pk_opt_in_events PRIMARY KEY (id)
       )`,
      `CREATE INDEX IF NOT EXISTS idx_opt_in_events_tenant  ON opt_in_events(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_opt_in_events_phone   ON opt_in_events(phone_e164)`,
      `CREATE INDEX IF NOT EXISTS idx_opt_in_events_contact ON opt_in_events(contact_id) WHERE contact_id IS NOT NULL`,
    ];

    let ok = 0; let fail = 0;
    for (const sql of statements) {
      try {
        await client.query(sql);
        console.log('✅', sql.trim().slice(0, 80));
        ok++;
      } catch (err) {
        // Column/index already exists = OK; anything else = warning
        if (err.code === '42701' || err.code === '42P07') {
          console.log('⏭️  Already exists:', sql.trim().slice(0, 80));
        } else {
          console.error('❌ FAILED:', sql.trim().slice(0, 80));
          console.error('   Error:', err.message, `(code: ${err.code})`);
          fail++;
        }
      }
    }

    console.log(`\n✅ Done — ${ok} succeeded, ${fail} failed.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
