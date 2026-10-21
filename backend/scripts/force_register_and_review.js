/**
 * Force Register & Activate Display Name Certificate on Meta Cloud API
 * ────────────────────────────────────────────────────────────────────
 * When name_status is AVAILABLE_WITHOUT_REVIEW, Meta requires calling
 * POST /{phoneId}/register to activate the certificate so that WhatsApp
 * apps display "SMR Swimming Pool & Health Club" to message recipients.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function forceRegister() {
  console.log('\n================================================================');
  console.log('🚀 ACTIVATING SMR WHATSAPP DISPLAY NAME CERTIFICATE ON META');
  console.log('================================================================\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, phone_number_id, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%'
     LIMIT 1`
  );

  if (!tenants.length) {
    console.error('❌ SMR tenant not found in database.');
    await pool.end();
    process.exit(1);
  }

  const t = tenants[0];
  const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = t.phone_number_id;

  console.log(`Workspace: ${t.name}`);
  console.log(`Phone ID:  ${phoneId}\n`);

  // Step 1: Query current status
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status,status&access_token=${token}`
  );
  const statusData = await res.json();
  console.log('Current Status on Meta:');
  console.log(JSON.stringify(statusData, null, 2));

  // Step 2: Call register endpoint
  console.log('\nCalling POST /' + phoneId + '/register to bind certificate to WhatsApp network...');
  
  // Try with PIN: '123456'
  let regRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/register`, {
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
  let regData = await regRes.json();
  console.log('Registration with PIN (123456):', JSON.stringify(regData, null, 2));

  // If PIN error or invalid, try without PIN
  if (regData.error) {
    console.log('\nTrying registration without PIN parameter...');
    regRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp'
      })
    });
    regData = await regRes.json();
    console.log('Registration without PIN:', JSON.stringify(regData, null, 2));
  }

  // Step 3: Check status after registration
  console.log('\nVerifying updated phone certificate status...');
  const afterRes = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,status,quality_rating&access_token=${token}`
  );
  const afterData = await afterRes.json();
  console.log(JSON.stringify(afterData, null, 2));

  if (regData.success) {
    console.log('\n🎉 SUCCESS! The phone certificate has been registered on WhatsApp!');
    console.log(`Recipients will now see "${afterData.verified_name || 'SMR Swimming Pool & Health Club'}"!`);
  }

  await pool.end();
  console.log('\n================================================================\n');
}

forceRegister().catch(async (err) => {
  console.error('Execution error:', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
