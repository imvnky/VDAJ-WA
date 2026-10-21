'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function check() {
  const { rows } = await query(
    `SELECT waba_id, meta_system_token FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' LIMIT 1`
  );
  if (!rows.length) {
    console.log('No SMR tenant');
    await pool.end();
    return;
  }
  const token = rows[0].meta_system_token || process.env.META_ACCESS_TOKEN;
  const wabaId = rows[0].waba_id;

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${wabaId}?fields=id,name,account_review_status,business_verification_status,primary_funding_id,timezone_id&access_token=${token}`
  );
  const data = await res.json();
  console.log('--- WABA VERIFICATION STATUS ---');
  console.log(JSON.stringify(data, null, 2));
  console.log('--------------------------------');
  await pool.end();
}

check().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
