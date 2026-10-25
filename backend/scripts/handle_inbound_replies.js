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

function formatProperCase(str) {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  if (trimmed === trimmed.toUpperCase() || trimmed === trimmed.toLowerCase()) {
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return trimmed;
}

// ── Official Facility Timings (Personalized & Compact — No 'Read More') ─────────────
function buildFacilityTimingsText(contactName) {
  const greeting = (contactName && contactName !== 'Member')
    ? `Hello ${contactName}, thank you for reaching out!`
    : `Hello, thank you for reaching out!`;

  return `🏊 *SMR SWIMMING POOL & HEALTH CLUB*
━━━━━━━━━━━━━━━━━━
${greeting}

Here are our official *Facility Timings*:

🏊 *Swimming Pool*
• 06:00 AM – 10:00 AM (General)
• 04:00 PM – 05:00 PM (Women Only)
• 05:00 PM – 06:45 PM (General)
• 06:45 PM – 08:00 PM (Members Only)

🏸 *Badminton Court*
• 06:00 AM – 10:00 AM | 04:00 PM – 09:00 PM

🏋️ *Gymnasium*
• 06:00 AM – 10:00 AM (General)
• 04:00 PM – 05:00 PM (Women Only)
• 05:00 PM – 08:00 PM (General)
━━━━━━━━━━━━━━━━━━
_Reply here for bookings or any assistance._`;
}

// ── Generic Membership Inquiry Response (Personalized & Compact — No 'Read More') ────
function buildGenericMembershipText(contactName) {
  const greeting = (contactName && contactName !== 'Member')
    ? `Hello ${contactName}, thank you for reaching out!`
    : `Hello, thank you for reaching out!`;

  return `🏊 *SMR SWIMMING POOL & HEALTH CLUB*
━━━━━━━━━━━━━━━━━━
${greeting}

We offer *Individual & Family Plans* with access to:
• Swimming Pool & Coaching
• Badminton Courts & Gymnasium

For membership details and assistance, please visit our *Club Reception Desk* during operational hours.
━━━━━━━━━━━━━━━━━━
_Our team is delighted to assist you!_`;
}

// ── Opt-Out Formatter (Clean & Compact) ───────────────────────
const OPT_OUT_TEXT = `You have been unsubscribed from promotional updates from SMR Swimming Pool & Health Club. Reply START anytime to re-enable.`;

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

  // 2. Query all inbound messages received in the last 48 hours
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
       AND im.created_at >= NOW() - INTERVAL '48 hours'
     ORDER BY ic.phone_e164, im.created_at ASC`,
    [tenant.id]
  );

  if (inbounds.length === 0) {
    console.log('ℹ️ No inbound customer messages received in the last 48 hours.');
    await pool.end();
    return;
  }

  // Group by phone number (collecting all inbound messages per customer)
  const convMap = new Map();
  for (const row of inbounds) {
    if (!convMap.has(row.phone_e164)) {
      convMap.set(row.phone_e164, []);
    }
    convMap.get(row.phone_e164).push(row);
  }

  console.log(`Found ${convMap.size} unique customer conversation(s) with inbound messages in the last 48 hours.\n`);

  const pendingReplies = [];

  for (const [phone, msgs] of convMap.entries()) {
    const latestInbound = msgs[msgs.length - 1];

    // Check if an outbound message has already been sent AFTER the latest inbound message
    const { rows: outboundAfter } = await query(
      `SELECT id, body, created_at
       FROM inbox_messages
       WHERE conversation_id = $1
         AND direction = 'outbound'
         AND created_at > $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [latestInbound.conv_id, latestInbound.inbound_at]
    );

    if (outboundAfter.length > 0) {
      console.log(`⏩ [ALREADY REPLIED] ${phone} (${latestInbound.display_name || 'Customer'}): Replied at ${outboundAfter[0].created_at.toLocaleString()}`);
      continue;
    }

    // Check 24-hour customer service window
    const hoursSinceLastInbound = (Date.now() - new Date(latestInbound.inbound_at).getTime()) / (1000 * 60 * 60);
    const windowHoursRemaining = Math.max(0, 24 - hoursSinceLastInbound);
    const isWindowActive = hoursSinceLastInbound <= 24;

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
       WHERE c.tenant_id = $1 
         AND (c.phone_e164 = $2 OR RIGHT(c.phone_e164, 10) = RIGHT($2, 10))
       ORDER BY (c.phone_e164 = $2) DESC
       LIMIT 1`,
      [tenant.id, phone]
    );

    const contact = contacts[0] || null;
    let cleanName = '';
    if (contact) {
      const fn = (contact.first_name || '').trim();
      const ln = (contact.last_name || '').trim();
      const rawName = (fn && ln) ? `${fn} ${ln}` : (fn || ln || contact.custom_vars?.Name || contact.custom_vars?.name || contact.custom_vars?.full_name || '');
      cleanName = formatProperCase(rawName);
    }
    if (!cleanName && latestInbound.display_name && latestInbound.display_name !== phone && !latestInbound.display_name.startsWith('+')) {
      cleanName = formatProperCase(latestInbound.display_name);
    }

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

    // Direct check for membership_no from custom_vars or campaign template_vars
    let memberId =
      contact?.custom_vars?.membership_no ||
      contact?.custom_vars?.membershipNo ||
      contact?.custom_vars?.Membership_No ||
      contact?.custom_vars?.id ||
      contact?.custom_vars?.member_id ||
      campMsg?.template_vars?.membership_no ||
      campMsg?.template_vars?.Membership_No ||
      campMsg?.template_vars?.id ||
      null;

    // Source 1 fallback: scan all custom_vars keys
    if (!memberId && contact?.custom_vars && typeof contact.custom_vars === 'object') {
      const cv = contact.custom_vars;
      for (const [k, v] of Object.entries(cv)) {
        const lk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (
          lk.includes('membership') ||
          lk.includes('member') ||
          lk.includes('no') ||
          lk.includes('id') ||
          lk.includes('sr') ||
          lk.includes('card')
        ) {
          if (v && String(v).trim()) {
            memberId = String(v).trim();
            break;
          }
        }
      }
    }

    // Source 2 fallback: scan campaign template_vars keys
    if (!memberId && campMsg?.template_vars) {
      for (const [k, v] of Object.entries(campMsg.template_vars)) {
        const lk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (
          lk.includes('membership') ||
          lk.includes('member') ||
          lk.includes('no') ||
          lk.includes('id') ||
          lk.includes('sr')
        ) {
          if (v && String(v).trim()) {
            memberId = String(v).trim();
            break;
          }
        }
      }
    }

    // Infer membership plan from prefix if available: F- => Family, I- => Individual
    if (memberId) {
      const trimmedId = String(memberId).trim().toUpperCase();
      if (trimmedId.startsWith('F-') || trimmedId.startsWith('F')) {
        membershipPlan = 'Family Membership';
      } else if (trimmedId.startsWith('I-') || trimmedId.startsWith('I')) {
        membershipPlan = 'Individual Membership';
      }
    } else if (membershipPlan === 'Club Member' && campMsg?.camp_name) {
      if (/family/i.test(campMsg.camp_name)) {
        membershipPlan = 'Family Membership';
      } else if (/individual/i.test(campMsg.camp_name)) {
        membershipPlan = 'Individual Membership';
      }
    }

    // Scan all unreplied messages from this customer to detect button clicks or inquiries
    const allInboundTexts = msgs.map((m) => (m.body || '').trim().toLowerCase());
    const combinedInboundText = allInboundTexts.join(' ');

    let category = 'CUSTOM';
    let replyText = null;

    const hasTimings = allInboundTexts.some((t) =>
      t === 'view timings' || t.includes('timing') || t.includes('time') || t.includes('schedule')
    );
    const hasMembership = allInboundTexts.some((t) =>
      t === 'membership info' || t.includes('membership') || t.includes('member info') || t.includes('plan')
    );
    const hasOptOut = allInboundTexts.some((t) =>
      t === 'stop' || t === 'unsubscribe' || t === 'cancel'
    );

    if (hasOptOut) {
      category = 'OPT_OUT';
      replyText = OPT_OUT_TEXT;
    } else if (hasTimings && !hasMembership) {
      category = 'TIMINGS';
      replyText = buildFacilityTimingsText(cleanName);
    } else if (hasMembership && !hasTimings) {
      category = 'MEMBERSHIP';
      replyText = buildGenericMembershipText(cleanName);
    } else if (hasTimings && hasMembership) {
      // If customer requested both, send timings (facility schedule)
      category = 'TIMINGS';
      replyText = buildFacilityTimingsText(cleanName);
    } else {
      category = 'CUSTOM_MANUAL';
      replyText = null; // Left for manual review in inbox
    }

    pendingReplies.push({
      phone,
      convId: latestInbound.conv_id,
      inboundMsgId: latestInbound.message_id,
      contactName: cleanName,
      inboundBody: msgs.map((m) => m.body).join(' | '),
      inboundAt: latestInbound.inbound_at,
      hoursSinceLastInbound,
      windowHoursRemaining,
      isWindowActive,
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
    const windowBadge = item.isWindowActive
      ? `🟢 24h Window Active (${item.windowHoursRemaining.toFixed(1)} hrs left)`
      : `🔴 24h Window Expired (${item.hoursSinceLastInbound.toFixed(1)} hrs ago)`;

    console.log(`[#${idx + 1}] Contact: ${item.contactName} (${item.phone}) — ${windowBadge}`);
    console.log(`     Customer Message: "${item.inboundBody}"`);
    console.log(`     Category: ${item.category}`);

    if (item.replyText) {
      autoCount++;
      console.log(`     👉 Proposed Reply:\n${item.replyText.split('\n').map(l => '        ' + l).join('\n')}`);
    } else {
      manualCount++;
      console.log(`     ⚠️ Note: Custom query. Recommended to answer manually from Live Inbox (wa.vdajservices.com/inbox).`);
    }
    console.log('');
  });

  const timingsCount = pendingReplies.filter(p => p.category === 'TIMINGS').length;
  const membershipCount = pendingReplies.filter(p => p.category === 'MEMBERSHIP').length;
  const optOutCount = pendingReplies.filter(p => p.category === 'OPT_OUT').length;

  console.log('---------------------------------------------------------------');
  console.log(`Summary: ${autoCount} automated replies ready (${timingsCount} Timings, ${membershipCount} Membership Desk, ${optOutCount} Opt-Out) | ${manualCount} Custom inquiries for manual review.`);
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

    if (!item.isWindowActive) {
      console.warn(`   ⚠️ Skipping ${item.phone} (${item.contactName}): 24-hour customer window has expired.`);
      failCount++;
      continue;
    }

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
