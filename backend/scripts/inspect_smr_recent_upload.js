'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function main() {
  console.log('================================================================');
  console.log('🔍 SMR CONTACT AUDIT & RECENT UPLOAD INSPECTION');
  console.log('================================================================');

  const { rows: tenants } = await query(
    `SELECT id, name, slug FROM tenants WHERE slug ILIKE '%smr%' LIMIT 1`
  );
  if (!tenants.length) {
    console.log('❌ No SMR tenant found');
    await pool.end();
    return;
  }
  const tenant = tenants[0];
  console.log(`🏢 Workspace: ${tenant.name} (${tenant.slug}) [${tenant.id}]\n`);

  // 1. Check recent audit logs for bulk import
  const { rows: auditLogs } = await query(
    `SELECT id, action, meta, created_at
     FROM audit_logs
     WHERE tenant_id = $1 AND action = 'CONTACTS_BULK_IMPORT'
     ORDER BY created_at DESC
     LIMIT 5`,
    [tenant.id]
  );
  console.log('📋 Recent Bulk Import Audit Logs:');
  if (auditLogs.length === 0) {
    console.log('   (No audit logs found)');
  } else {
    auditLogs.forEach((l, idx) => {
      console.log(`   [${idx + 1}] ${l.created_at.toISOString()} | Action: ${l.action} | Meta:`, JSON.stringify(l.meta));
    });
  }

  // 2. Check total contacts and tag distribution
  const { rows: [totalCount] } = await query(
    `SELECT COUNT(*) AS count FROM contacts WHERE tenant_id = $1`,
    [tenant.id]
  );
  console.log(`\n👥 Total contacts in SMR: ${totalCount.count}`);

  // 3. Tag breakdown
  const { rows: tagStats } = await query(
    `SELECT unnest(tags) AS tag, COUNT(*) AS count
     FROM contacts
     WHERE tenant_id = $1 AND tags IS NOT NULL
     GROUP BY tag
     ORDER BY count DESC`,
    [tenant.id]
  );
  console.log('\n🏷️ Tag Breakdown across all contacts:');
  tagStats.forEach((t) => {
    console.log(`   - "${t.tag}": ${t.count} contacts`);
  });

  // 4. Contacts created or updated recently (last 3 hours)
  const { rows: recentChanges } = await query(
    `SELECT id, first_name, last_name, phone_e164, tags, created_at, updated_at,
            (created_at >= NOW() - INTERVAL '3 hours') AS is_newly_created
     FROM contacts
     WHERE tenant_id = $1 AND (updated_at >= NOW() - INTERVAL '3 hours' OR created_at >= NOW() - INTERVAL '3 hours')
     ORDER BY updated_at DESC`,
    [tenant.id]
  );
  console.log(`\n🕒 Contacts Modified in Last 3 Hours (${recentChanges.length} contacts):`);
  const newlyCreated = recentChanges.filter(c => c.is_newly_created);
  const updatedExisting = recentChanges.filter(c => !c.is_newly_created);

  console.log(`   - Newly inserted: ${newlyCreated.length}`);
  console.log(`   - Existing updated: ${updatedExisting.length}`);

  if (recentChanges.length > 0) {
    console.log('\n   Sample of recently modified contacts:');
    recentChanges.slice(0, 10).forEach((c, idx) => {
      console.log(`   [${idx + 1}] ${c.first_name || ''} ${c.last_name || ''} (${c.phone_e164}) | Created: ${c.created_at.toISOString().slice(11, 19)} | Updated: ${c.updated_at.toISOString().slice(11, 19)}`);
      console.log(`       Tags:`, c.tags);
    });
  }

  // 5. Contacts that have 'SMR-Body-Members'
  const { rows: smrBodyContacts } = await query(
    `SELECT id, first_name, last_name, phone_e164, tags, created_at, updated_at
     FROM contacts
     WHERE tenant_id = $1 AND 'SMR-Body-Members' = ANY(tags)
     ORDER BY updated_at DESC`,
    [tenant.id]
  );
  console.log(`\n📌 Contacts with tag 'SMR-Body-Members' (${smrBodyContacts.length} total):`);
  smrBodyContacts.slice(0, 10).forEach((c, idx) => {
    console.log(`   [${idx + 1}] ${c.first_name || ''} ${c.last_name || ''} (${c.phone_e164}) | Tags: ${JSON.stringify(c.tags)} | Created: ${c.created_at.toISOString().slice(11, 19)} | Updated: ${c.updated_at.toISOString().slice(11, 19)}`);
  });

  // 6. Recent contact lists
  const { rows: lists } = await query(
    `SELECT id, name, contact_count, created_at, updated_at
     FROM contact_lists
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenant.id]
  );
  console.log('\n📁 Contact Lists:');
  lists.forEach((l) => {
    console.log(`   - "${l.name}" (ID: ${l.id}) | Count: ${l.contact_count} | Created: ${l.created_at.toISOString().slice(0, 10)}`);
  });

  console.log('\n================================================================');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Error running inspection:', err);
  try { await pool.end(); } catch {}
});

