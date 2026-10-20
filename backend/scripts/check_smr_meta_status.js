/**
 * Check SMR WhatsApp Profile & Display Name Status on Meta Graph API
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function checkStatus() {
  console.log('\n======================================================');
  console.log('🔍 CHECKING SMR META PROFILE & DISPLAY NAME STATUS');
  console.log('======================================================\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, waba_id, phone_number_id, meta_system_token
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

  // 1. Check Phone Number details
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,name_status,new_name_status,status,is_official_business_account&access_token=${token}`
    );
    const data = await res.json();
    console.log('📱 Phone Number Info on Meta:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error checking phone number:', err.message);
  }

  // 2. Check WhatsApp Business Profile (Logo, About, etc.)
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical&access_token=${token}`
    );
    const data = await res.json();
    console.log('\n🖼 Business Profile (Logo & Bio) on Meta:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error checking business profile:', err.message);
  }

  await pool.end();
}

checkStatus().catch((err) => {
  console.error('❌ Check failed:', err);
  process.exit(1);
});
