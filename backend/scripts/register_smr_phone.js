/**
 * Re-Register SMR Phone Number on Meta to apply certificate & display name
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function registerPhone() {
  console.log('\n======================================================');
  console.log('📲 RE-REGISTERING SMR PHONE NUMBER ON META CLOUD API');
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

  console.log(`Workspace: ${t.name}`);
  console.log(`Phone ID:  ${phoneId}\n`);

  console.log('Calling POST /' + phoneId + '/register to apply certificate...');
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        pin: '123456' // Meta PIN or fallback
      })
    });

    const data = await res.json();
    console.log('Meta Registration Response:', JSON.stringify(data, null, 2));

    if (data?.error?.error_user_msg?.includes('PIN') || data?.error?.message?.includes('pin')) {
      console.log('\nRetrying without PIN (in case no two-step PIN was set)...');
      const res2 = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp'
        })
      });
      const data2 = await res2.json();
      console.log('Retry Response:', JSON.stringify(data2, null, 2));
    }
  } catch (err) {
    console.error('Registration failed:', err.message);
  }

  // Check details again
  try {
    const checkRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,status&access_token=${token}`
    );
    const checkData = await checkRes.json();
    console.log('\nVerified Status on Meta:');
    console.log(JSON.stringify(checkData, null, 2));
  } catch (err) {}

  await pool.end();
}

registerPhone().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
