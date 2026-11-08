'use strict';
const path = require('path');
const fs = require('fs');
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

  // Load original membership lookup from smr_parsed_excel_data.json
  const originalLookup = new Map();
  try {
    const dataPath = path.resolve(__dirname, 'smr_parsed_excel_data.json');
    if (fs.existsSync(dataPath)) {
      const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      (d.individual || []).forEach((x) => {
        const p = (x.phone || x.phoneE164 || '').replace(/[\s\-().]/g, '').slice(-10);
        if (p) originalLookup.set(p, 'Alphabetica-Individual-Membership');
      });
      (d.family || []).forEach((x) => {
        const p = (x.phone || x.phoneE164 || '').replace(/[\s\-().]/g, '').slice(-10);
        if (p) originalLookup.set(p, 'Alphabetica-Family-Membership');
      });
    }
  } catch (err) {
    console.warn('Notice: Could not load smr_parsed_excel_data.json:', err.message);
  }

  // 1. Identify all contacts that have tag 'SMR-Body-Members'
  const { rows: taggedContacts } = await query(
    `SELECT id, first_name, last_name, phone_e164, tags, created_at, updated_at,
            (created_at >= '2026-11-08T13:00:00Z') AS is_newly_created
     FROM contacts
     WHERE tenant_id = $1 AND 'SMR-Body-Members' = ANY(tags)
     ORDER BY created_at DESC`,
    [tenant.id]
  );

  console.log(`Found ${taggedContacts.length} contacts with tag 'SMR-Body-Members'.`);

  const newlyCreated = taggedContacts.filter((c) => c.is_newly_created);
  const existingUpdated = taggedContacts.filter((c) => !c.is_newly_created);

  console.log(`\nBreakdown:`);
  console.log(`  1. Brand-new contacts created in this recent upload: ${newlyCreated.length}`);
  console.log(`  2. Pre-existing contacts updated with this tag:       ${existingUpdated.length}`);

  if (newlyCreated.length > 0) {
    console.log(`\nNew contacts to be DELETED (${newlyCreated.length}):`);
    newlyCreated.forEach((c, i) => {
      console.log(`   [${i + 1}] ${c.first_name || ''} ${c.last_name || ''} (${c.phone_e164}) | Created: ${c.created_at.toISOString().slice(11, 19)}`);
    });
  }

  if (existingUpdated.length > 0) {
    console.log(`\nExisting contacts to have original membership tag RESTORED (${existingUpdated.length}):`);
    existingUpdated.forEach((c, i) => {
      const p10 = (c.phone_e164 || '').replace(/[\s\-().]/g, '').slice(-10);
      const originalTag = originalLookup.get(p10) || 'Alphabetica-Family-Membership';
      console.log(`   [${i + 1}] ${c.first_name || ''} ${c.last_name || ''} (${c.phone_e164})`);
      console.log(`       Current tag:  ${JSON.stringify(c.tags)}`);
      console.log(`       Restored tag: ["${originalTag}"]`);
    });
  }

  if (!isConfirm) {
    console.log('\n----------------------------------------------------------------');
    console.log('⚠️  DRY-RUN COMPLETE: No changes were made to the database.');
    console.log('To execute this revert safely and restore original tags, run:');
    console.log('node backend/scripts/revert_smr_recent_upload.js --confirm');
    console.log('----------------------------------------------------------------');
    await pool.end();
    return;
  }

  // EXECUTION MODE
  await withTransaction(async (client) => {
    // 1. Delete newly created contacts
    if (newlyCreated.length > 0) {
      const idsToDelete = newlyCreated.map((c) => c.id);
      const { rowCount: delCount } = await client.query(
        `DELETE FROM contacts WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
        [idsToDelete, tenant.id]
      );
      console.log(`\n✅ Deleted ${delCount} newly created contacts.`);
    }

    // 2. Restore original tags for pre-existing contacts
    if (existingUpdated.length > 0) {
      let restoredCount = 0;
      for (const c of existingUpdated) {
        const p10 = (c.phone_e164 || '').replace(/[\s\-().]/g, '').slice(-10);
        const originalTag = originalLookup.get(p10) || 'Alphabetica-Family-Membership';
        await client.query(
          `UPDATE contacts
           SET tags = $1,
               updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3`,
          [[originalTag], c.id, tenant.id]
        );
        restoredCount++;
      }
      console.log(`✅ Restored original membership tag for ${restoredCount} pre-existing contacts.`);
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

  console.log('\n🎉 REVERT COMPLETED SUCCESSFULLY! Original membership tags restored.');
  console.log('================================================================');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Error during revert:', err);
  try { await pool.end(); } catch {}
});
