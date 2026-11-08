'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function main() {
  console.log('================================================================');
  console.log('🔍 SMR AUTOMATIONS INSPECTION');
  console.log('================================================================');

  const { rows: tenants } = await query(
    `SELECT id, name, slug FROM tenants WHERE slug ILIKE '%smr%' LIMIT 1`
  );
  if (!tenants.length) {
    console.log('❌ No SMR tenant found');
    await pool.end();
    return;
  }
  const tenant = tenants[0];
  console.log(`🏢 Workspace: ${tenant.name} (${tenant.slug}) [${tenant.id}]\n`);

  const { rows: automations } = await query(
    `SELECT id, name, trigger_type, trigger_config, steps, is_active, run_count, created_at, updated_at
     FROM automations
     WHERE tenant_id = $1
     ORDER BY updated_at DESC`,
    [tenant.id]
  );

  console.log(`Found ${automations.length} automations for SMR:`);
  automations.forEach((a, i) => {
    console.log(`\n[${i + 1}] ID: ${a.id} | Name: "${a.name}" | Status: ${a.is_active ? 'LIVE' : 'DRAFT'}`);
    console.log(`    Trigger: ${a.trigger_type} | Config:`, JSON.stringify(a.trigger_config));
    console.log(`    Created: ${a.created_at.toISOString()} | Updated: ${a.updated_at.toISOString()}`);
    console.log(`    Steps type:`, typeof a.steps, Array.isArray(a.steps) ? `Array(${a.steps.length})` : 'Object');
    console.log(`    Steps summary:`, JSON.stringify(a.steps).slice(0, 300) + '...');
  });

  console.log('\n================================================================');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});
