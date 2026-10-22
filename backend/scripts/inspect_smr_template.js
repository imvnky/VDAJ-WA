'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function inspectTemplate() {
  console.log('\n=== INSPECTING SMR TEMPLATES & WABA LIMITS ===\n');

  const { rows: tenants } = await query(
    `SELECT id, name, phone_number_id, meta_system_token, meta_waba_id FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' LIMIT 1`
  );
  if (!tenants.length) {
    console.log('No SMR tenant found');
    await pool.end();
    return;
  }

  const tenant = tenants[0];
  const token = tenant.meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = tenant.phone_number_id;
  const wabaId = tenant.meta_waba_id;

  console.log(`Tenant: ${tenant.name}`);
  console.log(`Phone ID: ${phoneId}`);
  console.log(`WABA ID: ${wabaId}`);

  // 1. Check templates in local DB
  const { rows: dbTemplates } = await query(
    `SELECT id, name, language, status, meta_template_id, body_text FROM message_templates WHERE tenant_id = $1`,
    [tenant.id]
  );
  console.log('\nLocal DB Templates:');
  console.log(JSON.stringify(dbTemplates, null, 2));

  // 2. Query Meta for templates
  if (wabaId && token) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates?access_token=${token}`);
      const data = await res.json();
      console.log('\nMeta Cloud API Live Templates:');
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Error fetching Meta templates:', e.message);
    }
  }

  // 3. Check Phone Number details and Messaging Tier / Quality on Meta
  if (phoneId && token) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,throughput&access_token=${token}`
      );
      const data = await res.json();
      console.log('\nMeta Phone Status & Messaging Limit Tier:');
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Error fetching Phone details:', e.message);
    }
  }

  await pool.end();
}

inspectTemplate().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
