/**
 * Submit Display Name Request on Meta Graph API for SMR
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function submitDisplayNameRequest() {
  console.log('\n======================================================');
  console.log('📝 SUBMITTING SMR DISPLAY NAME REQUEST TO META');
  console.log('======================================================\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, phone_number_id, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%'
     LIMIT 1`
  );

  if (!tenants.length) {
    console.error('❌ SMR tenant not found.');
    process.exit(1);
  }

  const t = tenants[0];
  const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = t.phone_number_id;

  const targetName = 'SMR Swimming Pool & Health Club';
  console.log(`Phone ID:     ${phoneId}`);
  console.log(`Current Name: ${t.name}`);
  console.log(`Target Name:  ${targetName}\n`);

  // 1. Submit new_display_name to Meta
  try {
    const postUrl = `https://graph.facebook.com/v21.0/${phoneId}?new_display_name=${encodeURIComponent(targetName)}&access_token=${token}`;
    console.log(`Calling Meta API: POST /${phoneId}?new_display_name=...`);
    const res = await fetch(postUrl, { method: 'POST' });
    const data = await res.json();
    console.log('Meta Submission Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error submitting name:', err.message);
  }

  // 2. Check updated status
  try {
    const checkRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status&access_token=${token}`
    );
    const checkData = await checkRes.json();
    console.log('\nUpdated Meta Phone Details:');
    console.log(JSON.stringify(checkData, null, 2));
  } catch (err) {
    console.error('Error fetching details:', err.message);
  }

  await pool.end();
}

submitDisplayNameRequest().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
