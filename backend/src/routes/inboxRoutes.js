/**
 * VDAJ Services — Inbox Routes
 * GET  /inbox/conversations
 * GET  /inbox/conversations/:id/messages
 * POST /inbox/conversations/:id/reply
 *   Body: { body: string, messageType?: string, template_id?: string }
 *   BSP Note: If the 24-hour customer service window has expired,
 *   `template_id` is REQUIRED. Free-text replies will be blocked.
 * PATCH /inbox/conversations/:id/resolve
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { sendSuccess, catchAsync } = require('../middleware/responseHandler');
const { authenticate } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const AppError = require('../utils/AppError');
const { sendWhatsAppMessage } = require('../services/metaApiService');

// All inbox routes require auth + tenant
router.use(authenticate, requireTenant);

// ---- GET /inbox/conversations ----
router.get('/conversations', catchAsync(async (req, res) => {
  const { status = 'open', page = 1, limit = 30, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let sql = `
    SELECT
      c.*,
      (SELECT COUNT(*) FROM inbox_conversations WHERE tenant_id = $1 AND status = $2) AS total_count
    FROM inbox_conversations c
    WHERE c.tenant_id = $1 AND c.status = $2
  `;
  const params = [req.user.tenantId, status];

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (c.display_name ILIKE $${params.length} OR c.phone_e164 ILIKE $${params.length})`;
  }

  sql += ` ORDER BY c.last_message_at DESC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit), offset);

  const { rows } = await query(sql, params);
  const total = parseInt(rows[0]?.total_count || 0);

  return sendSuccess(res, rows, 'Conversations fetched.', 200, {
    total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit))
  });
}));

// ---- GET /inbox/conversations/:id/messages ----
router.get('/conversations/:id/messages', catchAsync(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Verify conversation belongs to tenant
  const convCheck = await query(
    'SELECT id FROM inbox_conversations WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenantId]
  );
  if (!convCheck.rows.length) throw new AppError('Conversation not found.', 404, 'ERR_INBOX_001');

  // Mark messages as read — reset unread count
  await query(
    'UPDATE inbox_conversations SET unread_count = 0, updated_at = NOW() WHERE id = $1',
    [req.params.id]
  );

  const { rows } = await query(
    `SELECT m.*, u.first_name AS sender_name
     FROM inbox_messages m
     LEFT JOIN users u ON m.sent_by = u.id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.params.id, parseInt(limit), offset]
  );

  return sendSuccess(res, rows.reverse());
}));

// ---- POST /inbox/conversations/:id/reply ----
router.post('/conversations/:id/reply', catchAsync(async (req, res) => {
  const { body: messageBody, messageType = 'text', template_id } = req.body;
  if (!messageBody?.trim()) throw new AppError('Message body is required.', 400, 'ERR_INBOX_002');

  const convRes = await query(
    `SELECT c.*, t.meta_system_token, t.phone_number_id
     FROM inbox_conversations c
     JOIN tenants t ON c.tenant_id = t.id
     WHERE c.id = $1 AND c.tenant_id = $2`,
    [req.params.id, req.user.tenantId]
  );
  if (!convRes.rows.length) throw new AppError('Conversation not found.', 404, 'ERR_INBOX_001');

  const conv = convRes.rows[0];
  if (!conv.meta_system_token || !conv.phone_number_id) {
    throw new AppError('WhatsApp not connected. Go to WhatsApp Setup.', 409, 'ERR_META_NOT_CONNECTED');
  }

  // ── BSP Compliance: enforce 24-hour customer service window ───────
  // Meta only allows free-form text replies within 24 hours of the
  // customer's last inbound message. After that, agents MUST use a
  // pre-approved template. Violating this causes message delivery
  // failures and can lower the account's quality rating.
  if (!template_id) {
    const lastInbound = conv.last_inbound_at ? new Date(conv.last_inbound_at) : null;
    const msSinceLast = lastInbound ? Date.now() - lastInbound.getTime() : Infinity;
    const hoursSinceLast = msSinceLast / 3_600_000;

    if (hoursSinceLast > 24) {
      const hrs = lastInbound
        ? Math.round(hoursSinceLast)
        : null;
      throw new AppError(
        'The 24-hour customer service window has closed.' +
        (hrs ? ` Last customer message was ${hrs}h ago.` : '') +
        ' You must use a pre-approved template to send a message.',
        400,
        'ERR_24HR_WINDOW'
      );
    }
  }

  // Send via Meta API
  const metaResponse = await sendWhatsAppMessage({
    accessToken: conv.meta_system_token,
    phoneNumberId: conv.phone_number_id,
    to: conv.phone_e164,
    body: messageBody,
  });

  // Save message to DB
  const { rows } = await query(
    `INSERT INTO inbox_messages
       (conversation_id, tenant_id, wa_message_id, direction, message_type, body, status, sent_by)
     VALUES ($1, $2, $3, 'outbound', $4, $5, 'sent', $6)
     RETURNING *`,
    [req.params.id, req.user.tenantId, metaResponse?.messages?.[0]?.id, messageType, messageBody, req.user.id]
  );

  // Update conversation preview
  await query(
    `UPDATE inbox_conversations
       SET last_message_at = NOW(), last_message_preview = $1, updated_at = NOW()
     WHERE id = $2`,
    [messageBody.slice(0, 100), req.params.id]
  );

  return sendSuccess(res, rows[0], 'Message sent.');
}));

// ---- PATCH /inbox/conversations/:id/resolve ----
router.patch('/conversations/:id/resolve', catchAsync(async (req, res) => {
  const { status = 'resolved' } = req.body;
  const { rows } = await query(
    `UPDATE inbox_conversations SET status = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [status, req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Conversation not found.', 404, 'ERR_INBOX_001');
  return sendSuccess(res, rows[0], `Conversation ${status}.`);
}));

module.exports = router;
