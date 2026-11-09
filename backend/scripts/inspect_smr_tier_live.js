'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const https = require('https');
const { query, pool } = require('../src/config/database');

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('================================================================');
  console.log('🔍 LIVE META WABA MESSAGING TIER & QUOTA INSPECTOR');
  console.log('================================================================\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, phone_number_id, waba_id, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%' LIMIT 1`
  );

  if (!tenants.length) {
    console.log('No SMR tenant');
    await pool.end();
    return;
  }

  const t = tenants[0];
  const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;

  // 1. Phone number details
  const phoneRes = await fetchJson(
    `https://graph.facebook.com/v21.0/${t.phone_number_id}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,messaging_limit_tier,throughput`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log('📞 Phone Details from Meta:');
  console.log(JSON.stringify(phoneRes.data, null, 2));

  // 2. WABA details
  if (t.waba_id) {
    const wabaRes = await fetchJson(
      `https://graph.facebook.com/v21.0/${t.waba_id}?fields=name,currency,timezone_id,account_review_status,business_verification_status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('\n💼 WABA Details from Meta:');
    console.log(JSON.stringify(wabaRes.data, null, 2));
  }

  console.log('\n================================================================\n');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
