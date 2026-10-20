/**
 * Inspect VDAJ Lifecare Tenant & WhatsApp Profile on Meta
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function inspectLifecare() {
  console.log('\n======================================================');
  console.log('🔍 AUDITING VDAJ LIFECARE WHATSAPP PROFILE & LOGO ON META');
  console.log('======================================================\n');

  // 1. Search DB for Lifecare or any VDAJ tenants
  const { rows: allTenants } = await query(
    `SELECT id, name, slug, phone_number_id, waba_id, meta_system_token
     FROM tenants
     ORDER BY created_at ASC`
  );

  console.log(`Found ${allTenants.length} tenant(s) in database:`);
  allTenants.forEach((t) => {
    console.log(` - [${t.slug}] "${t.name}" | Phone ID: ${t.phone_number_id || 'none'} | WABA ID: ${t.waba_id || 'none'}`);
  });

  const lifecareTenants = allTenants.filter(
    (t) =>
      t.name.toLowerCase().includes('lifecare') ||
      t.slug.toLowerCase().includes('lifecare') ||
      t.name.toLowerCase().includes('vdaj') ||
      t.slug.toLowerCase().includes('vdaj')
  );

  for (const t of lifecareTenants) {
    console.log(`\n──────────────────────────────────────────────────────`);
    console.log(`Workspace:   ${t.name} (${t.slug})`);
    console.log(`Phone ID:    ${t.phone_number_id}`);
    console.log(`WABA ID:     ${t.waba_id}`);

    const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;
    if (!token) {
      console.log('⚠️ No Meta access token available.');
      continue;
    }

    if (t.phone_number_id) {
      // Check phone details
      try {
        const pRes = await fetch(
          `https://graph.facebook.com/v21.0/${t.phone_number_id}?fields=display_phone_number,verified_name,name_status,status,quality_rating&access_token=${token}`
        );
        const pData = await pRes.json();
        console.log('\n📱 Phone Number Status:', JSON.stringify(pData, null, 2));
      } catch (e) {
        console.error('Error fetching phone status:', e.message);
      }

      // Check WhatsApp Business Profile (including profile_picture_url)
      try {
        const profRes = await fetch(
          `https://graph.facebook.com/v21.0/${t.phone_number_id}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical&access_token=${token}`
        );
        const profData = await profRes.json();
        console.log('\n🖼️ WhatsApp Business Profile (Live CDN):');
        console.log(JSON.stringify(profData, null, 2));

        if (profData?.data?.[0]?.profile_picture_url) {
          console.log(`\n✅ Current Profile Picture URL is present on Meta CDN:`);
          console.log(profData.data[0].profile_picture_url);
        } else {
          console.log('\n❌ NO profile_picture_url set on WhatsApp Business Profile for this phone number!');
        }
      } catch (e) {
        console.error('Error fetching business profile:', e.message);
      }
    }

    // If WABA ID exists, check phone numbers attached to WABA
    if (t.waba_id) {
      try {
        const wabaRes = await fetch(
          `https://graph.facebook.com/v21.0/${t.waba_id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status&access_token=${token}`
        );
        const wabaData = await wabaRes.json();
        console.log('\n☎️ Phone numbers under this WABA:');
        console.log(JSON.stringify(wabaData, null, 2));
      } catch (e) {}
    }
  }

  await pool.end();
  console.log('\n======================================================\n');
}

inspectLifecare().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
