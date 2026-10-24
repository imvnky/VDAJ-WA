'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function subscribeWaba() {
  console.log('\n=== SUBSCRIBING WABA TO WEBHOOKS (REAL-TIME DELIVERY & STATUSES) ===\n');

  const { rows } = await query(
    `SELECT id, name, slug, phone_number_id, waba_id, meta_system_token
     FROM tenants
     WHERE slug ILIKE $1 OR name ILIKE $1
     LIMIT 1`,
    ['%smr%']
  );

  if (!rows.length) {
    console.error('No SMR tenant found in database.');
    await pool.end();
    return;
  }

  const t = rows[0];
  const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;
  const wabaId = t.waba_id || '1102225165878106';

  console.log(`Tenant: ${t.name} (${t.slug})`);
  console.log(`WABA ID: ${wabaId}`);
  console.log(`Phone ID: ${t.phone_number_id}`);

  // 1. Check existing subscribed apps
  try {
    const checkRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const checkData = await checkRes.json();
    console.log('\nCurrent Subscribed Apps:', JSON.stringify(checkData, null, 2));
  } catch (err) {
    console.warn('Could not query current subscribed apps:', err.message);
  }

  // 2. Subscribe WABA
  console.log('\nSubscribing WABA to webhook events...');
  try {
    const subRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const subData = await subRes.json();
    console.log('Result from Meta:', JSON.stringify(subData, null, 2));

    if (subData.success) {
      console.log('\n✅ SUCCESS: WABA is now officially subscribed to all real-time delivery status webhooks (sent, delivered, read)!');
    } else {
      console.log('\n⚠️ Notice:', subData);
    }
  } catch (err) {
    console.error('Error subscribing WABA:', err.message);
  }

  await pool.end();
}

subscribeWaba().catch(async (err) => {
  console.error('Script failure:', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
