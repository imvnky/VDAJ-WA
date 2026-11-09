'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function main() {
  console.log('================================================================');
  console.log('🔍 AUTOMATIONS AUDIT & LIVE SYNC');
  console.log('================================================================');

  const { rows: automations } = await query(`
    SELECT a.id, a.tenant_id, t.name as tenant_name, a.name, a.trigger_type, a.trigger_config, 
           a.is_active, a.run_count, a.steps, a.created_at, a.updated_at
    FROM automations a
    JOIN tenants t ON t.id = a.tenant_id
    ORDER BY a.updated_at DESC
  `);

  console.log(`Found ${automations.length} total automations in database.\n`);

  for (const a of automations) {
    console.log(`----------------------------------------------------------------`);
    console.log(`ID: ${a.id}`);
    console.log(`Tenant: ${a.tenant_name} (${a.tenant_id})`);
    console.log(`Name: "${a.name}" | Status: ${a.is_active ? '✅ LIVE (is_active=true)' : '⏸ DRAFT (is_active=false)'}`);
    console.log(`Trigger: ${a.trigger_type} | Config: ${JSON.stringify(a.trigger_config)}`);
    console.log(`Updated At: ${a.updated_at.toISOString()}`);

    const stepsStr = JSON.stringify(a.steps);
    const hasThankYou = stepsStr.includes('Thank you for reaching out') || stepsStr.includes('SMR GYM TIMINGS');
    if (hasThankYou) {
      console.log(`⚠️  CONTAINS OLD BOT COPY ("Thank you for reaching out" / "SMR GYM TIMINGS")`);
    }
    const hasSwimming = stepsStr.includes('Swimming details') || stepsStr.includes('Choose an activity');
    if (hasSwimming) {
      console.log(`✨ CONTAINS NEW SPEC FLOW ("Choose an activity" / Swimming, Gym, Badminton details)`);
    }

    if (Array.isArray(a.steps)) {
      console.log(`Steps format: Array of ${a.steps.length} items`);
    } else if (a.steps?.nodes) {
      console.log(`Steps format: Object with ${a.steps.nodes.length} nodes, ${a.steps.edges.length} edges`);
    }
  }

  // Auto-sync SMR tenant flow
  const { rows: smrTenants } = await query(`SELECT id, name FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%'`);
  for (const t of smrTenants) {
    console.log(`\n🔧 Synchronizing live flow for tenant "${t.name}" (${t.id})...`);

    // 1. Deactivate old/stale automations
    const deactRes = await query(`
      UPDATE automations
      SET is_active = false, updated_at = NOW()
      WHERE tenant_id = $1 AND (
        steps::text ILIKE '%Thank you for reaching out%' OR
        steps::text ILIKE '%SMR GYM TIMINGS%' OR
        steps::text ILIKE '%Swimming Pool Enquir%'
      )
    `, [t.id]);
    if (deactRes.rowCount > 0) {
      console.log(`   Deactivated ${deactRes.rowCount} stale legacy automation(s).`);
    }

    // 2. Check if the new Registration enquiry flow exists
    const { rows: newFlows } = await query(`
      SELECT id, name, is_active FROM automations
      WHERE tenant_id = $1 AND (name ILIKE '%Registration%' OR steps::text ILIKE '%Choose an activity%')
      ORDER BY updated_at DESC
      LIMIT 1
    `, [t.id]);

    if (newFlows.length > 0) {
      // Activate the latest one
      await query(`
        UPDATE automations
        SET is_active = true, updated_at = NOW()
        WHERE id = $1
      `, [newFlows[0].id]);
      console.log(`   Activated existing new flow "${newFlows[0].name}" (${newFlows[0].id}).`);
    } else {
      // Create and activate the new flow
      const defaultSteps = {
        nodes: [
          {
            id: 'n1',
            type: 'trigger',
            position: { x: 440, y: 40 },
            data: { label: 'Incoming message', config: { triggerType: 'keyword', keywords: ['Hi', 'Hello', 'Enquiry'] } },
          },
          {
            id: 'n2',
            type: 'question',
            position: { x: 410, y: 190 },
            data: {
              label: 'Choose an activity',
              config: {
                body: 'Hi! What would you like to know about?',
                buttons: [
                  { label: 'Swimming', value: 'swimming' },
                  { label: 'Gym', value: 'gym' },
                  { label: 'Badminton', value: 'badminton' },
                ],
                hasTimeout: true,
              },
            },
          },
          {
            id: 'n3',
            type: 'message',
            position: { x: 170, y: 450 },
            data: {
              label: 'Swimming details',
              config: { messageType: 'text', body: 'Our swimming pool is open daily from 6:00 AM to 10:00 AM and 4:00 PM to 8:00 PM.' },
            },
          },
          {
            id: 'n4',
            type: 'message',
            position: { x: 460, y: 450 },
            data: {
              label: 'Gym details',
              config: { messageType: 'text', body: 'Our gym is open daily from 6:00 AM to 10:00 AM and 4:00 PM to 8:00 PM.' },
            },
          },
          {
            id: 'n5',
            type: 'message',
            position: { x: 750, y: 450 },
            data: {
              label: 'Badminton details',
              config: { messageType: 'text', body: 'Our badminton courts are open daily from 6:00 AM to 10:00 AM and 4:00 PM to 9:00 PM.' },
            },
          },
          { id: 'n6', type: 'end', position: { x: 250, y: 640 }, data: { label: 'End' } },
          { id: 'n7', type: 'end', position: { x: 540, y: 640 }, data: { label: 'End' } },
          { id: 'n8', type: 'end', position: { x: 830, y: 640 }, data: { label: 'End' } },
          { id: 'n9', type: 'end', position: { x: 970, y: 530 }, data: { label: 'End flow' } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', type: 'custom' },
          { id: 'e2', source: 'n2', sourceHandle: 'btn_0', target: 'n3', label: 'Swimming', type: 'custom' },
          { id: 'e3', source: 'n2', sourceHandle: 'btn_1', target: 'n4', label: 'Gym', type: 'custom' },
          { id: 'e4', source: 'n2', sourceHandle: 'btn_2', target: 'n5', label: 'Badminton', type: 'custom' },
          { id: 'e5', source: 'n2', sourceHandle: 'timeout', target: 'n9', label: 'No response - 24h', type: 'custom' },
          { id: 'e6', source: 'n3', target: 'n6', type: 'custom' },
          { id: 'e7', source: 'n4', target: 'n7', type: 'custom' },
          { id: 'e8', source: 'n5', target: 'n8', type: 'custom' },
        ],
      };

      const { rows: [created] } = await query(`
        INSERT INTO automations (tenant_id, name, trigger_type, trigger_config, steps, is_active)
        VALUES ($1, 'Registration enquiry', 'keyword', $2::jsonb, $3::jsonb, true)
        RETURNING id, name
      `, [t.id, JSON.stringify({ keywords: ['Hi', 'Hello', 'Enquiry'] }), JSON.stringify(defaultSteps)]);
      console.log(`   Created and activated new spec flow "${created.name}" (${created.id}).`);
    }
  }

  console.log('================================================================');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Error during audit:', err);
  try { await pool.end(); } catch { }
});

