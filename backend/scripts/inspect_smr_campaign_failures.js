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
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function auditTenant(tenant) {
  console.log(`\n================================================================`);
  console.log(`🏢 TENANT: ${tenant.name} (${tenant.slug})`);
  console.log(`   ID: ${tenant.id}`);
  console.log(`   Phone Number ID: ${tenant.phone_number_id}`);
  console.log(`   Display Phone: ${tenant.display_phone_number}`);
  console.log(`   WABA ID: ${tenant.waba_id}`);
  console.log(`   Stored Tier: ${tenant.messaging_tier} | Quality: ${tenant.quality_rating}`);
  console.log(`================================================================`);

  // Live Meta status check
  const token = tenant.meta_system_token || process.env.META_ACCESS_TOKEN;
  if (tenant.phone_number_id && token) {
    try {
      const metaRes = await fetchJson(
        `https://graph.facebook.com/v21.0/${tenant.phone_number_id}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,messaging_limit_tier`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (metaRes.status === 200) {
        console.log(`📡 Live Meta API Status:`);
        console.log(`   Display Phone: ${metaRes.data.display_phone_number}`);
        console.log(`   Verified Name: ${metaRes.data.verified_name}`);
        console.log(`   Quality: ${metaRes.data.quality_rating}`);
        console.log(`   Messaging Limit Tier: ${metaRes.data.messaging_limit_tier}`);
        if (metaRes.data.messaging_limit_tier === 'TIER_250') {
          console.log(`   ⚠️ WARNING: TIER_250 allows MAX 250 business-initiated conversations per rolling 24h!`);
        }
      } else {
        console.log(`   ⚠️ Meta API check returned (${metaRes.status}):`, JSON.stringify(metaRes.data));
      }
    } catch (e) {
      console.log(`   ⚠️ Could not reach Meta: ${e.message}`);
    }
  }

  // Fetch campaigns
  const { rows: campaigns } = await query(
    `SELECT c.id, c.name, c.status, c.total_count, c.sent_count, c.delivered_count,
            c.read_count, c.failed_count, c.dead_letter_count, c.created_at, c.completed_at,
            mt.name AS template_name
     FROM campaigns c
     LEFT JOIN message_templates mt ON mt.id = c.template_id
     WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
     ORDER BY c.created_at DESC`,
    [tenant.id]
  );

  console.log(`\n📋 Found ${campaigns.length} campaigns for this tenant:`);
  if (!campaigns.length) {
    console.log('   (No campaigns created yet for this tenant)');
    
    // Check if there are any campaigns in the entire DB
    const { rows: allCamps } = await query(
      `SELECT c.id, c.name, c.tenant_id, t.name as tenant_name, c.status, c.total_count, c.sent_count, c.failed_count
       FROM campaigns c
       JOIN tenants t ON t.id = c.tenant_id
       ORDER BY c.created_at DESC LIMIT 5`
    );
    if (allCamps.length) {
      console.log(`   ℹ️ Other campaigns in DB (${allCamps.length}):`);
      allCamps.forEach(ac => console.log(`      • [${ac.tenant_name}] "${ac.name}" (${ac.id}) - Status: ${ac.status}, Total: ${ac.total_count}, Failed: ${ac.failed_count}`));
    }
    return;
  }

  for (const [idx, c] of campaigns.entries()) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`[Campaign ${idx + 1}] "${c.name}" (ID: ${c.id})`);
    console.log(`   Status: ${c.status} | Template: ${c.template_name || 'N/A'}`);
    console.log(`   Created: ${c.created_at ? new Date(c.created_at).toLocaleString() : 'N/A'} | Completed: ${c.completed_at ? new Date(c.completed_at).toLocaleString() : 'N/A'}`);
    console.log(`   Campaign Row Counts: Total: ${c.total_count} | Sent: ${c.sent_count} | Delivered: ${c.delivered_count} | Read: ${c.read_count} | Failed: ${c.failed_count} | Dead-Letter: ${c.dead_letter_count}`);

    // Query actual status counts in campaign_messages
    const { rows: msgStats } = await query(
      `SELECT status, COUNT(*)::int AS count
       FROM campaign_messages
       WHERE campaign_id = $1
       GROUP BY status
       ORDER BY count DESC`,
      [c.id]
    );

    console.log(`   📊 Messages Breakdown in DB:`, msgStats.map(s => `${s.status}: ${s.count}`).join(' | '));

    const totalMsgs = msgStats.reduce((acc, row) => acc + row.count, 0);
    const delivered = msgStats.filter(s => s.status === 'delivered' || s.status === 'read').reduce((acc, r) => acc + r.count, 0);
    const failed = msgStats.filter(s => s.status === 'failed' || s.status === 'dead_letter').reduce((acc, r) => acc + r.count, 0);
    const sent = msgStats.filter(s => s.status === 'sent').reduce((acc, r) => acc + r.count, 0);

    if (totalMsgs > 0) {
      console.log(`   📈 Rates: Delivered/Read: ${delivered}/${totalMsgs} (${((delivered/totalMsgs)*100).toFixed(1)}%) | Failed: ${failed}/${totalMsgs} (${((failed/totalMsgs)*100).toFixed(1)}%) | Sent (Awaiting webhook): ${sent}/${totalMsgs} (${((sent/totalMsgs)*100).toFixed(1)}%)`);
    }

    // Failures breakdown
    const { rows: reasons } = await query(
      `SELECT error_code, last_error, COUNT(*)::int AS count
       FROM campaign_messages
       WHERE campaign_id = $1 AND status IN ('failed', 'dead_letter')
       GROUP BY error_code, last_error
       ORDER BY count DESC`,
      [c.id]
    );

    if (reasons.length > 0) {
      console.log(`   ❌ Failure Reasons Breakdown:`);
      reasons.forEach(r => {
        console.log(`      • [${r.error_code || 'NO_CODE'}] "${r.last_error || 'No description'}": ${r.count} recipients`);
      });
    }

    // Sample 5 failed recipients
    const { rows: failedRecipients } = await query(
      `SELECT cm.phone_e164, cm.status, cm.error_code, cm.last_error, cm.sent_at, cm.failed_at,
              c.first_name, c.last_name
       FROM campaign_messages cm
       LEFT JOIN contacts c ON c.id = cm.contact_id
       WHERE cm.campaign_id = $1 AND cm.status IN ('failed', 'dead_letter')
       ORDER BY cm.updated_at DESC
       LIMIT 5`,
      [c.id]
    );

    if (failedRecipients.length > 0) {
      console.log(`   🔎 Sample Failed Contacts:`);
      failedRecipients.forEach((f, i) => {
        console.log(`      ${i + 1}. ${f.phone_e164} (${f.first_name || ''} ${f.last_name || ''}) -> Error [${f.error_code}]: ${f.last_error}`);
      });
    }

    // Sample 5 delivered recipients
    const { rows: deliveredRecipients } = await query(
      `SELECT cm.phone_e164, cm.status, cm.delivered_at, cm.read_at,
              c.first_name, c.last_name
       FROM campaign_messages cm
       LEFT JOIN contacts c ON c.id = cm.contact_id
       WHERE cm.campaign_id = $1 AND cm.status IN ('delivered', 'read')
       ORDER BY cm.updated_at DESC
       LIMIT 5`,
      [c.id]
    );

    if (deliveredRecipients.length > 0) {
      console.log(`   ✅ Sample Delivered Contacts:`);
      deliveredRecipients.forEach((d, i) => {
        console.log(`      ${i + 1}. ${d.phone_e164} (${d.first_name || ''} ${d.last_name || ''}) -> Status: ${d.status}`);
      });
    }
  }
}

async function main() {
  console.log('================================================================');
  console.log('🔍 SMR CAMPAIGN DELIVERY FAILURE AUDIT');
  console.log('================================================================');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, phone_number_id, waba_id, display_phone_number,
            messaging_tier, quality_rating, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%'
     ORDER BY updated_at DESC`
  );

  console.log(`Found ${tenants.length} tenants matching "smr".`);

  for (const t of tenants) {
    await auditTenant(t);
  }

  // Check recent Webhook failure events across all SMR tenants
  const tenantIds = tenants.map(t => t.id);
  if (tenantIds.length > 0) {
    console.log(`\n================================================================`);
    console.log(`🔍 RECENT META WEBHOOK STATUS / FAILURE EVENTS IN DB`);
    console.log(`================================================================`);
    const { rows: webhookEvents } = await query(
      `SELECT event_type, meta_message_id, raw_payload, created_at
       FROM webhook_events
       WHERE tenant_id = ANY($1) AND (event_type = 'message_failed' OR raw_payload::text ILIKE '%error%')
       ORDER BY created_at DESC
       LIMIT 5`,
      [tenantIds]
    ).catch(() => ({ rows: [] }));

    if (webhookEvents.length > 0) {
      webhookEvents.forEach((w, i) => {
        console.log(`\n[${i + 1}] Event: ${w.event_type} | Time: ${w.created_at}`);
        console.log(`    Payload:`, JSON.stringify(w.raw_payload, null, 2));
      });
    } else {
      console.log('No webhook failure events found in webhook_events.');
    }
  }

  console.log('\n================================================================\n');
  await pool.end();
}

main().catch(async (e) => {
  console.error('Fatal error during audit:', e);
  try { await pool.end(); } catch {}
});
