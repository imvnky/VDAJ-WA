'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function compareTenants() {
  console.log('\n=== COMPARING ALL TENANTS META DETAILS ===\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, phone_number_id, waba_id, meta_system_token FROM tenants`
  );

  for (const t of tenants) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Tenant: ${t.name} (slug: ${t.slug})`);
    console.log(`Phone ID: ${t.phone_number_id} | WABA ID: ${t.waba_id}`);
    const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;

    if (t.phone_number_id && token) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${t.phone_number_id}?fields=display_phone_number,verified_name,name_status,status,quality_rating,code_verification_status&access_token=${token}`
        );
        const data = await res.json();
        console.log('Phone details:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('Phone fetch error:', e.message);
      }
    }

    if (t.waba_id && token) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${t.waba_id}?fields=id,name,account_review_status,business_verification_status&access_token=${token}`
        );
        const data = await res.json();
        console.log('WABA details:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('WABA fetch error:', e.message);
      }
    }
  }

  await pool.end();
}

compareTenants().catch(async e => {
  console.error(e);
  try { await pool.end(); } catch {}
});
