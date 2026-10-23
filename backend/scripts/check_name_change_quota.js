'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function checkQuota() {
  console.log('\n=== CHECKING PHONE NUMBER METADATA & CHANGE QUOTA ===\n');

  const { rows } = await query(
    `SELECT phone_number_id, meta_system_token, waba_id FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' LIMIT 1`
  );
  if (!rows.length) {
    console.log('No tenant found');
    await pool.end();
    return;
  }

  const token = rows[0].meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = rows[0].phone_number_id;
  const wabaId = rows[0].waba_id;

  // Query all fields on the phone number
  const fields = [
    'display_phone_number',
    'verified_name',
    'name_status',
    'new_display_name',
    'new_name_status',
    'status',
    'quality_rating',
    'account_mode',
    'is_pin_enabled',
    'code_verification_status',
    'messaging_limit_tier',
    'throughput'
  ].join(',');

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?fields=${fields}&access_token=${token}`);
    const data = await res.json();
    console.log('Phone details from Meta:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error fetching phone details:', e.message);
  }

  // Check audit trail or database for when previous display name changes were submitted
  console.log('\n=== CHECKING DATABASE AUDIT TRAIL FOR DISPLAY NAME CHANGES ===\n');
  try {
    const { rows: audits } = await query(
      `SELECT action, resource_type, meta, created_at FROM audit_logs
       WHERE action ILIKE '%display%' OR action ILIKE '%name%' OR action ILIKE '%register%'
       ORDER BY created_at DESC LIMIT 10`
    );
    console.log('Audit records:');
    console.log(JSON.stringify(audits, null, 2));
  } catch (e) {
    console.log('No audit records table or query failed:', e.message);
  }

  await pool.end();
}

checkQuota().catch(async e => {
  console.error(e);
  try { await pool.end(); } catch {}
});
