/**
 * VDAJ Services — Reset SMR Contacts, Groups & Tags
 * ─────────────────────────────────────────────────────────────
 * Completely clears all contacts, contact lists (groups), and
 * list memberships for SMR Swimming Pool & Health Club so fresh
 * contacts can be imported cleanly.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function resetContacts() {
  console.log('\n======================================================');
  console.log('🗑️  RESETTING SMR CONTACTS, GROUPS & TAGS');
  console.log('======================================================\n');

  // 1. Resolve SMR Tenant
  const { rows: tenants } = await query(
    `SELECT id, name, slug FROM tenants 
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' 
     ORDER BY created_at ASC LIMIT 1`
  );

  if (!tenants.length) {
    console.error('❌ Error: SMR tenant not found in database.');
    process.exit(1);
  }

  const tenant = tenants[0];
  console.log(`Found Workspace: ${tenant.name} (${tenant.id})\n`);

  // 2. Cascade delete
  const rMembers = await query(
    `DELETE FROM contact_list_members WHERE tenant_id = $1`,
    [tenant.id]
  );
  console.log(`✔ Cleared ${rMembers.rowCount || 0} contact list members.`);

  const rLists = await query(
    `DELETE FROM contact_lists WHERE tenant_id = $1`,
    [tenant.id]
  );
  console.log(`✔ Deleted ${rLists.rowCount || 0} contact lists (groups).`);

  const rContacts = await query(
    `DELETE FROM contacts WHERE tenant_id = $1`,
    [tenant.id]
  );
  console.log(`✔ Deleted ${rContacts.rowCount || 0} contacts and tags.`);

  console.log('\n✅ SMR workspace reset complete! Ready for fresh contacts upload.\n');
  await pool.end();
}

resetContacts().catch((err) => {
  console.error('❌ Failed to reset contacts:', err);
  process.exit(1);
});
