/**
 * VDAJ Services — Subscribe SMR WABA to Webhooks
 * ─────────────────────────────────────────────────────────────
 * Meta Cloud API requires each WABA to explicitly register with
 * the app via POST /{waba_id}/subscribed_apps so that real-world
 * inbound customer messages and delivery receipts are routed to
 * our webhook endpoint.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function subscribeWABA() {
  console.log('\n======================================================');
  console.log('🔗 SUBSCRIBING SMR WABA TO WEBHOOKS');
  console.log('======================================================\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, waba_id, phone_number_id, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%'
     LIMIT 1`
  );

  if (!tenants.length) {
    console.error('❌ Error: SMR tenant not found in database.');
    process.exit(1);
  }

  const t = tenants[0];
  const wabaId = t.waba_id || process.env.META_WABA_ID || '1102225165878106';
  const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;

  if (!token) {
    console.error('❌ Error: No Meta access token found.');
    process.exit(1);
  }

  console.log(`Workspace: ${t.name}`);
  console.log(`WABA ID:   ${wabaId}\n`);

  // 1. Check existing subscriptions
  try {
    const checkRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps?access_token=${token}`);
    const checkData = await checkRes.json();
    console.log('Current Subscribed Apps:', JSON.stringify(checkData));
  } catch (err) {
    console.warn('Could not inspect current subscriptions:', err.message);
  }

  // 2. Subscribe WABA to this App
  console.log('\nRegistering webhook subscription on Meta Graph API...');
  const subRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const subData = await subRes.json();
  console.log('Meta Subscription Response:', subData);

  if (subData?.success) {
    console.log('\n✅ SUCCESS: SMR WABA is now actively subscribed to Webhooks!');
    console.log('Inbound WhatsApp messages will now arrive directly in your Inbox.');
  } else {
    console.log('\nNote on response:', subData);
  }

  await pool.end();
}

subscribeWABA().catch((err) => {
  console.error('❌ Subscription failed:', err);
  process.exit(1);
});
