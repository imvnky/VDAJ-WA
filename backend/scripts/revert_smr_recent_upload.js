'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool, withTransaction } = require('../src/config/database');

async function main() {
  const isConfirm = process.argv.includes('--confirm');

  console.log('================================================================');
  console.log(`🛡️ SMR SAFE REVERT UTILITY [${isConfirm ? 'EXECUTION MODE' : 'DRY-RUN / PREVIEW'}]`);
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

  // 1. Identify all contacts that have tag 'SMR-Body-Members'
  const { rows: taggedContacts } = await query(
    `SELECT id, first_name, last_name, phone_e164, tags, created_at, updated_at,
            (created_at >= NOW() - INTERVAL '4 hours') AS is_newly_created
     FROM contacts
     WHERE tenant_id = $1 AND 'SMR-Body-Members' = ANY(tags)
     ORDER BY created_at DESC`,
    [tenant.id]
  );

  console.log(`Found ${taggedContacts.length} contacts with tag 'SMR-Body-Members'.`);

  const newlyCreated = taggedContacts.filter(c => c.is_newly_created);
  const existingUpdated = taggedContacts.filter(c => !c.is_newly_created);

  console.log(`\nBreakdown:`);
  console.log(`  1. Brand-new contacts created in this recent upload: ${newlyCreated.length}`);
  console.log(`  2. Pre-existing contacts updated with this tag:       ${existingUpdated.length}`);

  if (newlyCreated.length > 0) {
    console.log(`\nNew contacts to be DELETED (${newlyCreated.length}):`);
    newlyCreated.slice(0, 5).forEach((c, i) => {
      console.log(`   [${i + 1}] ${c.first_name || ''} ${c.last_name || ''} (${c.phone_e164}) | Created: ${c.created_at.toISOString()}`);
    });
    if (newlyCreated.length > 5) console.log(`   ... and ${newlyCreated.length - 5} more`);
  }

  if (existingUpdated.length > 0) {
    console.log(`\nExisting contacts to have 'SMR-Body-Members' REMOVED from tags (${existingUpdated.length}):`);
    existingUpdated.slice(0, 5).forEach((c, i) => {
      const remainingTags = (c.tags || []).filter(t => t !== 'SMR-Body-Members');
      console.log(`   [${i + 1}] ${c.first_name || ''} ${c.last_name || ''} (${c.phone_e164})`);
      console.log(`       Current tags:   ${JSON.stringify(c.tags)}`);
      console.log(`       Remaining tags: ${JSON.stringify(remainingTags)}`);
    });
    if (existingUpdated.length > 5) console.log(`   ... and ${existingUpdated.length - 5} more`);
  }

  if (!isConfirm) {
    console.log('\n----------------------------------------------------------------');
    console.log('⚠️  DRY-RUN COMPLETE: No changes were made to the database.');
    console.log('To execute this revert safely, run:');
    console.log('node backend/scripts/revert_smr_recent_upload.js --confirm');
    console.log('----------------------------------------------------------------');
    await pool.end();
    return;
  }

  // EXECUTION MODE
  await withTransaction(async (client) => {
    // 1. Delete newly created contacts
    if (newlyCreated.length > 0) {
      const idsToDelete = newlyCreated.map(c => c.id);
      const { rowCount: delCount } = await client.query(
        `DELETE FROM contacts WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
        [idsToDelete, tenant.id]
      );
      console.log(`\n✅ Deleted ${delCount} newly created contacts.`);
    }

    // 2. Remove 'SMR-Body-Members' from existing contacts
    if (existingUpdated.length > 0) {
      const idsToUpdate = existingUpdated.map(c => c.id);
      const { rowCount: updCount } = await client.query(
        `UPDATE contacts
         SET tags = array_remove(tags, 'SMR-Body-Members'),
             updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
        [idsToUpdate, tenant.id]
      );
      console.log(`✅ Stripped 'SMR-Body-Members' tag from ${updCount} pre-existing contacts.`);
    }

    // 3. Clean up empty contact lists if any list named 'SMR-Body-Members' was created
    const { rows: emptyLists } = await client.query(
      `SELECT id, name FROM contact_lists
       WHERE tenant_id = $1 AND name ILIKE '%SMR-Body-Members%'`,
      [tenant.id]
    );
    for (const list of emptyLists) {
      const { rows: [{ count }] } = await client.query(
        `SELECT COUNT(*) AS count FROM contact_list_members WHERE contact_list_id = $1`,
        [list.id]
      );
      if (parseInt(count, 10) === 0) {
        await client.query(`DELETE FROM contact_lists WHERE id = $1`, [list.id]);
        console.log(`🗑️ Removed empty contact list "${list.name}".`);
      }
    }
  });

  console.log('\n🎉 REVERT COMPLETED SUCCESSFULLY! Previous contacts restored.');
  console.log('================================================================');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Error during revert:', err);
  try { await pool.end(); } catch {}
});
