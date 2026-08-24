/**
 * VDAJ Services — Inbox Routes
 * GET    /inbox/conversations              — Scoped, filterable conversation list
 * GET    /inbox/conversations/:id/messages — Message history (paginated)
 * POST   /inbox/conversations/:id/reply   — Send free-text or template reply
 * PATCH  /inbox/conversations/:id/resolve — Change status (open|pending|resolved)
 * POST   /inbox/conversations/:id/assign  — Assign/unassign conversation to agent
 * PATCH  /inbox/conversations/:id/status  — Explicit status update (open|pending|resolved)
 *
 * BSP Note: free-form text replies are blocked after the 24-hour
 * customer service window. Agents MUST use a pre-approved template.
 *
 * Phase 2: filter, assignment, scoped agent inbox, WS broadcast.
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

// ── Helper: broadcast WS event to a tenant ────────────────────
// Uses the broadcastToTenant function exposed by server.js via app.set()
function broadcastToTenant(req, type, data) {
  try {
    const fn = req.app.get('broadcastToTenant');
    if (fn) fn(req.user.tenantId, { type, data, ts: Date.now() });
  } catch {}
}

// ── GET /inbox/conversations ──────────────────────────────────
// Query params:
//   status  = 'open' | 'pending' | 'resolved' | 'all'  (default: 'open')
//   filter  = 'all' | 'mine' | 'unassigned'             (default depends on role)
//   search  = string (name or phone)
//   page, limit
//
// Agent scoping: if role is 'agent' and no filter is specified,
// defaults to 'mine' (only conversations assigned to them or unassigned).
router.get('/conversations', catchAsync(async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let statusFilter = req.query.status;
  if (!statusFilter || statusFilter === 'all') statusFilter = null; // no status filter

  let filter = req.query.filter;
  // Agents default to seeing only their conversations unless explicitly asked for 'all'
  if (!filter && req.user.role === 'agent') filter = 'mine';
  if (!filter) filter = 'all';

  const params = [req.user.tenantId];
  let conditions = [`c.tenant_id = $1`, `c.deleted_at IS NULL`];

  if (statusFilter) {
    params.push(statusFilter);
    conditions.push(`c.status = $${params.length}`);
  }

  // Assignment scoping
  if (filter === 'mine') {
    params.push(req.user.id);
    conditions.push(`(c.assigned_to = $${params.length} OR c.assigned_to IS NULL)`);
  } else if (filter === 'unassigned') {
    conditions.push(`c.assigned_to IS NULL`);
  }
  // filter === 'all' → no restriction

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(c.display_name ILIKE $${params.length} OR c.phone_e164 ILIKE $${params.length})`);
  }

  const WHERE = conditions.join(' AND ');

  // Count query
  const { rows: countRows } = await query(
    `SELECT COUNT(*) AS total FROM inbox_conversations c WHERE ${WHERE}`,
    params
  );
  const total = parseInt(countRows[0]?.total || 0);

  // Data query — join assigned agent info
  params.push(parseInt(limit), offset);
  const { rows } = await query(
    `SELECT
       c.*,
       u.first_name  AS assigned_first,
       u.last_name   AS assigned_last,
       u.email       AS assigned_email
     FROM inbox_conversations c
     LEFT JOIN users u ON u.id = c.assigned_to
     WHERE ${WHERE}
     ORDER BY c.last_message_at DESC NULLS LAST
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return sendSuccess(res, rows, 'Conversations fetched.', 200, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / parseInt(limit)),
  });
}));

// ── GET /inbox/conversations/:id/messages ─────────────────────
router.get('/conversations/:id/messages', catchAsync(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const convCheck = await query(
    'SELECT id FROM inbox_conversations WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [req.params.id, req.user.tenantId]
  );
  if (!convCheck.rows.length) throw new AppError('Conversation not found.', 404, 'ERR_INBOX_001');

  // Mark as read
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

// ── POST /inbox/conversations/:id/reply ───────────────────────
router.post('/conversations/:id/reply', catchAsync(async (req, res) => {
  const { body: messageBody, messageType = 'text', template_id } = req.body;
  if (!messageBody?.trim()) throw new AppError('Message body is required.', 400, 'ERR_INBOX_002');

  const convRes = await query(
    `SELECT c.*, t.meta_system_token, t.phone_number_id
     FROM inbox_conversations c
     JOIN tenants t ON c.tenant_id = t.id
     WHERE c.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL`,
    [req.params.id, req.user.tenantId]
  );
  if (!convRes.rows.length) throw new AppError('Conversation not found.', 404, 'ERR_INBOX_001');

  const conv = convRes.rows[0];
  if (!conv.meta_system_token || !conv.phone_number_id) {
    throw new AppError('WhatsApp not connected. Go to WhatsApp Setup.', 409, 'ERR_META_NOT_CONNECTED');
  }

  // ── BSP Compliance: enforce 24-hour customer service window ──────
  if (!template_id) {
    const lastInbound = conv.last_inbound_at ? new Date(conv.last_inbound_at) : null;
    const msSinceLast = lastInbound ? Date.now() - lastInbound.getTime() : Infinity;
    const hoursSinceLast = msSinceLast / 3_600_000;

    if (hoursSinceLast > 24) {
      const hrs = lastInbound ? Math.round(hoursSinceLast) : null;
      throw new AppError(
        'The 24-hour customer service window has closed.' +
        (hrs ? ` Last customer message was ${hrs}h ago.` : '') +
        ' You must use a pre-approved template to send a message.',
        400,
        'ERR_24HR_WINDOW'
      );
    }
  }

  const metaResponse = await sendWhatsAppMessage({
    accessToken: conv.meta_system_token,
    phoneNumberId: conv.phone_number_id,
    to: conv.phone_e164,
    body: messageBody,
  });

  const { rows } = await query(
    `INSERT INTO inbox_messages
       (conversation_id, tenant_id, wa_message_id, direction, message_type, body, status, sent_by)
     VALUES ($1, $2, $3, 'outbound', $4, $5, 'sent', $6)
     RETURNING *`,
    [req.params.id, req.user.tenantId, metaResponse?.messages?.[0]?.id, messageType, messageBody, req.user.id]
  );

  await query(
    `UPDATE inbox_conversations
       SET last_message_at = NOW(), last_message_preview = $1, updated_at = NOW()
     WHERE id = $2`,
    [messageBody.slice(0, 100), req.params.id]
  );

  return sendSuccess(res, rows[0], 'Message sent.');
}));

// ── PATCH /inbox/conversations/:id/resolve ────────────────────
// Legacy compat endpoint — delegates to status update
router.patch('/conversations/:id/resolve', catchAsync(async (req, res) => {
  const { status = 'resolved' } = req.body;
  const VALID = ['open', 'pending', 'resolved'];
  if (!VALID.includes(status)) {
    throw new AppError(`status must be one of: ${VALID.join(', ')}.`, 400, 'ERR_VDAJ_VAL_001');
  }

  const { rows } = await query(
    `UPDATE inbox_conversations
       SET status = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [status, req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Conversation not found.', 404, 'ERR_INBOX_001');

  broadcastToTenant(req, 'CONVERSATION_STATUS_CHANGED', {
    conversationId: req.params.id,
    status,
  });

  return sendSuccess(res, rows[0], `Conversation ${status}.`);
}));

// ── PATCH /inbox/conversations/:id/status ─────────────────────
// Explicit status change: open | pending | resolved
router.patch('/conversations/:id/status', catchAsync(async (req, res) => {
  const { status } = req.body;
  const VALID = ['open', 'pending', 'resolved'];
  if (!VALID.includes(status)) {
    throw new AppError(`status must be one of: ${VALID.join(', ')}.`, 400, 'ERR_VDAJ_VAL_001');
  }

  const { rows } = await query(
    `UPDATE inbox_conversations
       SET status = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING id, status, assigned_to, display_name, phone_e164`,
    [status, req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Conversation not found.', 404, 'ERR_INBOX_001');

  broadcastToTenant(req, 'CONVERSATION_STATUS_CHANGED', {
    conversationId: req.params.id,
    status,
  });

  return sendSuccess(res, rows[0], `Status updated to "${status}".`);
}));

// ── POST /inbox/conversations/:id/assign ──────────────────────
// Assign conversation to an agent (or NULL to unassign).
// Body: { userId: string | null }
// Broadcasts CONVERSATION_ASSIGNED to all tenant WS clients.
router.post('/conversations/:id/assign', catchAsync(async (req, res) => {
  const { userId } = req.body; // null = unassign

  // If userId provided, verify it belongs to the same tenant
  if (userId) {
    const { rows: agentRows } = await query(
      `SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE AND deleted_at IS NULL`,
      [userId, req.user.tenantId]
    );
    if (!agentRows.length) {
      throw new AppError('Agent not found in your tenant.', 404, 'ERR_VDAJ_AUTH_005');
    }
  }

  const { rows } = await query(
    `UPDATE inbox_conversations
       SET assigned_to = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING id, assigned_to, display_name, phone_e164`,
    [userId || null, req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Conversation not found.', 404, 'ERR_INBOX_001');

  // Broadcast to all agents in the tenant
  broadcastToTenant(req, 'CONVERSATION_ASSIGNED', {
    conversationId: req.params.id,
    assignedTo: userId || null,
    assignedBy: req.user.id,
  });

  return sendSuccess(res, rows[0], userId ? 'Conversation assigned.' : 'Conversation unassigned.');
}));

module.exports = router;
