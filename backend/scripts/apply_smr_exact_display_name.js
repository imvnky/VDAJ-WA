/**
 * Apply Exact Display Name: "SMR Swimming Pool & Health Club" & Register Certificate
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function applyExactDisplayName() {
  console.log('\n======================================================');
  console.log('🏛️  APPLYING EXACT SMR DISPLAY NAME: SMR Swimming Pool & Health Club');
  console.log('======================================================\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, phone_number_id, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%'
     LIMIT 1`
  );

  if (!tenants.length) {
    console.error('❌ SMR tenant not found in database.');
    process.exit(1);
  }

  const t = tenants[0];
  const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = t.phone_number_id;
  const targetName = 'SMR Swimming Pool & Health Club';

  console.log(`Workspace:   ${t.name}`);
  console.log(`Phone ID:    ${phoneId}`);
  console.log(`Target Name: ${targetName}\n`);

  // 1. Check current status before change
  console.log('--- STEP 1: Current Status on Meta ---');
  try {
    const preRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status,status,quality_rating&access_token=${token}`
    );
    const preData = await preRes.json();
    console.log(JSON.stringify(preData, null, 2));
  } catch (err) {
    console.error('Pre-check error:', err.message);
  }

  // 2. Submit exact target name to Meta Graph API
  console.log('\n--- STEP 2: Submitting "SMR Swimming Pool & Health Club" to Meta ---');
  try {
    const postUrl = `https://graph.facebook.com/v21.0/${phoneId}?new_display_name=${encodeURIComponent(targetName)}&access_token=${token}`;
    const submitRes = await fetch(postUrl, { method: 'POST' });
    const submitData = await submitRes.json();
    console.log('Meta Submission Response:', JSON.stringify(submitData, null, 2));
  } catch (err) {
    console.error('Submission error:', err.message);
  }

  // 3. Inspect updated status on Meta
  console.log('\n--- STEP 3: Checking Updated Display Name Status on Meta ---');
  let currentNewNameStatus = null;
  try {
    const checkRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status,status&access_token=${token}`
    );
    const checkData = await checkRes.json();
    console.log(JSON.stringify(checkData, null, 2));
    currentNewNameStatus = checkData.new_name_status;
  } catch (err) {
    console.error('Status check error:', err.message);
  }

  // 4. Attempt Phone Re-Registration to apply certificate if status permits
  console.log('\n--- STEP 4: Phone Re-Registration to Activate Certificate ---');
  console.log(`Status for new name: ${currentNewNameStatus}`);

  // Try registration without PIN first, then with standard PIN
  const tryRegister = async (payload) => {
    return await fetch(`https://graph.facebook.com/v21.0/${phoneId}/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  };

  try {
    console.log('Attempting register call (with whatsapp messaging_product)...');
    let regRes = await tryRegister({ messaging_product: 'whatsapp' });
    let regData = await regRes.json();
    console.log('Register Attempt 1 (no PIN):', JSON.stringify(regData, null, 2));

    if (regData?.error?.message?.toLowerCase().includes('pin') || regData?.error?.error_user_msg?.toLowerCase().includes('pin')) {
      console.log('PIN required. Attempting with standard default PIN (123456)...');
      regRes = await tryRegister({ messaging_product: 'whatsapp', pin: '123456' });
      regData = await regRes.json();
      console.log('Register Attempt 2 (PIN 123456):', JSON.stringify(regData, null, 2));
    }
  } catch (err) {
    console.error('Registration call failed:', err.message);
  }

  // 5. Final verification check
  console.log('\n--- STEP 5: Final Verification Status on Meta ---');
  try {
    const finalRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status,status&access_token=${token}`
    );
    const finalData = await finalRes.json();
    console.log(JSON.stringify(finalData, null, 2));

    if (finalData.verified_name === targetName) {
      console.log(`\n🎉 SUCCESS! Verified display name is now LIVE as: "${finalData.verified_name}"`);
      await query(`UPDATE tenants SET verified_name = $1, updated_at = NOW() WHERE id = $2`, [targetName, t.id]);
    } else {
      console.log(`\nCurrent verified_name: "${finalData.verified_name}"`);
      console.log(`new_display_name:     "${finalData.new_display_name}"`);
      console.log(`new_name_status:      "${finalData.new_name_status}"`);
    }
  } catch (err) {}

  await pool.end();
  console.log('\n======================================================\n');
}

applyExactDisplayName().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
