/**
 * VDAJ Services — SMR Swimming Pool & Health Club Contacts Importer
 * ─────────────────────────────────────────────────────────────────
 * Seamlessly imports Committee and Club Members from official register
 * into the SMR tenant with automated deduplication, tag allocation,
 * audience list linking, and BSP compliance opt-in recording.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool, withTransaction } = require('../src/config/database');

// Raw parsed contacts data extracted directly from "Comittee & members.xlsx"
const RAW_COMMITTEE = [
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

const RAW_MEMBERS = require('./smr_members_data.json');

async function importSmrContacts() {
  console.log('\n======================================================');
  console.log('🏊 SMR SWIMMING POOL & HEALTH CLUB — CONTACTS IMPORT');
  console.log('======================================================\n');

  // 1. Resolve SMR Tenant
  const { rows: tenants } = await query(
    `SELECT id, name, slug FROM tenants 
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' 
     ORDER BY created_at ASC LIMIT 1`
  );

  let tenant = tenants[0];
  if (!tenant) {
    console.log('  Creating SMR Swimming Pool & Health Club tenant...');
    const { rows: [newT] } = await query(
      `INSERT INTO tenants 
         (name, slug, plan, country_code, timezone, max_messages_per_day, monthly_message_quota, status, is_active)
       VALUES 
         ('SMR Swimming Pool & Health Club', 'smr-swimming-pool', 'enterprise', 'IN', 'Asia/Kolkata', 50000, 500000, 'active', TRUE)
       RETURNING id, name, slug`
    );
    tenant = newT;
  }
  console.log(`✔ Target Tenant: "${tenant.name}" (ID: ${tenant.id}, Slug: ${tenant.slug})\n`);

  // 2. Resolve/Create Contact Lists (Audience Groups)
  console.log('📁 Setting up Audience Groups...');
  let committeeListId = null;
  let membersListId = null;

  // Committee List
  const { rows: [comList] } = await query(
    `INSERT INTO contact_lists (tenant_id, name, description)
     VALUES ($1, 'Committee', 'SMR Swimming Pool & Health Club Managing Committee')
     ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [tenant.id]
  );
  committeeListId = comList.id;
  console.log(`  ✔ Committee List ID: ${committeeListId}`);

  // Members List
  const { rows: [memList] } = await query(
    `INSERT INTO contact_lists (tenant_id, name, description)
     VALUES ($1, 'Members', 'SMR Swimming Pool & Health Club General Membership (Individual & Family)')
     ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [tenant.id]
  );
  membersListId = memList.id;
  console.log(`  ✔ Members List ID:   ${membersListId}\n`);

  // 3. Process & Merge Contacts
  console.log('🔄 Sanitizing and mapping contacts...');

  const contactsMap = new Map(); // phone_e164 -> contact payload

  // Process Committee first
  for (const c of RAW_COMMITTEE) {
    const rawDigits = (c.phone || '').replace(/[^0-9]/g, '');
    if (rawDigits.length < 10) continue;
    const p10 = rawDigits.slice(-10);
    const phoneE164 = `+91${p10}`;

    const nameParts = c.name.trim().split(/\s+/);
    const firstName = nameParts[0] || c.name.trim();
    const lastName = nameParts.slice(1).join(' ') || null;

    contactsMap.set(phoneE164, {
      phone: phoneE164,
      firstName: firstName,
      lastName: lastName,
      tags: ['committee'],
      lists: [committeeListId],
      customVars: {
        committee_sr_no: c.sr,
        designation: 'Committee Member',
        committee_name: c.name.trim()
      }
    });
  }

  // Process General Members
  let skippedInvalid = 0;
  for (const m of RAW_MEMBERS) {
    const rawDigits = (m.phone || '').replace(/[^0-9]/g, '');
    if (rawDigits.length < 10) {
      skippedInvalid++;
      continue;
    }
    const p10 = rawDigits.slice(-10);
    const phoneE164 = `+91${p10}`;

    const membershipType = (m.id_no || '').startsWith('F-') ? 'Family' : 'Individual';

    if (contactsMap.has(phoneE164)) {
      // Overlap (e.g. Committee member who is also a Member, or duplicate family number)
      const existing = contactsMap.get(phoneE164);
      if (!existing.tags.includes('member')) existing.tags.push('member');
      if (!existing.lists.includes(membersListId)) existing.lists.push(membersListId);
      
      existing.customVars.member_id = m.id_no || existing.customVars.member_id;
      existing.customVars.membership_type = membershipType;
      existing.customVars.member_name = m.name ? m.name.trim() : existing.customVars.member_name;
    } else {
      const memName = (m.name || '').trim();
      const memParts = memName.split(/\s+/);
      const firstName = memParts[0] || (memName || `Member ${m.id_no || ''}`).trim();
      const lastName = memParts.length > 1 ? memParts.slice(1).join(' ') : null;

      contactsMap.set(phoneE164, {
        phone: phoneE164,
        firstName: firstName,
        lastName: lastName,
        tags: ['member', membershipType.toLowerCase() + '-membership'],
        lists: [membersListId],
        customVars: {
          member_id: m.id_no || null,
          membership_type: membershipType
        }
      });
    }
  }

  console.log(`  ✔ Unique valid contact phone numbers: ${contactsMap.size}`);
  console.log(`  ⚠ Skipped incomplete/empty phone rows: ${skippedInvalid}\n`);

  // 4. Upsert into database
  console.log('💾 Writing contacts into PostgreSQL database...');

  const allContacts = Array.from(contactsMap.values());
  let inserted = 0;
  let updated = 0;
  let committeeCount = 0;
  let memberCount = 0;

  for (const c of allContacts) {
    const isCommittee = c.lists.includes(committeeListId);
    const isMember = c.lists.includes(membersListId);
    if (isCommittee) committeeCount++;
    if (isMember) memberCount++;

    const { rows: [upserted] } = await query(
      `INSERT INTO contacts 
         (tenant_id, phone_e164, first_name, last_name, custom_vars, tags, status, opted_in_at, opt_in_source, opt_in_proof)
       VALUES 
         ($1, $2, $3, $4, $5::jsonb, $6::text[], 'active', NOW(), 'member_directory', 'SMR Swimming Pool & Health Club Official Directory 2026')
       ON CONFLICT (tenant_id, phone_e164) DO UPDATE
       SET 
         first_name  = EXCLUDED.first_name,
         last_name   = EXCLUDED.last_name,
         custom_vars = contacts.custom_vars || EXCLUDED.custom_vars,
         tags        = ARRAY(SELECT DISTINCT UNNEST(COALESCE(contacts.tags, '{}') || EXCLUDED.tags)),
         status      = 'active',
         opted_in_at = COALESCE(contacts.opted_in_at, NOW()),
         updated_at  = NOW()
       RETURNING id, (xmax = 0) AS is_new`,
      [
        tenant.id,
        c.phone,
        c.firstName,
        c.lastName,
        JSON.stringify(c.customVars),
        c.tags
      ]
    );

    if (upserted.is_new) inserted++;
    else updated++;

    // Link to lists
    for (const listId of c.lists) {
      await query(
        `INSERT INTO contact_list_members (contact_list_id, contact_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [listId, upserted.id]
      );
    }
  }

  // Update contact_count on contact_lists
  await query(
    `UPDATE contact_lists cl
     SET contact_count = (
       SELECT COUNT(*) FROM contact_list_members clm WHERE clm.contact_list_id = cl.id
     )
     WHERE cl.tenant_id = $1`,
    [tenant.id]
  );

  console.log('\n======================================================');
  console.log('🎉 SMR CONTACTS IMPORT COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log(`  ✔ Total Contacts in Database: ${allContacts.length}`);
  console.log(`  ✔ Newly Created Contacts:     ${inserted}`);
  console.log(`  ✔ Updated Existing Contacts:  ${updated}`);
  console.log(`  ✔ Linked to "Committee" List: ${committeeCount} contacts`);
  console.log(`  ✔ Linked to "Members" List:   ${memberCount} contacts`);
  console.log('======================================================\n');
}

importSmrContacts()
  .then(() => pool.end())
  .catch((err) => {
    console.error('❌ Import failed:', err);
    pool.end();
  });
