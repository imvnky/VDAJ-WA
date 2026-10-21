'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function inspect() {
  const { rows } = await query(
    `SELECT phone_number_id, meta_system_token FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' LIMIT 1`
  );
  if (!rows.length) {
    console.log('No SMR tenant found');
    await pool.end();
    return;
  }
  const token = rows[0].meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = rows[0].phone_number_id;

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status,status,quality_rating&access_token=${token}`
  );
  const data = await res.json();
  console.log('\n--- LIVE META API RESPONSE ---');
  console.log(JSON.stringify(data, null, 2));
  console.log('------------------------------\n');
  await pool.end();
}

inspect().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
