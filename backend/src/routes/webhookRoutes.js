/**
 * VDAJ Services — Webhook Routes (Meta Status Callbacks + Inbound Messages)
 *
 * GET  /webhooks/whatsapp — Meta hub verification challenge
 * POST /webhooks/whatsapp — Inbound messages + delivery status updates
 *
 * FIXES:
 *  1. Inbound messages[] are now parsed, stored in inbox_conversations + inbox_messages.
 *  2. broadcastToTenant() is called for real-time WebSocket push on every inbound message.
 *  3. Outbound status updates (sent/delivered/read/failed) are unchanged and still processed.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query } = require('../config/database');
const { sendSuccess } = require('../middleware/responseHandler');
const logger = require('../utils/logger');

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

  // Validate Meta HMAC-SHA256 signature
  const signature = req.headers['x-hub-signature-256'];
  const rawBody   = req.body; // raw Buffer — set in server.js

  if (signature && process.env.META_APP_SECRET) {
    const expected = `sha256=${crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(rawBody)
      .digest('hex')}`;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
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
  const body     = msg.text?.body || msg.caption || null;
  const mediaUrl = msg.image?.link || msg.document?.link || msg.video?.link || msg.audio?.link || null;
  const mediaMime = msg.image?.mime_type || msg.document?.mime_type || msg.video?.mime_type || msg.audio?.mime_type || null;

  // Resolve tenant from the phone_number_id that received the message
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) {
    logger.warn('Inbound message missing phone_number_id in metadata — cannot route to tenant.');
    return;
  }

  const { rows: tenantRows } = await query(
    `SELECT id FROM tenants WHERE phone_number_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [phoneNumberId]
  );

  if (!tenantRows.length) {
    logger.warn('No tenant found for phone_number_id', { phoneNumberId });
    return;
  }

  const tenantId    = tenantRows[0].id;
  const displayName = value.contacts?.[0]?.profile?.name || null;

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
// ─────────────────────────────────────────────────────────────────
async function handleStatusUpdate(status) {
  const { id: metaMessageId, status: msgStatus, timestamp } = status;

  const statusMap = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
  const dbStatus = statusMap[msgStatus];
  if (!dbStatus) return; // Unknown status — skip

  // Store raw webhook event (best-effort)
  try {
    await query(
      `INSERT INTO webhook_events (tenant_id, event_type, meta_message_id, raw_payload)
       SELECT cm.tenant_id, $1::webhook_event_type, $2, $3::jsonb
       FROM campaign_messages cm WHERE cm.meta_message_id = $2 LIMIT 1`,
      [`message_${msgStatus}`, metaMessageId, JSON.stringify(status)]
    );
  } catch (e) {
    // Non-fatal — event logging failure should not abort status update
    logger.warn('Could not store webhook_event', { metaMessageId, error: e.message });
  }

  // Update campaign_message status + timestamp
  const timestampCol = `${dbStatus}_at`;
  await query(
    `UPDATE campaign_messages
     SET status = $1::message_status,
         ${timestampCol} = to_timestamp($2),
         updated_at = NOW()
     WHERE meta_message_id = $3`,
    [dbStatus, parseInt(timestamp, 10), metaMessageId]
  );

  // Increment the matching campaign counter
  const counterCol = `${dbStatus}_count`;
  await query(
    `UPDATE campaigns
     SET ${counterCol} = ${counterCol} + 1, updated_at = NOW()
     WHERE id = (
       SELECT campaign_id FROM campaign_messages WHERE meta_message_id = $1 LIMIT 1
     )`,
    [metaMessageId]
  );

  logger.debug('Status update processed', { metaMessageId, dbStatus });
}

module.exports = router;
