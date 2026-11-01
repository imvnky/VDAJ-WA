'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const slug = getArg('slug') || 'perfect-travels';
  const wabaId = getArg('waba') || '5443753085763554';
  const phoneId = getArg('phone') || '1470208946166204';
  const token = getArg('token') || 'EAAeH1HyBQV4BS0JKIx0QbVIO2wM0MpqWsl6aRNOW330Y39P7FIhDzWkvublmLdsSiZAZBlx3cdgSCZB2hZB43BwkouiJtUdkV34OPcIpUbHYUtCtvpZCWZBwDGZAL1olmD356ia36tB1Mn9fDXrPVOaBmIejo744tsc6ipAZBTZCXZCZA9DFec9sTNxd8F1KplqXQZDZD';

  console.log(`\n================================================================`);
  console.log(`🔧 UPDATING TENANT CREDENTIALS FOR: ${slug}`);
  console.log(`================================================================`);
  console.log(`WABA ID:         ${wabaId}`);
  console.log(`Phone Number ID: ${phoneId}`);
  console.log(`Token Prefix:    ${token.slice(0, 15)}... (Length: ${token.length})`);

  // 1. Verify token with Meta Graph API first
  console.log(`\n⏳ Validating with Meta Graph API...`);
  try {
    const phoneRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,status,quality_rating,messaging_limit_tier&access_token=${token}`
    );
    const phoneData = await phoneRes.json();

    if (phoneData.error) {
      console.error(`❌ Meta API Error: ${phoneData.error.message} (Code: ${phoneData.error.code})`);
      process.exit(1);
    }

    console.log(`✅ Meta Phone Verified!`);
    console.log(`   - Verified Name:  ${phoneData.verified_name} (${phoneData.name_status})`);
    console.log(`   - Display Phone:  ${phoneData.display_phone_number}`);
    console.log(`   - Quality Rating: ${phoneData.quality_rating}`);
    console.log(`   - Messaging Tier: ${phoneData.messaging_limit_tier}`);
    console.log(`   - Account Status: ${phoneData.status}`);

    // 2. Subscribe WABA to Webhook Apps
    console.log(`\n⏳ Subscribing WABA to Webhook routing...`);
    const subRes = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps?access_token=${token}`,
      { method: 'POST' }
    );
    const subData = await subRes.json();
    if (subData.success) {
      console.log(`✅ Successfully subscribed WABA (${wabaId}) to Webhooks!`);
    } else {
      console.log(`ℹ️ Webhook subscription response:`, subData);
    }

    // 3. Update in PostgreSQL
    const displayPhone = phoneData.display_phone_number || '+91 91850 13345';
    const verifiedName = phoneData.verified_name || 'Perfect Travels';
    const quality = phoneData.quality_rating && phoneData.quality_rating !== 'UNKNOWN' ? phoneData.quality_rating : 'GREEN';

    const updateRes = await query(
      `UPDATE tenants
       SET waba_id = $1,
           phone_number_id = $2,
           meta_system_token = $3,
           display_phone_number = $4,
           verified_name = $5,
           quality_rating = $6,
           waba_health_synced_at = NOW(),
           updated_at = NOW()
       WHERE slug = $7 OR id::text = $7
       RETURNING id, name, slug, waba_id, phone_number_id, display_phone_number`,
      [wabaId, phoneId, token, displayPhone, verifiedName, quality, slug]
    );

    if (updateRes.rows.length === 0) {
      console.error(`❌ Tenant with slug '${slug}' not found in database.`);
    } else {
      console.log(`\n🎉 Tenant '${updateRes.rows[0].name}' updated successfully in Database!`);
      console.log(updateRes.rows[0]);
    }

  } catch (err) {
    console.error(`❌ Error during setup:`, err.message);
  } finally {
    await pool.end();
  }
}

main().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
