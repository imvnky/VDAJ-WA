'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function applyNow() {
  console.log('\n======================================================');
  console.log('⚡ APPLYING APPROVED NAME: "SMR Swimming Pool and Health Club"');
  console.log('======================================================\n');

  const { rows } = await query(
    `SELECT phone_number_id, meta_system_token FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' LIMIT 1`
  );
  if (!rows.length) {
    console.log('No SMR tenant found');
    await pool.end();
    return;
  }
  const token = rows[0].meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = rows[0].phone_number_id;

  console.log(`Phone ID: ${phoneId}`);
  console.log('Calling POST /' + phoneId + '/register with PIN 123456...');

  const regRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      pin: '123456'
    })
  });
  const regData = await regRes.json();
  console.log('Register Response:', JSON.stringify(regData, null, 2));

  // Check updated phone details
  const checkRes = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status,status,quality_rating&access_token=${token}`
  );
  const checkData = await checkRes.json();
  console.log('\n--- VERIFIED PHONE DETAILS ON META ---');
  console.log(JSON.stringify(checkData, null, 2));

  if (checkData.verified_name === 'SMR Swimming Pool and Health Club') {
    console.log('\n🎉 SUCCESS! "SMR Swimming Pool and Health Club" is now VERIFIED & LIVE on WhatsApp!');
  } else {
    console.log('\nCurrent Verified Name:', checkData.verified_name);
    console.log('New Display Name:    ', checkData.new_display_name);
    console.log('New Name Status:     ', checkData.new_name_status);
  }

  await pool.end();
  console.log('\n======================================================\n');
}

applyNow().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
