'use strict';

/**
 * VDAJ Services — Reconcile & Sync Directory Names to Inbox Conversations
 *
 * Ensures that if a contact's name exists in the Directory (contacts table),
 * the inbox conversation display_name is updated to that directory name.
 * If not in directory, preserves the WhatsApp profile name (or phone number).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function main() {
  console.log('===============================================================');
  console.log(' SYNCING DIRECTORY NAMES TO INBOX CONVERSATIONS');
  console.log('===============================================================\n');

  // 1. Fetch conversations before sync to inspect
  const { rows: before } = await query(
    `SELECT 
       ic.id, ic.phone_e164, ic.display_name AS old_display_name,
       COALESCE(
         NULLIF(TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')), ''),
         NULLIF(c.first_name, ''),
         NULLIF(c.last_name, ''),
         NULLIF(c.custom_vars->>'Name', ''),
         NULLIF(c.custom_vars->>'name', ''),
         NULLIF(c.custom_vars->>'Full Name', '')
       ) AS directory_name
     FROM inbox_conversations ic
     JOIN contacts c ON c.tenant_id = ic.tenant_id
       AND (c.id = ic.contact_id OR c.phone_e164 = ic.phone_e164 OR RIGHT(c.phone_e164, 10) = RIGHT(ic.phone_e164, 10))
     WHERE ic.deleted_at IS NULL`
  );

  console.log(`Found ${before.length} conversation(s) matched to directory contacts.`);

  const toUpdate = before.filter(
    (b) => b.directory_name && b.directory_name.trim() !== (b.old_display_name || '').trim()
  );

  if (toUpdate.length > 0) {
    console.log(`\nFound ${toUpdate.length} conversation(s) where Directory Name differs from WhatsApp Profile Name:`);
    toUpdate.slice(0, 15).forEach((item, idx) => {
      console.log(`  [${idx + 1}] ${item.phone_e164}: "${item.old_display_name}" ➡️ "${item.directory_name}"`);
    });
    if (toUpdate.length > 15) {
      console.log(`  ... and ${toUpdate.length - 15} more.`);
    }
  } else {
    console.log('\nAll matched conversations already have matching directory names.');
  }

  // 2. Perform the update
  const updateResult = await query(
    `UPDATE inbox_conversations ic
     SET 
       contact_id = COALESCE(ic.contact_id, c.id),
       display_name = COALESCE(
         NULLIF(TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')), ''),
         NULLIF(c.first_name, ''),
         NULLIF(c.last_name, ''),
         NULLIF(c.custom_vars->>'Name', ''),
         NULLIF(c.custom_vars->>'name', ''),
         NULLIF(c.custom_vars->>'Full Name', ''),
         ic.display_name
       ),
       updated_at = NOW()
     FROM contacts c
     WHERE c.tenant_id = ic.tenant_id
       AND (c.id = ic.contact_id OR c.phone_e164 = ic.phone_e164 OR RIGHT(c.phone_e164, 10) = RIGHT(ic.phone_e164, 10))
       AND COALESCE(
         NULLIF(TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')), ''),
         NULLIF(c.first_name, ''),
         NULLIF(c.last_name, ''),
         NULLIF(c.custom_vars->>'Name', ''),
         NULLIF(c.custom_vars->>'name', ''),
         NULLIF(c.custom_vars->>'Full Name', '')
       ) IS NOT NULL
       AND (
         ic.display_name IS NULL
         OR ic.display_name != COALESCE(
           NULLIF(TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')), ''),
           NULLIF(c.first_name, ''),
           NULLIF(c.last_name, ''),
           NULLIF(c.custom_vars->>'Name', ''),
           NULLIF(c.custom_vars->>'name', ''),
           NULLIF(c.custom_vars->>'Full Name', '')
         )
       )`
  );

  console.log(`\n✅ Successfully updated ${updateResult.rowCount} inbox conversation display name(s) from directory.`);
  console.log('===============================================================\n');

  await pool.end();
}

main().catch(async (err) => {
  console.error('Fatal error during sync:', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
