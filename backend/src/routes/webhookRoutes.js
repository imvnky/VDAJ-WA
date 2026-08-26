/**
 * VDAJ Services — Webhook Routes (Meta Status Callbacks + Inbound Messages)
 *
 * GET  /webhooks/whatsapp — Meta hub verification challenge
 * POST /webhooks/whatsapp — Inbound messages + delivery status updates
 *
 * Production features:
 *  1. HMAC-SHA256 signature verification (X-Hub-Signature-256)
 *  2. Inbound messages parsed for text, image, video, audio, document,
 *     sticker, location, contacts, reaction, interactive, order.
 *  3. Media object ID resolved → downloadable URL via Meta Graph API.
 *  4. inbox_conversations + inbox_messages upserted per tenant.
 *  5. Delivery status updates applied to BOTH campaign_messages AND
 *     inbox_messages (direct replies from the Inbox page).
 *  6. BSP compliance: last_inbound_at, opt-in consent auto-recorded.
 *  7. Real-time WebSocket broadcast to all tenant agents.
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { query }     = require('../config/database');
const { sendSuccess } = require('../middleware/responseHandler');
const logger         = require('../utils/logger');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const META_API_BASE = process.env.META_GRAPH_API_URL || 'https://graph.facebook.com';
const API_VERSION   = process.env.META_API_VERSION   || 'v21.0';

// ── GET /webhooks/whatsapp — Meta verification challenge ────────
router.get('/whatsapp', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Meta webhook verified successfully.');
    return res.status(200).send(challenge);
  }
  logger.warn('Meta webhook verification failed — token mismatch.');
  return res.status(403).json({ success: false, message: 'Webhook verification failed.' });
});

// ── POST /webhooks/whatsapp — Main handler ──────────────────────
router.post('/whatsapp', (req, res) => {

  // Always ack Meta immediately with receipt header for App Review traceability
  res.set('X-VDAJ-Webhook-Received', new Date().toISOString());

  // Validate Meta HMAC-SHA256 signature
  const signature = req.headers['x-hub-signature-256'];
  const rawBody   = req.body; // raw Buffer — set in server.js

  if (signature && process.env.META_APP_SECRET) {
    const expected = `sha256=${crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(rawBody)
      .digest('hex')}`;
    // Buffer length must match before timingSafeEqual (throws if lengths differ)
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expBuf)) {
      logger.warn('Webhook HMAC signature mismatch — ignoring payload.');
      return res.status(200).json({ status: 'ignored' }); // Always 200 to Meta
    }
  }

  // Respond 200 immediately — Meta requires fast ack
  res.status(200).json({ status: 'received' });

  // Process payload asynchronously — non-blocking
  setImmediate(async () => {
    try {
      const payload = JSON.parse(rawBody.toString());
      const entry   = payload?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;

      if (!value) return;

      const broadcastToTenant = req.app.get('broadcastToTenant');

      // ── 1. INBOUND MESSAGES ────────────────────────────────────
      if (value.messages?.length) {
        for (const msg of value.messages) {
          await handleInboundMessage(msg, value, broadcastToTenant);
        }
      }

      // ── 2. DELIVERY STATUS UPDATES ─────────────────────────────
      if (value.statuses?.length) {
        for (const status of value.statuses) {
          await handleStatusUpdate(status);
        }
      }
    } catch (err) {
      logger.error('Webhook processing error', { error: err.message, stack: err.stack });
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// HANDLER: Inbound message from customer
// ─────────────────────────────────────────────────────────────────
async function handleInboundMessage(msg, value, broadcastToTenant) {
  const fromPhone   = msg.from;                  // E.164 without '+'
  const waMessageId = msg.id;
  const timestamp   = msg.timestamp;
  const msgType     = msg.type || 'text';

  // Extract body/media depending on message type
  let body     = null;
  let mediaId  = null;   // Meta media object ID — resolved to URL async
  let mediaUrl = null;
  let mediaMime = null;

  switch (msgType) {
    case 'text':
      body = msg.text?.body || null;
      break;
    case 'image':
      body      = msg.image?.caption || null;
      mediaId   = msg.image?.id;
      mediaMime = msg.image?.mime_type || 'image/jpeg';
      break;
    case 'video':
      body      = msg.video?.caption || null;
      mediaId   = msg.video?.id;
      mediaMime = msg.video?.mime_type || 'video/mp4';
      break;
    case 'audio':
      mediaId   = msg.audio?.id;
      mediaMime = msg.audio?.mime_type || 'audio/ogg';
      break;
    case 'document':
      body      = msg.document?.filename || msg.document?.caption || null;
      mediaId   = msg.document?.id;
      mediaMime = msg.document?.mime_type || 'application/octet-stream';
      break;
    case 'sticker':
      mediaId   = msg.sticker?.id;
      mediaMime = msg.sticker?.mime_type || 'image/webp';
      break;
    case 'location':
      body = `📍 Location: ${msg.location?.name || ''} (${msg.location?.latitude},${msg.location?.longitude})`;
      break;
    case 'contacts':
      body = `👤 Contact: ${msg.contacts?.[0]?.name?.formatted_name || 'Unknown'}`;
      break;
    case 'reaction':
      body = `${msg.reaction?.emoji || '👍'} reaction`;
      break;
    case 'interactive':
      body = msg.interactive?.button_reply?.title ||
             msg.interactive?.list_reply?.title   || '[interactive]';
      break;
    case 'order':
      body = `🛒 Order received (${msg.order?.product_items?.length || 0} items)`;
      break;
    default:
      body = null;
  }

  // Resolve tenant from the phone_number_id that received the message
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) {
    logger.warn('Inbound message missing phone_number_id in metadata — cannot route to tenant.');
    return;
  }

  const { rows: tenantRows } = await query(
    `SELECT id, meta_system_token FROM tenants
     WHERE phone_number_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [phoneNumberId]
  );

  if (!tenantRows.length) {
    logger.warn('No tenant found for phone_number_id', { phoneNumberId });
    return;
  }

  const tenantId        = tenantRows[0].id;
  const tenantToken     = tenantRows[0].meta_system_token ||
                          process.env.META_ACCESS_TOKEN;   // env fallback for single-tenant setups
  const displayName     = value.contacts?.[0]?.profile?.name || null;

  // ── Resolve media object ID → downloadable URL ─────────────────
  // Meta's Cloud API delivers media as object IDs, not direct URLs.
  // We resolve them immediately before they expire (~5 min window).
  if (mediaId && tenantToken) {
    try {
      const mediaRes = await fetch(
        `${META_API_BASE}/${API_VERSION}/${mediaId}`,
        { headers: { Authorization: `Bearer ${tenantToken}` } }
      );
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        mediaUrl = mediaData?.url || null;
      }
    } catch (e) {
      logger.warn('Media URL resolution failed', { mediaId, error: e.message });
    }
  }

  // ── Upsert inbox_conversation (unique per tenant + phone) ──────
  const { rows: [conv] } = await query(
    `INSERT INTO inbox_conversations
       (tenant_id, phone_e164, display_name, status, unread_count, last_message_at, last_message_preview)
     VALUES ($1, $2, $3, 'open', 1, to_timestamp($4), $5)
     ON CONFLICT (tenant_id, phone_e164) DO UPDATE
       SET unread_count        = inbox_conversations.unread_count + 1,
           last_message_at     = to_timestamp($4),
           last_message_preview = $5,
           display_name        = COALESCE($3, inbox_conversations.display_name),
           status              = CASE WHEN inbox_conversations.status = 'resolved'
                                      THEN 'open'
                                      ELSE inbox_conversations.status
                                 END,
           updated_at          = NOW()
     RETURNING *`,
    [
      tenantId,
      fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`,
      displayName,
      parseInt(timestamp, 10),
      body ? body.slice(0, 200) : `[${msgType}]`,
    ]
  );

  // Resolve contact_id if we have one
  const { rows: contactRows } = await query(
    `SELECT id FROM contacts
     WHERE tenant_id = $1 AND phone_e164 = $2 LIMIT 1`,
    [tenantId, conv.phone_e164]
  );
  const contactId = contactRows[0]?.id || null;

  // Update contact_id on conversation if we just found it
  if (contactId && !conv.contact_id) {
    await query(
      `UPDATE inbox_conversations SET contact_id = $1 WHERE id = $2`,
      [contactId, conv.id]
    );
  }

  // ── Insert inbox_message record ────────────────────────────────
  const { rows: [savedMsg] } = await query(
    `INSERT INTO inbox_messages
       (conversation_id, tenant_id, wa_message_id, direction, message_type,
        body, media_url, media_mime_type, status)
     VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7, 'delivered')
     ON CONFLICT (wa_message_id) DO NOTHING
     RETURNING *`,
    [
      conv.id,
      tenantId,
      waMessageId,
      msgType,
      body,
      mediaUrl,
      mediaMime,
    ]
  );

  if (!savedMsg) {
    // Duplicate — wa_message_id already in DB (Meta retry)
    logger.debug('Duplicate inbound message ignored', { waMessageId });
    return;
  }

  // ── BSP Compliance: update last_inbound_at for 24-hour window ──
  // This timestamp is checked in inboxRoutes before allowing free-text
  // replies — Meta only permits service messages within 24 hours of
  // the customer's last message.
  await query(
    `UPDATE inbox_conversations
       SET last_inbound_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [conv.id]
  );

  // ── BSP Compliance: auto-record implied opt-in consent ─────────
  // Receiving a message from a customer constitutes implied consent.
  // COALESCE preserves any explicit opt-in already recorded (e.g. from
  // a web form or manual import) — we never downgrade an explicit source.
  await query(
    `UPDATE contacts
       SET opted_in_at   = COALESCE(opted_in_at,   NOW()),
           opt_in_source = COALESCE(opt_in_source, 'inbound_message'),
           opt_in_proof  = COALESCE(opt_in_proof,  $3)
     WHERE tenant_id = $1 AND phone_e164 = $2`,
    [tenantId, conv.phone_e164, `Inbound WA message ${waMessageId}`]
  );

  logger.info('Inbound message saved', {
    tenantId,
    conversationId: conv.id,
    from: fromPhone,
    type: msgType,
  });

  // ── WebSocket broadcast to all agents watching this tenant ─────
  if (typeof broadcastToTenant === 'function') {
    broadcastToTenant(tenantId, {
      type: 'new_message',
      data: {
        ...savedMsg,
        conversation: {
          id:                  conv.id,
          display_name:        conv.display_name || conv.phone_e164,
          phone_e164:          conv.phone_e164,
          unread_count:        conv.unread_count + 1,
          last_message_at:     savedMsg.created_at,
          last_message_preview: body ? body.slice(0, 100) : `[${msgType}]`,
        },
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// HANDLER: Outbound delivery status update
// Applies to BOTH campaign_messages AND inbox_messages
// ─────────────────────────────────────────────────────────────────
async function handleStatusUpdate(status) {
  const { id: metaMessageId, status: msgStatus, timestamp } = status;

  const statusMap = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
  const dbStatus = statusMap[msgStatus];
  if (!dbStatus) return; // Unknown status — skip

  // ── 1. Campaign message status update ──────────────────────────
  const timestampCol = `${dbStatus}_at`;
  try {
    await query(
      `UPDATE campaign_messages
       SET status = $1::message_status,
           ${timestampCol} = to_timestamp($2),
           updated_at = NOW()
       WHERE meta_message_id = $3`,
      [dbStatus, parseInt(timestamp, 10), metaMessageId]
    );

    // Increment the matching campaign counter (best-effort)
    await query(
      `UPDATE campaigns
       SET ${dbStatus}_count = ${dbStatus}_count + 1, updated_at = NOW()
       WHERE id = (
         SELECT campaign_id FROM campaign_messages WHERE meta_message_id = $1 LIMIT 1
       )`,
      [metaMessageId]
    );
  } catch (e) {
    logger.warn('campaign_messages status update skipped', { metaMessageId, error: e.message });
  }

  // ── 2. Inbox message status update (direct replies) ────────────
  // When an agent sends a reply from the Inbox, we store the
  // meta_message_id in inbox_messages. This keeps delivery receipts
  // visible in the chat thread in real time.
  try {
    await query(
      `UPDATE inbox_messages
       SET status = $1, updated_at = NOW()
       WHERE wa_message_id = $2 AND direction = 'outbound'`,
      [dbStatus, metaMessageId]
    );
  } catch (e) {
    logger.warn('inbox_messages status update skipped', { metaMessageId, error: e.message });
  }

  // ── 3. Store raw webhook event (best-effort) ───────────────────
  try {
    await query(
      `INSERT INTO webhook_events (tenant_id, event_type, meta_message_id, raw_payload)
       SELECT cm.tenant_id, $1::webhook_event_type, $2, $3::jsonb
       FROM campaign_messages cm WHERE cm.meta_message_id = $2
       LIMIT 1
       ON CONFLICT DO NOTHING`,
      [`message_${msgStatus}`, metaMessageId, JSON.stringify(status)]
    );
  } catch (e) {
    logger.warn('webhook_event insert skipped', { metaMessageId, error: e.message });
  }

  logger.debug('Status update processed', { metaMessageId, dbStatus });
}

module.exports = router;
