'use strict';

/**
 * VDAJ Services — Safe Inbound Reply Handler (Temporary One-Time Utility)
 * 
 * Safely inspects and drafts replies for customers who replied or clicked quick replies
 * within the active 24-hour customer window.
 *
 * Usage:
 *   Dry-Run (Default, Safe Preview Only):
 *     node scripts/handle_inbound_replies.js
 *
 *   Execute & Send Approved Replies:
 *     node scripts/handle_inbound_replies.js --send
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');
const { sendFreeText } = require('../src/services/metaApiService');
const logger = require('../src/utils/logger');

const IS_SEND_MODE = process.argv.includes('--send');

// ── Official Facility Timings ─────────────────────────────────────
const FACILITY_TIMINGS_TEXT = `🏊 *SMR Swimming Pool & Health Club — Facility Timings*

🏊‍♂️ *Swimming Pool:*
• 06:00 AM – 10:00 AM (General / All)
• 04:00 PM – 05:00 PM (*Women Only*)
• 05:00 PM – 06:45 PM (General / All)
• 06:45 PM – 08:00 PM (*Members Only*)

🏸 *Badminton Court:*
• 06:00 AM – 10:00 AM
• 04:00 PM – 09:00 PM

🏋️ *Gymnasium:*
• 06:00 AM – 10:00 AM (General)
• 04:00 PM – 05:00 PM (*Women Only*)
• 05:00 PM – 08:00 PM (General)

_For any queries or facility bookings, feel free to reply directly to this chat!_`;

// ── Membership Info Formatter ─────────────────────────────────────
function buildMembershipText(contactName, membershipPlan, memberId) {
  const name = contactName || 'Member';
  const plan = membershipPlan || 'Club Membership';
  const idDisplay = memberId ? `• *Member ID:* ${memberId}\n` : '';

  return `👋 *Hello ${name},*

Here are your membership details at *SMR Swimming Pool & Health Club*:
• *Member Name:* ${name}
• *Membership Plan:* ${plan}
${idDisplay}
Whether you wish to renew, register a family member, or inquire about coaching plans, feel free to reply right here or visit our club reception!`;
}

// ── Opt-Out Formatter ─────────────────────────────────────────────
const OPT_OUT_TEXT = `You have been successfully unsubscribed from promotional updates from SMR Swimming Pool & Health Club. You will not receive further broadcast messages. Reply START anytime to re-enable.`;

async function main() {
  console.log('===============================================================');
  console.log(` SMR CUSTOMER INBOUND REPLIES — ${IS_SEND_MODE ? '⚡ SEND MODE' : '🔍 DRY-RUN PREVIEW'}`);
  console.log('===============================================================\n');

  // 1. Fetch SMR tenant credentials
  const { rows: tenants } = await query(
    `SELECT id, name, phone_number_id, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%'
     LIMIT 1`
  );

  if (!tenants.length) {
    console.error('❌ Error: SMR tenant not found in database.');
    await pool.end();
    return;
  }

  const tenant = tenants[0];
  const token = tenant.meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = tenant.phone_number_id || process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.error('❌ Error: Missing Meta credentials for SMR tenant.');
    await pool.end();
    return;
  }

  // 2. Query all inbound messages received in the last 24 hours
  const { rows: inbounds } = await query(
    `SELECT 
       ic.id AS conv_id,
       ic.phone_e164,
       ic.display_name,
       ic.last_inbound_at,
       im.id AS message_id,
       im.body,
       im.message_type,
       im.created_at AS inbound_at
     FROM inbox_messages im
     JOIN inbox_conversations ic ON ic.id = im.conversation_id
     WHERE ic.tenant_id = $1
       AND im.direction = 'inbound'
       AND im.created_at >= NOW() - INTERVAL '24 hours'
     ORDER BY ic.phone_e164, im.created_at ASC`,
    [tenant.id]
  );

  if (inbounds.length === 0) {
    console.log('ℹ️ No inbound customer messages received in the last 24 hours.');
    await pool.end();
    return;
  }

  // Group by phone number (taking the latest inbound message per customer)
  const convMap = new Map();
  for (const row of inbounds) {
    convMap.set(row.phone_e164, row);
  }

  console.log(`Found ${convMap.size} unique customer conversation(s) with inbound replies in the last 24 hours.\n`);

  const pendingReplies = [];

  for (const [phone, inbound] of convMap.entries()) {
    // Check if an outbound message has already been sent AFTER this inbound message
    const { rows: outboundAfter } = await query(
      `SELECT id, body, created_at
       FROM inbox_messages
       WHERE conversation_id = $1
         AND direction = 'outbound'
         AND created_at > $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [inbound.conv_id, inbound.inbound_at]
    );

    if (outboundAfter.length > 0) {
      console.log(`⏩ [ALREADY REPLIED] ${phone} (${inbound.display_name || 'Customer'}): Replied at ${outboundAfter[0].created_at.toLocaleString()}`);
      continue;
    }

    // Fetch contact details from contacts table
    const { rows: contacts } = await query(
      `SELECT 
         c.id, c.first_name, c.last_name, c.phone_e164, c.tags, c.custom_vars,
         COALESCE(
           (SELECT cl.name 
            FROM contact_list_members clm 
            JOIN contact_lists cl ON cl.id = clm.contact_list_id 
            WHERE clm.contact_id = c.id AND cl.deleted_at IS NULL 
            LIMIT 1),
           NULL
         ) AS group_name
       FROM contacts c
       WHERE c.tenant_id = $1 AND c.phone_e164 = $2
       LIMIT 1`,
      [tenant.id, phone]
    );

    const contact = contacts[0] || null;
    const cleanName = contact
      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.first_name || inbound.display_name
      : inbound.display_name || 'Member';

    // Determine membership plan & ID
    let membershipPlan = 'Club Member';
    if (contact?.group_name) {
      membershipPlan = contact.group_name;
    } else if (Array.isArray(contact?.tags) && contact.tags.length > 0) {
      const planTag = contact.tags.find((t) => /membership|member|family|individual/i.test(t));
      if (planTag) membershipPlan = planTag;
    }

    // Also check campaign_messages for this recipient to see variables stored during upload/launch
    const { rows: campRows } = await query(
      `SELECT cm.template_vars, camp.name AS camp_name
       FROM campaign_messages cm
       JOIN campaigns camp ON camp.id = cm.campaign_id
       WHERE cm.phone_e164 = $1
       ORDER BY cm.created_at DESC
       LIMIT 1`,
      [phone]
    );
    const campMsg = campRows[0] || null;

    // Deep search for Member ID across all possible sources
    let memberId = null;

    // Source 1: Check contact custom_vars with all common key variations
    if (contact?.custom_vars && typeof contact.custom_vars === 'object') {
      const cv = contact.custom_vars;
      for (const [k, v] of Object.entries(cv)) {
        const lk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (
          lk.includes('id') ||
          lk.includes('no') ||
          lk.includes('sr') ||
          lk.includes('member') ||
          lk.includes('card') ||
          lk.includes('reg') ||
          lk.includes('code')
        ) {
          if (v && String(v).trim()) {
            memberId = String(v).trim();
            break;
          }
        }
      }
      // If still null and there's any non-empty value in custom_vars
      if (!memberId) {
        for (const [k, v] of Object.entries(cv)) {
          if (v && String(v).trim()) {
            memberId = String(v).trim();
            break;
          }
        }
      }
    }

    // Source 2: Check campaign_messages template_vars
    if (!memberId && campMsg) {
      const vars = campMsg.template_vars || {};
      for (const [k, v] of Object.entries(vars)) {
        const lk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (
          lk.includes('id') ||
          lk.includes('no') ||
          lk.includes('sr') ||
          lk.includes('member') ||
          lk.includes('card') ||
          lk.includes('reg') ||
          lk.includes('code')
        ) {
          if (v && String(v).trim()) {
            memberId = String(v).trim();
            break;
          }
        }
      }
    }

    // Source 3: Check tags for ID pattern (e.g. SMR-123, FM-101, or pure alphanumeric codes)
    if (!memberId && Array.isArray(contact?.tags)) {
      for (const t of contact.tags) {
        const str = String(t).trim();
        if (/\d+/.test(str) && !/membership|member|pool|health/i.test(str)) {
          memberId = str;
          break;
        }
      }
    }

    // Determine membership plan if still default
    if (membershipPlan === 'Club Member' && campMsg?.camp_name) {
      if (/family/i.test(campMsg.camp_name)) {
        membershipPlan = 'Family Membership';
      } else if (/individual/i.test(campMsg.camp_name)) {
        membershipPlan = 'Individual Membership';
      }
    }

    const rawInbound = (inbound.body || '').trim().toLowerCase();
    let category = 'CUSTOM';
    let replyText = null;

    if (
      rawInbound === 'view timings' ||
      rawInbound.includes('timing') ||
      rawInbound.includes('time') ||
      rawInbound.includes('schedule')
    ) {
      category = 'TIMINGS';
      replyText = FACILITY_TIMINGS_TEXT;
    } else if (
      rawInbound === 'membership info' ||
      rawInbound.includes('membership') ||
      rawInbound.includes('member info') ||
      rawInbound.includes('plan')
    ) {
      category = 'MEMBERSHIP';
      replyText = buildMembershipText(cleanName, membershipPlan, memberId);
    } else if (
      rawInbound === 'stop' ||
      rawInbound === 'unsubscribe' ||
      rawInbound === 'cancel'
    ) {
      category = 'OPT_OUT';
      replyText = OPT_OUT_TEXT;
    } else {
      category = 'CUSTOM_MANUAL';
      replyText = null; // Left for manual review in inbox
    }

    pendingReplies.push({
      phone,
      convId: inbound.conv_id,
      inboundMsgId: inbound.message_id,
      contactName: cleanName,
      inboundBody: inbound.body,
      category,
      membershipPlan,
      memberId,
      replyText,
      rawCustomVars: contact?.custom_vars,
      rawCampVars: campMsg?.template_vars,
      rawTags: contact?.tags,
    });
  }

  console.log('\n---------------------------------------------------------------');
  console.log(`📋 PROPOSED REPLIES FOR REVIEW (${pendingReplies.length} Actionable Inquiries)`);
  console.log('---------------------------------------------------------------\n');

  if (pendingReplies.length === 0) {
    console.log('✅ All inbound inquiries have already been answered or handled.');
    await pool.end();
    return;
  }

  let autoCount = 0;
  let manualCount = 0;

  pendingReplies.forEach((item, idx) => {
    console.log(`[#${idx + 1}] Contact: ${item.contactName} (${item.phone})`);
    console.log(`     Customer Message: "${item.inboundBody}"`);
    console.log(`     Category: ${item.category}`);

    if (item.category === 'MEMBERSHIP') {
      console.log(`     Detected Plan: ${item.membershipPlan} | ID: ${item.memberId || 'N/A'}`);
      if (!item.memberId) {
        console.log(`     [Debug Data] custom_vars: ${JSON.stringify(item.rawCustomVars)} | camp_vars: ${JSON.stringify(item.rawCampVars)} | tags: ${JSON.stringify(item.rawTags)}`);
      }
    }

    if (item.replyText) {
      autoCount++;
      console.log(`     👉 Proposed Reply:\n${item.replyText.split('\n').map(l => '        ' + l).join('\n')}`);
    } else {
      manualCount++;
      console.log(`     ⚠️ Note: Custom query. Recommended to answer manually from Live Inbox (wa.vdajservices.com/inbox).`);
    }
    console.log('');
  });

  console.log('---------------------------------------------------------------');
  console.log(`Summary: ${autoCount} automated replies ready | ${manualCount} custom queries for manual inbox review.`);
  console.log('---------------------------------------------------------------\n');

  if (!IS_SEND_MODE) {
    console.log('🔒 DRY RUN COMPLETE. No messages were sent.');
    console.log('To send the automated replies above, re-run this command with --send:');
    console.log('  node scripts/handle_inbound_replies.js --send\n');
    await pool.end();
    return;
  }

  // ── SEND MODE EXECUTION ─────────────────────────────────────────
  console.log('🚀 Sending approved replies now...\n');
  let successCount = 0;
  let failCount = 0;

  for (const item of pendingReplies) {
    if (!item.replyText) continue;

    try {
      console.log(`Sending to ${item.contactName} (${item.phone})...`);

      const metaRes = await sendFreeText({
        phoneNumberId: phoneId,
        accessToken: token,
        to: item.phone,
        body: item.replyText,
      });

      const metaMsgId = metaRes?.messages?.[0]?.id || `OUT_${Date.now()}`;

      // Insert into inbox_messages
      await query(
        `INSERT INTO inbox_messages
           (conversation_id, tenant_id, wa_message_id, direction, message_type, body, status, metadata)
         VALUES ($1, $2, $3, 'outbound', 'text', $4, 'sent', $5)
         ON CONFLICT (wa_message_id) DO NOTHING`,
        [
          item.convId,
          tenant.id,
          metaMsgId,
          item.replyText,
          JSON.stringify({ auto_reply_category: item.category }),
        ]
      );

      // Update inbox_conversations preview
      await query(
        `UPDATE inbox_conversations
         SET last_message_at = NOW(),
             last_message_preview = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [item.replyText.slice(0, 100), item.convId]
      );

      console.log(`   ✅ Sent successfully! (Meta ID: ${metaMsgId})`);
      successCount++;

      // 500ms safety delay
      await new Promise((r) => setTimeout(r, 500));
    } catch (sendErr) {
      console.error(`   ❌ Failed to send to ${item.phone}:`, sendErr.message);
      failCount++;
    }
  }

  console.log('\n===============================================================');
  console.log(`DONE! Successfully sent: ${successCount} | Failed: ${failCount}`);
  console.log('===============================================================\n');

  await pool.end();
}

main().catch(async (err) => {
  console.error('Fatal error in handle_inbound_replies:', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
