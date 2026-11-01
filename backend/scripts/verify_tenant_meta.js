'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function verify() {
  console.log('\n================================================================');
  console.log('🔍 META WABA & WHATSAPP CONNECTION HEALTH AUDIT');
  console.log('================================================================\n');

  // 1. Fetch latest tenant from DB
  const { rows: tenants } = await query(
    `SELECT id, name, slug, waba_id, phone_number_id, display_phone_number, verified_name, 
            meta_system_token, quality_rating, messaging_tier, is_active
     FROM tenants
     ORDER BY updated_at DESC LIMIT 5`
  );

  if (!tenants.length) {
    console.log('❌ No tenants found in database.');
    await pool.end();
    return;
  }

  for (const t of tenants) {
    console.log(`────────────────────────────────────────────────────────────────`);
    console.log(`🏢 Workspace:        ${t.name} (${t.slug})`);
    console.log(`📞 Display Phone:   ${t.display_phone_number || 'Not set'}`);
    console.log(`🆔 Phone Number ID: ${t.phone_number_id || 'Not set'}`);
    console.log(`💼 WABA ID:         ${t.waba_id || 'Not set'}`);
    console.log(`🔑 Token configured: ${t.meta_system_token ? 'YES (' + t.meta_system_token.slice(0, 10) + '...)' : 'NO'}`);

    const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;
    const phoneId = t.phone_number_id;
    const wabaId = t.waba_id;

    if (!phoneId || !token) {
      console.log('⚠️ Missing Phone Number ID or Token. Skipping Meta live test.\n');
      continue;
    }

    // 2. Query Meta Graph API for Phone Number Health
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,status,quality_rating,messaging_limit_tier&access_token=${token}`
      );
      const data = await res.json();
      if (data.error) {
        console.log(`❌ Meta Phone API Error: ${data.error.message} (Code: ${data.error.code})`);
      } else {
        console.log(`✅ LIVE META STATUS:`);
        console.log(`   - Verified Name:    ${data.verified_name} (${data.name_status})`);
        console.log(`   - Phone on Meta:    ${data.display_phone_number}`);
        console.log(`   - Quality Rating:   ${data.quality_rating}`);
        console.log(`   - Messaging Tier:   ${data.messaging_limit_tier || 'Tier 1'}`);
        console.log(`   - Account Status:   ${data.status}`);
      }
    } catch (err) {
      console.log(`❌ Network error reaching Meta: ${err.message}`);
    }

    // 3. Query WABA Templates on Meta
    if (wabaId && token) {
      try {
        const tplRes = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,status,language&limit=10&access_token=${token}`
        );
        const tplData = await tplRes.json();
        if (tplData?.data) {
          console.log(`\n📋 Meta Templates Found: ${tplData.data.length}`);
          tplData.data.slice(0, 5).forEach((tp) => {
            console.log(`   - [${tp.status}] ${tp.name} (${tp.language})`);
          });
        }
      } catch (err) {
        console.log(`⚠️ Template check error: ${err.message}`);
      }

      // 4. Check Webhook Subscribed Apps
      try {
        const subRes = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps?access_token=${token}`
        );
        const subData = await subRes.json();
        const isSubscribed = Boolean(subData?.data?.length);
        console.log(`\n🔗 Inbound Webhook Routing: ${isSubscribed ? '✅ SUBSCRIBED' : '⚠️ NOT SUBSCRIBED YET'}`);
      } catch (err) {}
    }
    console.log(`────────────────────────────────────────────────────────────────\n`);
  }

  await pool.end();
}

verify().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
