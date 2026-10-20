/**
 * Compare VDAJ Services vs SMR Meta configuration
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function compare() {
  console.log('\n======================================================');
  console.log('🔍 COMPARING VDAJ SERVICES VS SMR META STATUS');
  console.log('======================================================\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, phone_number_id, meta_system_token, verified_name
     FROM tenants
     ORDER BY created_at ASC`
  );

  for (const t of tenants) {
    console.log(`\n──────────────────────────────────────────────────────`);
    console.log(`Workspace: ${t.name} (${t.slug})`);
    console.log(`Phone ID:  ${t.phone_number_id}`);
    const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;

    if (t.phone_number_id && token) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${t.phone_number_id}?fields=display_phone_number,verified_name,name_status,status,quality_rating,is_official_business_account&access_token=${token}`
        );
        const data = await res.json();
        console.log('Meta Details:', JSON.stringify(data, null, 2));
      } catch (err) {
        console.error('Error fetching Meta details:', err.message);
      }
    } else {
      console.log('No phone ID or token configured.');
    }
  }

  await pool.end();
}

compare().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
