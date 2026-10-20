/**
 * VDAJ Services — SMR Swimming Pool & Health Club
 * Official Group Importer from "Comittee & members.xlsx"
 * ─────────────────────────────────────────────────────────────
 * Creates 3 distinct audience groups:
 *   1. "SMR Committee Members" (19 members)
 *   2. "Individual Members"     (183 members, I- IDs)
 *   3. "Family Members"         (184 members, F- IDs)
 *
 * Rules strictly enforced:
 *   - Exactly 1 unique contact in DB per phone number (369 unique contacts total).
 *   - Overlapping members (12 people) are linked to both/all relevant groups in
 *     contact_list_members so they appear inside each group.
 *   - No duplicate DB records.
 */

'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

const COMMITTEE_ENGLISH = [
  { sr: "1", name: "Laxmiraman Lahoti", phone: "9420933333" },
  { sr: "2", name: "Shaileshkumar Lahoti", phone: "9881955555" },
  { sr: "3", name: "Rajendrakumar Malpani", phone: "9423076701" },
  { sr: "4", name: "Ashish Bajpai", phone: "7888013050" },
  { sr: "5", name: "Kamalkishor Agrawal", phone: "9422470222" },
  { sr: "6", name: "Hukumchand Kalantri", phone: "9823025258" },
  { sr: "7", name: "Ashish Agrawal", phone: "8888888525" },
  { sr: "8", name: "Chaitanya Bhargav", phone: "9822602737" },
  { sr: "9", name: "Ashish Baheti", phone: "9850022500" },
  { sr: "10", name: "Sanjay Gaikwad", phone: "9422071374" },
  { sr: "11", name: "Dhanraj Joshi", phone: "9422071855" },
  { sr: "12", name: "Abhay Shah", phone: "9822295627" },
  { sr: "13", name: "Ganesh Hedda", phone: "9823177446" },
  { sr: "14", name: "Nikhil Rathi", phone: "9049338338" },
  { sr: "15", name: "Manish Rathi", phone: "9325345298" },
  { sr: "16", name: "Ashish Somani", phone: "9850047778" },
  { sr: "17", name: "Anand Lakhotia", phone: "9850153322" },
  { sr: "18", name: "Ajay Mantri", phone: "9422070183" },
  { sr: "19", name: "Deepak Baheti", phone: "9422070500" }
];

async function importExcelGroups() {
  console.log('\n======================================================');
  console.log('🏊 SMR OFFICIAL EXCEL GROUP IMPORTER');
  console.log('======================================================\n');

  // 1. Resolve SMR Tenant
  const { rows: tenants } = await query(
    `SELECT id, name, slug FROM tenants 
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' 
     ORDER BY created_at ASC LIMIT 1`
  );

  if (!tenants.length) {
    console.error('❌ SMR tenant not found.');
    process.exit(1);
  }
  const tenant = tenants[0];
  console.log(`✔ Target Tenant: "${tenant.name}" (${tenant.id})\n`);

  // 2. Setup the 3 Groups (Contact Lists)
  console.log('📁 Creating/Verifying the 3 Audience Groups...');
  const groupDefs = [
    { name: 'SMR Committee Members', desc: 'SMR Swimming Pool & Health Club Managing Committee Body' },
    { name: 'Individual Members',     desc: 'SMR Swimming Pool & Health Club Individual Membership (I- IDs)' },
    { name: 'Family Members',         desc: 'SMR Swimming Pool & Health Club Family Membership (F- IDs)' },
  ];

  const groupMap = {}; // groupName -> listId
  for (const g of groupDefs) {
    const { rows: [list] } = await query(
      `INSERT INTO contact_lists (tenant_id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, name) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()
       RETURNING id, name`,
      [tenant.id, g.name, g.desc]
    );
    groupMap[g.name] = list.id;
    console.log(`  ✔ Group "${g.name}": ID ${list.id}`);
  }

  // 3. Load Members from bundled verified dataset
  const parsedData = require('./smr_parsed_excel_data.json');
  const committeeList = COMMITTEE_ENGLISH;
  const individualList = parsedData.individual || [];
  const familyList = parsedData.family || [];

  console.log(`\nFound in dataset:`);
  console.log(`  - Committee:  ${committeeList.length} members`);
  console.log(`  - Individual: ${individualList.length} members`);
  console.log(`  - Family:     ${familyList.length} members`);

  // 5. Merge contacts into unique phone numbers
  // phone_e164 -> { phone, firstName, lastName, groups: Set, customVars: {} }
  const contactsByPhone = new Map();

  // Helper to add/merge contact
  function addOrMergeContact(phone10, name, groupId, extraVars) {
    const phoneE164 = `+91${phone10}`;
    const nameTrimmed = (name || '').trim();
    const parts = nameTrimmed.split(/\s+/);
    const firstName = parts[0] || 'Member';
    const lastName = parts.slice(1).join(' ') || null;

    if (!contactsByPhone.has(phoneE164)) {
      contactsByPhone.set(phoneE164, {
        phone: phoneE164,
        firstName,
        lastName,
        groups: new Set([groupId]),
        customVars: { ...extraVars, name: nameTrimmed }
      });
    } else {
      const existing = contactsByPhone.get(phoneE164);
      existing.groups.add(groupId);
      // Prefer committee or more complete name
      if (extraVars.designation === 'Committee Member' || (!existing.lastName && lastName)) {
        existing.firstName = firstName;
        existing.lastName = lastName;
      }
      existing.customVars = { ...existing.customVars, ...extraVars };
    }
  }

  // 1. Process Committee
  for (const c of committeeList) {
    addOrMergeContact(c.phone, c.name, groupMap['SMR Committee Members'], {
      committee_sr_no: c.sr,
      designation: 'Committee Member',
    });
  }

  // 2. Process Individual Members
  for (const m of individualList) {
    addOrMergeContact(m.phone, m.name, groupMap['Individual Members'], {
      member_id: m.idNo,
      membership_type: 'Individual',
    });
  }

  // 3. Process Family Members
  for (const m of familyList) {
    addOrMergeContact(m.phone, m.name, groupMap['Family Members'], {
      member_id: m.idNo,
      membership_type: 'Family',
    });
  }

  console.log(`\n✔ Total Unique Contacts to Upsert: ${contactsByPhone.size}`);

  // Count overlaps
  let multiGroupCount = 0;
  for (const c of contactsByPhone.values()) {
    if (c.groups.size > 1) multiGroupCount++;
  }
  console.log(`✔ Contacts belonging to multiple groups: ${multiGroupCount}`);

  // 6. Database Upsert
  console.log('\n💾 Writing contacts and group memberships into PostgreSQL...');

  let upsertedCount = 0;
  for (const [phoneE164, data] of contactsByPhone.entries()) {
    // 6a. Upsert contact
    const { rows: [contact] } = await query(
      `INSERT INTO contacts 
         (tenant_id, phone_e164, first_name, last_name, custom_vars, tags, status, opted_in_at, opt_in_source, opt_in_proof)
       VALUES 
         ($1, $2, $3, $4, $5::jsonb, '{}', 'active', NOW(), 'member_directory', 'SMR Swimming Pool & Health Club Official Directory')
       ON CONFLICT (tenant_id, phone_e164) DO UPDATE
       SET 
         first_name  = EXCLUDED.first_name,
         last_name   = EXCLUDED.last_name,
         custom_vars = contacts.custom_vars || EXCLUDED.custom_vars,
         status      = 'active',
         updated_at  = NOW()
       RETURNING id`,
      [tenant.id, phoneE164, data.firstName, data.lastName, JSON.stringify(data.customVars)]
    );

    // 6b. Link to each assigned group
    for (const listId of data.groups) {
      await query(
        `INSERT INTO contact_list_members (contact_list_id, contact_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [listId, contact.id]
      );
    }
    upsertedCount++;
  }

  console.log(`✔ Successfully upserted ${upsertedCount} unique contacts.`);

  // 7. Update contact_count on contact_lists
  console.log('\n📊 Recalculating group member counts...');
  for (const [groupName, listId] of Object.entries(groupMap)) {
    const { rows: [cnt] } = await query(
      `SELECT COUNT(*)::int AS count 
       FROM contact_list_members clm
       JOIN contacts c ON c.id = clm.contact_id
       WHERE clm.contact_list_id = $1 AND c.status = 'active'`,
      [listId]
    );

    await query(
      `UPDATE contact_lists 
       SET contact_count = $1, updated_at = NOW() 
       WHERE id = $2`,
      [cnt.count, listId]
    );

    console.log(`  - "${groupName}": ${cnt.count} active contacts`);
  }

  console.log('\n✅ IMPORT COMPLETE! All 3 groups are populated.');
  await pool.end();
}

importExcelGroups().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
