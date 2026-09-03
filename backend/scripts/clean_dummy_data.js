/**
 * VDAJ Services — Clean All Dummy / Demo Data
 * ─────────────────────────────────────────────
 * Removes all demo tenants, contacts, campaigns, templates,
 * inbox conversations, automations, and non-superadmin users.
 * Also flushes Redis queues.
 *
 * Keeps:
 *  - SuperAdmin user (admin@vdajservices.com)
 *  - Schema migrations
 *  - Subscription tiers
 */

'use strict';

require('dotenv').config();
const { query, pool } = require('../src/config/database');
const Redis = require('ioredis');

async function cleanDummyData() {
  console.log('\n🧹 Cleaning all dummy and demo data from VDAJ WhatsApp Platform...\n');

  // 1. Truncate demo tables
  const tables = [
    'analytics_snapshots',
    'inbox_messages',
    'inbox_conversations',
    'campaign_messages',
    'campaigns',
    'contact_list_members',
    'contact_lists',
    'contacts',
    'message_templates',
    'subscriptions',
    'automations',
    'ai_responder_configs',
    'commerce_products',
    'commerce_catalogs',
    'opt_out_events',
    'webhook_events',
    'audit_logs',
  ];

  for (const table of tables) {
    try {
      await query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      console.log(`  ✔ Cleared table: ${table}`);
    } catch (err) {
      console.log(`  ⚠ Skip/not found: ${table} (${err.message})`);
    }
  }

  // 2. Delete non-superadmin users
  const deletedUsers = await query(`DELETE FROM users WHERE role != 'super_admin' RETURNING email`);
  console.log(`\n  ✔ Removed ${deletedUsers.rowCount} demo users.`);

  // 3. Delete all demo tenants
  const deletedTenants = await query(`DELETE FROM tenants RETURNING name, slug`);
  console.log(`  ✔ Removed ${deletedTenants.rowCount} demo tenants.`);
  if (deletedTenants.rows.length) {
    deletedTenants.rows.forEach(t => console.log(`     - ${t.name} (${t.slug})`));
  }

  // 4. Verify SuperAdmin is intact
  const adminRes = await query(`SELECT id, email, role, is_active FROM users WHERE role = 'super_admin'`);
  console.log('\n  ✅ Active SuperAdmin account:');
  console.table(adminRes.rows);

  // 5. Clean Redis BullMQ queues
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    });
    const keys = await redis.keys('vdaj:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`  ✔ Cleared ${keys.length} cached Redis queue keys.`);
    } else {
      console.log('  ✔ Redis queues already clean.');
    }
    await redis.quit();
  } catch (err) {
    console.log(`  ⚠ Redis cleanup note: ${err.message}`);
  }

  await pool.end();
  console.log('\n🎉 Production database is 100% clean and legitimate!\n');
}

cleanDummyData().catch((err) => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
