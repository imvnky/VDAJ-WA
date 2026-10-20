/**
 * Inspect SMR Meta Display Name Status & Templates
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function inspect() {
  console.log('\n======================================================');
  console.log('🔍 SMR META STATUS & TEMPLATE AUDIT');
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
  const wabaId = t.waba_id;

  // 1. Check Display Name Status on Phone Number
  console.log('📱 1. DISPLAY NAME STATUS:');
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status,quality_rating,status&access_token=${token}`
    );
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error checking name:', err.message);
  }

  // 2. Check Templates on WABA
  console.log('\n📄 2. TEMPLATES CURRENTLY ON META:');
  try {
    const tRes = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,status,language,category,id&limit=50&access_token=${token}`
    );
    const tData = await tRes.json();
    if (tData?.data) {
      console.log(`Found ${tData.data.length} templates on Meta:`);
      tData.data.forEach((tpl) => {
        console.log(`  - [${tpl.status}] "${tpl.name}" (${tpl.language}) [ID: ${tpl.id}]`);
      });
    } else {
      console.log(JSON.stringify(tData, null, 2));
    }
  } catch (err) {
    console.error('Error checking templates:', err.message);
  }

  await pool.end();
}

inspect().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
