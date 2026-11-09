'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');
const { sendWhatsAppMessage } = require('../src/services/metaApiService');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('================================================================');
  console.log('🚀 SMR SAFE RETRY DISPATCHER (RATE-LIMITED CONTACTS)');
  console.log('================================================================\n');

  // 1. Fetch SMR Tenant
  const { rows: tenants } = await query(
    `SELECT id, name, slug, phone_number_id, waba_id, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%'
     LIMIT 1`
  );

  if (!tenants.length) {
    console.log('❌ No SMR tenant found in database.');
    await pool.end();
    return;
  }

  const tenant = tenants[0];
  console.log(`🏢 Workspace: ${tenant.name} (${tenant.slug})`);
  console.log(`📞 Phone Number ID: ${tenant.phone_number_id}`);

  // 2. Fetch diwali_first campaign
  const { rows: campaigns } = await query(
    `SELECT c.*, mt.name AS template_name, mt.language AS template_language,
            mt.body_text AS template_body, mt.buttons AS template_buttons,
            mt.footer_text AS template_footer, mt.header_text AS template_header,
            mt.header_sample_url AS template_header_url
     FROM campaigns c
     JOIN message_templates mt ON mt.id = c.template_id
     WHERE c.tenant_id = $1 AND c.name ILIKE '%diwali%' AND c.deleted_at IS NULL
     ORDER BY c.created_at DESC
     LIMIT 1`,
    [tenant.id]
  );

  if (!campaigns.length) {
    console.log('❌ No Diwali campaign found for SMR.');
    await pool.end();
    return;
  }

  const campaign = campaigns[0];
  console.log(`📋 Campaign: "${campaign.name}" (ID: ${campaign.id})`);
  console.log(`📑 Template: ${campaign.template_name} (${campaign.template_language})`);

  // 3. Find only contacts that failed due to Rate Limit (130429)
  const { rows: rateLimitedMessages } = await query(
    `SELECT cm.id, cm.phone_e164, cm.template_vars, cm.status, cm.error_code, cm.last_error,
            COALESCE(c.first_name, '') AS first_name,
            COALESCE(c.last_name, '') AS last_name
     FROM campaign_messages cm
     LEFT JOIN contacts c ON c.id = cm.contact_id
     WHERE cm.campaign_id = $1
       AND (cm.error_code = '130429' OR cm.last_error ILIKE '%rate limit%')
     ORDER BY cm.created_at ASC`,
    [campaign.id]
  );

  console.log(`\n🎯 Found ${rateLimitedMessages.length} contacts that failed due to Meta Rate Limit (130429).`);
  if (!rateLimitedMessages.length) {
    console.log('✅ No rate-limited messages remaining to retry.');
    await pool.end();
    return;
  }

  console.log('⚡ Starting safe sequential dispatch at 400ms interval (~2.5 msg/sec) with automatic backoff...\n');

  // Mark campaign as running
  await query(
    `UPDATE campaigns
     SET status = 'running', updated_at = NOW()
     WHERE id = $1`,
    [campaign.id]
  );

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rateLimitedMessages.length; i++) {
    const msg = rateLimitedMessages[i];
    const recipientName = (
      msg.first_name ? `${msg.first_name} ${msg.last_name}`.trim() :
      msg.template_vars?.contact_name || msg.template_vars?.name || 'Customer'
    );

    const resolvedVars = {
      headerUrl: campaign.header_url || campaign.template_header_url,
      headerType: (campaign.header_url || campaign.template_header_url) ? 'IMAGE' : undefined,
      ...(campaign.template_vars || {}),
      ...(msg.template_vars || {}),
    };
    if (!resolvedVars['1'] || resolvedVars['1'] === '{{name}}' || resolvedVars['1'] === '{{contact_name}}') {
      resolvedVars['1'] = recipientName;
    }

    let metaResponse = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        metaResponse = await sendWhatsAppMessage({
          phoneNumberId: tenant.phone_number_id,
          accessToken: tenant.meta_system_token,
          to: msg.phone_e164,
          templateName: campaign.template_name,
          templateLanguage: campaign.template_language,
          templateVars: resolvedVars,
        });
        break; // Success!
      } catch (err) {
        const isRateLimit = err.isRateLimit || err.statusCode === 429 ||
          (err.message && (err.message.includes('130429') || err.message.toLowerCase().includes('rate limit')));

        if (isRateLimit && attempts < MAX_ATTEMPTS) {
          const waitTime = attempts * 3000;
          console.log(`   ⏳ Rate limit on ${msg.phone_e164}. Backing off for ${waitTime}ms before retry ${attempts}/${MAX_ATTEMPTS}...`);
          await sleep(waitTime);
          continue;
        }

        console.log(`   ❌ Failed sending to ${msg.phone_e164} (${recipientName}): ${err.message}`);
        failCount++;
        await query(
          `UPDATE campaign_messages
           SET last_error = $1, error_code = $2, retry_count = retry_count + 1, updated_at = NOW()
           WHERE id = $3`,
          [err.message, err.errorCode || 'ERR_META_005', msg.id]
        );
        break;
      }
    }

    if (metaResponse?.messages?.[0]?.id) {
      const metaId = metaResponse.messages[0].id;
      successCount++;

      // Update message to 'sent'
      await query(
        `UPDATE campaign_messages
         SET status = 'sent', meta_message_id = $1, sent_at = NOW(),
             last_error = NULL, error_code = NULL, failed_at = NULL,
             retry_count = retry_count + 1, updated_at = NOW()
         WHERE id = $2`,
        [metaId, msg.id]
      );

      // Decrement failed_count, increment sent_count
      await query(
        `UPDATE campaigns
         SET sent_count = sent_count + 1,
             failed_count = GREATEST(0, failed_count - 1),
             updated_at = NOW()
         WHERE id = $1`,
        [campaign.id]
      );

      // Upsert into inbox_conversations & inbox_messages
      try {
        const { rows: [conv] } = await query(
          `INSERT INTO inbox_conversations
             (tenant_id, phone_e164, display_name, status, unread_count, last_message_at, last_message_preview)
           VALUES ($1, $2, $3, 'open', 0, NOW(), $4)
           ON CONFLICT (tenant_id, phone_e164) DO UPDATE
             SET last_message_at = NOW(),
                 last_message_preview = $4,
                 display_name = COALESCE($3, inbox_conversations.display_name),
                 updated_at = NOW()
           RETURNING id`,
          [
            tenant.id,
            msg.phone_e164,
            recipientName,
            `Template: ${campaign.template_name}`,
          ]
        );

        if (conv?.id) {
          await query(
            `INSERT INTO inbox_messages
               (conversation_id, tenant_id, wa_message_id, direction, message_type, body, status, metadata)
             VALUES ($1, $2, $3, 'outbound', 'template', $4, 'sent', $5)
             ON CONFLICT (wa_message_id) DO NOTHING`,
            [
              conv.id,
              tenant.id,
              metaId,
              `Template: ${campaign.template_name}`,
              JSON.stringify({ template_name: campaign.template_name }),
            ]
          );
        }
      } catch (inboxErr) {
        // silent inbox error
      }

      process.stdout.write(`\r   Progress: [${i + 1}/${rateLimitedMessages.length}] Sent to ${msg.phone_e164} (${recipientName}) | Success: ${successCount} | Failed: ${failCount}`);
    }

    // Safe trickle interval (400ms)
    await sleep(400);
  }

  // Mark campaign completed
  await query(
    `UPDATE campaigns
     SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [campaign.id]
  );

  console.log('\n\n================================================================');
  console.log(`🎉 RETRY DISPATCH COMPLETED`);
  console.log(`   Total Processed: ${rateLimitedMessages.length}`);
  console.log(`   Successfully Sent: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log('================================================================\n');

  await pool.end();
}

main().catch(async (e) => {
  console.error('Fatal error during retry dispatch:', e);
  try { await pool.end(); } catch {}
});

