/**
 * VDAJ Services — Campaign Routes
 * GET /campaigns | POST /campaigns | GET /:id | POST /:id/launch | PATCH /:id/pause | DELETE /:id
 *
 * FIX: POST /:id/launch now bulk-inserts campaign_messages from contact_list_members
 *      BEFORE querying them, so the campaign actually has records to send.
 */

const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../config/database');
const { sendSuccess, sendCreated, catchAsync } = require('../middleware/responseHandler');
const { authenticate, authorize, enforceTenantIsolation } = require('../middleware/authMiddleware');
const { campaignValidators, uuidParamValidator, validate } = require('../middleware/validationMiddleware');
const AppError = require('../utils/AppError');
const { enqueueCampaign } = require('../workers/messageWorker');

// All campaign routes require authentication
router.use(authenticate);

// ── GET /campaigns ─────────────────────────────────────────────
router.get('/', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId;
  const isSuperAdmin = req.user.role === 'super_admin';

  let queryStr = `SELECT c.*, u.first_name || ' ' || u.last_name AS created_by_name,
            mt.name AS template_name, cl.name AS contact_list_name
     FROM campaigns c
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN message_templates mt ON mt.id = c.template_id
     LEFT JOIN contact_lists cl ON cl.id = c.contact_list_id
     WHERE c.deleted_at IS NULL`;

  const params = [];
  if (!isSuperAdmin && tenantId) {
    queryStr += ` AND c.tenant_id = $1`;
    params.push(tenantId);
    queryStr += ` ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`;
    params.push(parseInt(req.query.limit || 20, 10), parseInt(req.query.offset || 0, 10));
  } else {
    queryStr += ` ORDER BY c.created_at DESC LIMIT $1 OFFSET $2`;
    params.push(parseInt(req.query.limit || 20, 10), parseInt(req.query.offset || 0, 10));
  }

  const { rows } = await query(queryStr, params);
  return sendSuccess(res, rows, 'Campaigns fetched.');
}));

// ── POST /campaigns ────────────────────────────────────────────
router.post('/', campaignValidators, validate, catchAsync(async (req, res) => {
  const { name, templateId, contactListId, scheduledAt, chunkSize, delayMs } = req.body;

  const { rows: [campaign] } = await query(
    `INSERT INTO campaigns (tenant_id, name, template_id, contact_list_id, scheduled_at_utc, chunk_size, delay_ms, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [req.user.tenantId, name, templateId, contactListId, scheduledAt || null, chunkSize || null, delayMs || null, req.user.id]
  );

  return sendCreated(res, campaign, 'Campaign created.');
}));

// ── GET /campaigns/:id ─────────────────────────────────────────
router.get('/:id', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const { rows: [campaign] } = await query(
    `SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [req.params.id, req.user.tenantId]
  );
  if (!campaign) throw new AppError('Campaign not found.', 404, 'ERR_VDAJ_CAMP_001');
  return sendSuccess(res, campaign);
}));

// ── POST /campaigns/:id/launch ─────────────────────────────────
// Critical fix: bulk-inserts campaign_messages FIRST, then fetches them.
router.post('/:id/launch', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const result = await withTransaction(async (client) => {

    // 1. Lock campaign row and validate state
    const { rows: [campaign] } = await client.query(
      `SELECT c.*, t.meta_system_token, t.phone_number_id,
              mt.name AS template_name, mt.language AS template_language
       FROM campaigns c
       JOIN tenants t ON t.id = c.tenant_id
       JOIN message_templates mt ON mt.id = c.template_id
       WHERE c.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL FOR UPDATE`,
      [req.params.id, req.user.tenantId]
    );

    if (!campaign) throw new AppError('Campaign not found.', 404, 'ERR_VDAJ_CAMP_001');
    if (['running', 'completed'].includes(campaign.status)) {
      throw new AppError('Campaign is already running or completed.', 409, 'ERR_VDAJ_CAMP_002');
    }
    if (!campaign.contact_list_id) {
      throw new AppError('Campaign has no contact list assigned.', 400, 'ERR_VDAJ_CAMP_004');
    }
    if (!campaign.meta_system_token) {
      throw new AppError(
        'WhatsApp not configured. Complete setup at /whatsapp-setup first.',
        400,
        'ERR_META_006'
      );
    }

    // 2. ── CRITICAL FIX ──────────────────────────────────────────
    //    Bulk-insert one campaign_message row per active contact in the list.
    //    Uses ON CONFLICT DO NOTHING so replaying a paused campaign is idempotent.
    await client.query(
      `INSERT INTO campaign_messages
         (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
       SELECT $1, $2, c.id, c.phone_e164,
              COALESCE(c.custom_vars, '{}'::jsonb),
              'queued'
       FROM contact_list_members clm
       JOIN contacts c ON c.id = clm.contact_id
       WHERE clm.contact_list_id = $3
         AND c.status = 'active'
       ON CONFLICT DO NOTHING`,
      [campaign.id, req.user.tenantId, campaign.contact_list_id]
    );

    // 3. Fetch the queued messages (now guaranteed to exist if contacts are active)
    const { rows: messages } = await client.query(
      `SELECT cm.id, c.phone_e164, cm.template_vars
       FROM campaign_messages cm
       JOIN contacts c ON c.id = cm.contact_id
       WHERE cm.campaign_id = $1 AND cm.status = 'queued' AND c.status = 'active'`,
      [campaign.id]
    );

    if (messages.length === 0) {
      throw new AppError(
        'No active contacts found in the assigned contact list.',
        400,
        'ERR_VDAJ_CAMP_003'
      );
    }

    // 4. Mark campaign as running and set total_count
    await client.query(
      `UPDATE campaigns
       SET status = 'running', started_at = NOW(), total_count = $1,
           queued_count = $1, updated_at = NOW()
       WHERE id = $2`,
      [messages.length, campaign.id]
    );

    return { campaign, messages };
  });

  // 5. Enqueue OUTSIDE the transaction — Bull is not DB-transactional
  await enqueueCampaign(result.campaign, result.messages);

  return sendSuccess(res, {
    campaignId: result.campaign.id,
    totalMessages: result.messages.length,
  }, 'Campaign launched and queued successfully.');
}));

// ── PATCH /campaigns/:id/pause ─────────────────────────────────
router.patch('/:id/pause', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const { rows: [campaign] } = await query(
    `UPDATE campaigns SET status = 'paused', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status = 'running'
     RETURNING id, status`,
    [req.params.id, req.user.tenantId]
  );
  if (!campaign) throw new AppError('Campaign not found or not currently running.', 404, 'ERR_VDAJ_CAMP_001');
  return sendSuccess(res, campaign, 'Campaign paused.');
}));

// ── DELETE /campaigns/:id ──────────────────────────────────────
router.delete('/:id', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const { rows: [campaign] } = await query(
    `UPDATE campaigns SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status IN ('draft','paused','completed','failed')
     RETURNING id`,
    [req.params.id, req.user.tenantId]
  );
  if (!campaign) throw new AppError('Campaign not found or cannot be deleted in current state.', 404, 'ERR_VDAJ_CAMP_001');
  return sendSuccess(res, null, 'Campaign deleted.');
}));

// ── GET /campaigns/messages — WhatsApp delivery log ────────────
// Returns paginated campaign_messages with campaign + template metadata.
// Query params: status, campaign_id, date_from, date_to, limit, offset
router.get('/messages', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId;
  const {
    status,
    campaign_id,
    date_from,
    date_to,
    limit  = 50,
    offset = 0,
  } = req.query;

  const filters = ['cm.tenant_id = $1', 'cm.deleted_at IS NULL'];
  const params  = [tenantId];
  let   pidx    = 2;

  if (status) {
    filters.push(`cm.status = $${pidx++}`);
    params.push(status);
  }
  if (campaign_id) {
    filters.push(`cm.campaign_id = $${pidx++}`);
    params.push(campaign_id);
  }
  if (date_from) {
    filters.push(`cm.created_at >= $${pidx++}`);
    params.push(new Date(date_from).toISOString());
  }
  if (date_to) {
    // Include the full day_to day by going to end of that day
    const end = new Date(date_to);
    end.setHours(23, 59, 59, 999);
    filters.push(`cm.created_at <= $${pidx++}`);
    params.push(end.toISOString());
  }

  const WHERE = filters.join(' AND ');

  // Main data query
  const { rows } = await query(
    `SELECT
       cm.id,
       cm.phone_e164,
       cm.status,
       cm.sent_at,
       cm.delivered_at,
       cm.read_at,
       cm.failed_at,
       cm.last_error,
       cm.retry_count,
       cm.is_dead_letter,
       cm.created_at,
       -- Campaign
       c.name   AS campaign_name,
       c.id     AS campaign_id,
       -- Template
       mt.name  AS template_name,
       mt.category AS template_category,
       -- Contact
       co.first_name,
       co.last_name
     FROM campaign_messages cm
     LEFT JOIN campaigns         c  ON c.id  = cm.campaign_id
     LEFT JOIN message_templates mt ON mt.id = c.template_id
     LEFT JOIN contacts          co ON co.id = cm.contact_id
     WHERE ${WHERE}
     ORDER BY cm.created_at DESC
     LIMIT $${pidx++} OFFSET $${pidx++}`,
    [...params, Math.min(Number(limit), 200), Number(offset)]
  );

  // Total count for pagination
  const { rows: [{ total }] } = await query(
    `SELECT COUNT(*) AS total FROM campaign_messages cm WHERE ${WHERE}`,
    params
  );

  return sendSuccess(res, {
    messages: rows,
    total: parseInt(total, 10),
    limit:  Number(limit),
    offset: Number(offset),
  }, 'Campaign messages fetched.');
}));

module.exports = router;
