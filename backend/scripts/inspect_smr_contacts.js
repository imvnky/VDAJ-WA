'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function inspect() {
  const { rows: tenants } = await query(
    `SELECT id, name FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' LIMIT 1`
  );
  if (!tenants.length) {
    console.log('No SMR tenant found');
    await pool.end();
    return;
  }
  const tenantId = tenants[0].id;
  console.log('Tenant:', tenants[0].name, tenantId);

  // Sample 10 contacts from SMR
  const { rows: contacts } = await query(
    `SELECT id, first_name, last_name, phone_e164, tags, custom_vars, created_at
     FROM contacts
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [tenantId]
  );

  console.log(`\nSample contacts from SMR (${contacts.length}):`);
  contacts.forEach((c, idx) => {
    console.log(`[${idx + 1}] Name: ${c.first_name} ${c.last_name || ''} | Phone: ${c.phone_e164}`);
    console.log(`     Tags:`, c.tags);
    console.log(`     Custom Vars:`, JSON.stringify(c.custom_vars));
  });

  // Also check distinct keys in custom_vars across all SMR contacts
  const { rows: keys } = await query(
    `SELECT DISTINCT jsonb_object_keys(custom_vars) AS key
     FROM contacts
     WHERE tenant_id = $1 AND custom_vars IS NOT NULL`,
    [tenantId]
  );
  console.log('\nAll distinct custom_vars keys across SMR contacts:', keys.map(k => k.key));

  // Also check campaign_messages template_vars
  const { rows: campMsgs } = await query(
    `SELECT cm.phone_e164, cm.template_vars
     FROM campaign_messages cm
     JOIN campaigns c ON c.id = cm.campaign_id
     WHERE c.tenant_id = $1
     LIMIT 5`,
    [tenantId]
  );
  console.log('\nSample campaign_messages vars:');
  campMsgs.forEach((cm, idx) => {
    console.log(`[${idx + 1}] ${cm.phone_e164} -> template_vars:`, JSON.stringify(cm.template_vars));
  });

  await pool.end();
}

inspect().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
