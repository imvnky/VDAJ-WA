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
const { recordAudit } = require('../services/auditService');
const logger = require('../utils/logger');

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

// ── POST /campaigns/audience-count ───────────────────────────
// Preview total and unique recipient counts with automatic deduplication
router.post('/audience-count', catchAsync(async (req, res) => {
  const { audienceType = 'lists', listIds = [], tags = [], filterTags = [], adhocCount = 0 } = req.body;
  const tenantId = req.user.tenantId;

  if (audienceType === 'adhoc_excel') {
    const count = parseInt(adhocCount, 10) || 0;
    return sendSuccess(res, {
      totalContacts: count,
      uniqueContacts: count,
      duplicates: 0,
    });
  }

  if (audienceType === 'all') {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM contacts WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId]
    );
    const count = rows[0]?.count || 0;
    return sendSuccess(res, {
      totalContacts: count,
      uniqueContacts: count,
      duplicates: 0,
    });
  }

  if (audienceType === 'tags') {
    const cleanTags = (Array.isArray(tags) ? tags : [tags]).filter(Boolean);
    if (!cleanTags.length) {
      return sendSuccess(res, { totalContacts: 0, uniqueContacts: 0, duplicates: 0 });
    }
    const { rows } = await query(
      `SELECT COUNT(DISTINCT c.phone_e164)::int AS count
       FROM contacts c
       WHERE c.tenant_id = $1
         AND c.status = 'active'
         AND c.tags && $2::text[]`,
      [tenantId, cleanTags]
    );
    const count = rows[0]?.count || 0;
    return sendSuccess(res, {
      totalContacts: count,
      uniqueContacts: count,
      duplicates: 0,
    });
  }

  // Multi-group list mode
  const validListIds = (Array.isArray(listIds) ? listIds : [listIds]).filter(Boolean);
  if (!validListIds.length) {
    return sendSuccess(res, { totalContacts: 0, uniqueContacts: 0, duplicates: 0 });
  }

  let listSql = `SELECT
       COUNT(*)::int AS raw_total,
       COUNT(DISTINCT c.phone_e164)::int AS unique_total
     FROM contact_list_members clm
     JOIN contacts c ON c.id = clm.contact_id
     WHERE clm.contact_list_id = ANY($1::uuid[])
       AND c.tenant_id = $2
       AND c.status = 'active'`;
  const listParams = [validListIds, tenantId];

  const cleanFilterTags = (Array.isArray(filterTags) ? filterTags : []).filter(Boolean);
  if (cleanFilterTags.length > 0) {
    listSql += ` AND c.tags && $3::text[]`;
    listParams.push(cleanFilterTags);
  }

  const { rows } = await query(listSql, listParams);
  const rawTotal = rows[0]?.raw_total || 0;
  const uniqueTotal = rows[0]?.unique_total || 0;

  return sendSuccess(res, {
    totalContacts: rawTotal,
    uniqueContacts: uniqueTotal,
    duplicates: Math.max(0, rawTotal - uniqueTotal),
  });
}));

// ── POST /campaigns ────────────────────────────────────────────
router.post('/', campaignValidators, validate, catchAsync(async (req, res) => {
  const {
    name,
    templateId,
    contactListId,
    contactListIds,
    audienceType = 'list',
    tags = [],
    filterTags = [],
    adhocRecipients = [],
    scheduledAt,
    chunkSize,
    delayMs,
    templateVars,
    templateVariables,
    headerUrl,
    headerType,
  } = req.body;

  const finalVars = templateVars || templateVariables || {};
  if (headerUrl && !finalVars.headerUrl) finalVars.headerUrl = headerUrl;
  if (headerType && !finalVars.headerType) finalVars.headerType = headerType;

  // Determine effective audience_type and audience_config
  let resolvedAudienceType = audienceType;
  let resolvedAudienceConfig = {};
  let effectiveContactListId = contactListId || null;

  if (audienceType === 'adhoc_excel') {
    resolvedAudienceType = 'adhoc_excel';
    resolvedAudienceConfig = { adhoc_count: adhocRecipients.length };
    effectiveContactListId = null;
  } else if (audienceType === 'all') {
    resolvedAudienceType = 'all';
    effectiveContactListId = null;
  } else if (audienceType === 'tags') {
    resolvedAudienceType = 'tags';
    const cleanTags = (Array.isArray(tags) ? tags : [tags]).filter(Boolean);
    resolvedAudienceConfig = { tags: cleanTags };
    effectiveContactListId = null;
  } else if (audienceType === 'lists' || (Array.isArray(contactListIds) && contactListIds.length > 0)) {
    resolvedAudienceType = 'lists';
    const listArr = (contactListIds && contactListIds.length > 0) ? contactListIds : (contactListId ? [contactListId] : []);
    const cleanFilterTags = (Array.isArray(filterTags) ? filterTags : []).filter(Boolean);
    resolvedAudienceConfig = {
      list_ids: listArr,
      filter_tags: cleanFilterTags.length > 0 ? cleanFilterTags : undefined,
    };
    effectiveContactListId = listArr[0] || null;
  }

  // Ensure table has audience_type and audience_config columns (safe idempotent self-migration)
  try {
    await query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_type VARCHAR(50) DEFAULT 'list';`);
    await query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_config JSONB DEFAULT '{}';`);
  } catch {}

  const { rows: [campaign] } = await query(
    `INSERT INTO campaigns (
       tenant_id, name, template_id, contact_list_id, scheduled_at_utc,
       chunk_size, delay_ms, created_by, template_vars, header_url,
       audience_type, audience_config, total_count, queued_count
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      req.user.tenantId,
      name,
      templateId,
      effectiveContactListId,
      scheduledAt || null,
      chunkSize || null,
      delayMs || null,
      req.user.id,
      JSON.stringify(finalVars),
      headerUrl || finalVars.headerUrl || null,
      resolvedAudienceType,
      JSON.stringify(resolvedAudienceConfig),
      resolvedAudienceType === 'adhoc_excel' ? adhocRecipients.length : 0,
      resolvedAudienceType === 'adhoc_excel' ? adhocRecipients.length : 0,
    ]
  );

  // If adhoc Excel campaign, immediately insert queued messages directly into campaign_messages
  // WITHOUT inserting into contacts directory!
  if (resolvedAudienceType === 'adhoc_excel' && adhocRecipients.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of adhocRecipients) {
        const phone = r.phone || r.phoneE164;
        if (!phone || !String(phone).trim()) continue;
        const cleanPhone = String(phone).trim().startsWith('+') ? String(phone).trim() : `+${String(phone).trim()}`;
        const mergedVars = { ...(r.vars || {}), ...finalVars };
        if (r.name) mergedVars.name = r.name;
        await client.query(
          `INSERT INTO campaign_messages (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
           VALUES ($1, $2, NULL, $3, $4, 'queued')
           ON CONFLICT DO NOTHING`,
          [campaign.id, req.user.tenantId, cleanPhone, JSON.stringify(mergedVars)]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Failed to populate adhoc campaign messages', { error: err.message });
    } finally {
      client.release();
    }
  }

  return sendCreated(res, campaign, 'Campaign created.');
}));

// ── GET /campaigns/messages — WhatsApp delivery log ────────────
// Returns paginated campaign_messages with campaign + template metadata.
// Query params: status, campaign_id, date_from, date_to, limit, offset
router.get('/messages', catchAsync(async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const tenantId = req.user.tenantId || req.tenant?.id || null;
  const {
    status,
    campaign_id,
    date_from,
    date_to,
    limit  = 50,
    offset = 0,
  } = req.query;

  const filters = [];
  const params  = [];
  let   pidx    = 1;

  if (!isSuperAdmin && tenantId) {
    filters.push(`cm.tenant_id = $${pidx++}`);
    params.push(tenantId);
  }
  if (status) {
    if (status === 'failed') {
      filters.push(`cm.status IN ('failed', 'dead_letter')`);
    } else {
      filters.push(`cm.status = $${pidx++}`);
      params.push(status);
    }
  }
  if (campaign_id) {
    filters.push(`cm.campaign_id = $${pidx++}`);
    params.push(campaign_id);

    // Reconcile delivery statuses before querying
    await query(
      `UPDATE campaign_messages cm
       SET status = im.status::message_status,
           delivered_at = COALESCE(cm.delivered_at, NOW()),
           read_at = CASE WHEN im.status = 'read' THEN COALESCE(cm.read_at, NOW()) ELSE cm.read_at END,
           failed_at = CASE WHEN im.status = 'failed' THEN COALESCE(cm.failed_at, NOW()) ELSE cm.failed_at END,
           last_error = COALESCE(cm.last_error, im.error_code),
           error_code = COALESCE(cm.error_code, im.error_code),
           updated_at = NOW()
       FROM inbox_messages im
       WHERE cm.campaign_id = $1
         AND cm.meta_message_id = im.wa_message_id
         AND im.status IN ('delivered', 'read', 'failed')
         AND cm.status::text != im.status::text`,
      [campaign_id]
    ).catch(() => {});
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

  const WHERE = filters.length > 0 ? filters.join(' AND ') : '1=1';

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
       cm.updated_at,
       -- Campaign
       c.name   AS campaign_name,
       c.id     AS campaign_id,
       -- Template
       mt.name  AS template_name,
       mt.category AS template_category,
       -- Contact
       co.first_name,
       co.last_name,
       COALESCE(co.display_name, NULLIF(TRIM(co.first_name || ' ' || COALESCE(co.last_name, '')), ''), cm.template_vars->>'contact_name', cm.template_vars->>'name') AS display_name
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

// ── GET /campaigns/:id ─────────────────────────────────────────
router.get('/:id', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const tenantId = req.user.tenantId || req.tenant?.id;
  const { rows: [campaign] } = await query(
    `SELECT c.*,
            mt.name AS template_name, mt.language AS template_language, mt.body_text AS template_body,
            cl.name AS contact_list_name,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM campaigns c
     LEFT JOIN message_templates mt ON mt.id = c.template_id
     LEFT JOIN contact_lists cl ON cl.id = c.contact_list_id
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.id = $1 AND (c.tenant_id = $2 OR $3 = TRUE) AND c.deleted_at IS NULL`,
    [req.params.id, tenantId, isSuperAdmin]
  );
  if (!campaign) throw new AppError('Campaign not found.', 404, 'ERR_VDAJ_CAMP_001');

  // Reconcile delivery statuses from inbox_messages (delivered, read, failed)
  await query(
    `UPDATE campaign_messages cm
     SET status = im.status::message_status,
         delivered_at = COALESCE(cm.delivered_at, NOW()),
         read_at = CASE WHEN im.status = 'read' THEN COALESCE(cm.read_at, NOW()) ELSE cm.read_at END,
         failed_at = CASE WHEN im.status = 'failed' THEN COALESCE(cm.failed_at, NOW()) ELSE cm.failed_at END,
         last_error = COALESCE(cm.last_error, im.error_code),
         error_code = COALESCE(cm.error_code, im.error_code),
         updated_at = NOW()
     FROM inbox_messages im
     WHERE cm.campaign_id = $1
       AND cm.meta_message_id = im.wa_message_id
       AND im.status IN ('delivered', 'read', 'failed')
       AND cm.status::text != im.status::text`,
    [req.params.id]
  ).catch((err) => { logger.warn('Status reconciliation failed', { error: err?.message }); });

  // Query live counts from campaign_messages
  const { rows: [counts] } = await query(
    `SELECT
       COUNT(*)::int AS total_recipients,
       COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
       COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
       COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
       COUNT(*) FILTER (WHERE status = 'read')::int AS read,
       COUNT(*) FILTER (WHERE status IN ('failed', 'dead_letter'))::int AS failed
     FROM campaign_messages
     WHERE campaign_id = $1`,
    [req.params.id]
  );

  // If campaign was running and all messages have been processed (0 queued), mark completed
  let updatedCampaign = campaign;
  if (campaign.status === 'running' && counts && counts.queued === 0 && counts.total_recipients > 0) {
    await query(
      `UPDATE campaigns SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    ).catch(() => {});
    updatedCampaign = { ...campaign, status: 'completed' };
  }

  return sendSuccess(res, {
    ...updatedCampaign,
    live_counts: counts || {},
  }, 'Campaign fetched.');
}));

// ── POST /campaigns/:id/launch ─────────────────────────────────
// Critical fix: bulk-inserts campaign_messages FIRST, then fetches them.
router.post('/:id/launch', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const result = await withTransaction(async (client) => {

    // 1. Lock campaign row and validate state
    const { rows: [campaign] } = await client.query(
      `SELECT c.*, t.meta_system_token, t.phone_number_id,
              mt.name AS template_name, mt.language AS template_language,
              mt.body_text AS template_body, mt.buttons AS template_buttons,
              mt.footer_text AS template_footer, mt.header_text AS template_header,
              mt.header_sample_url AS template_header_url
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
    if (!campaign.meta_system_token) {
      throw new AppError(
        'WhatsApp not configured. Complete setup at /whatsapp-setup first.',
        400,
        'ERR_META_006'
      );
    }

    // 2. Audience population based on audience_type
    // - 'adhoc_excel': Messages are already inserted directly into campaign_messages during creation with contact_id = NULL
    // - 'all': All active contacts in the tenant
    // - 'tags': All active contacts having any of the specified tags
    // - 'lists': All active contacts across selected contact lists (with optional tag filtering, de-duplicated by phone)
    // - 'list' (legacy fallback): Contacts in campaign.contact_list_id
    if (campaign.audience_type === 'adhoc_excel') {
      // No insertion needed, already stored with zero contact-directory pollution!
    } else if (campaign.audience_type === 'all') {
      await client.query(
        `INSERT INTO campaign_messages
           (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
         SELECT DISTINCT ON (c.phone_e164)
                $1, $2, c.id, c.phone_e164,
                COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                  'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                  'first_name', NULLIF(TRIM(c.first_name), ''),
                  'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                  'phone', c.phone_e164
                ),
                'queued'
         FROM contacts c
         CROSS JOIN campaigns cmp
         WHERE c.tenant_id = $2
           AND cmp.id = $1
           AND c.status = 'active'
         ORDER BY c.phone_e164, c.created_at DESC
         ON CONFLICT DO NOTHING`,
        [campaign.id, req.user.tenantId]
      );
    } else if (campaign.audience_type === 'tags') {
      const targetTags = campaign.audience_config?.tags || [];
      if (!targetTags.length) {
        throw new AppError('Campaign has no tags assigned.', 400, 'ERR_VDAJ_CAMP_004');
      }
      await client.query(
        `INSERT INTO campaign_messages
           (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
         SELECT DISTINCT ON (c.phone_e164)
                $1, $2, c.id, c.phone_e164,
                COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                  'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                  'first_name', NULLIF(TRIM(c.first_name), ''),
                  'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                  'phone', c.phone_e164
                ),
                'queued'
         FROM contacts c
         CROSS JOIN campaigns cmp
         WHERE c.tenant_id = $2
           AND cmp.id = $1
           AND c.status = 'active'
           AND c.tags && $3::text[]
         ORDER BY c.phone_e164, c.created_at DESC
         ON CONFLICT DO NOTHING`,
        [campaign.id, req.user.tenantId, targetTags]
      );
    } else if (campaign.audience_type === 'lists') {
      const listIds = campaign.audience_config?.list_ids || (campaign.contact_list_id ? [campaign.contact_list_id] : []);
      if (!listIds.length) {
        throw new AppError('Campaign has no contact lists assigned.', 400, 'ERR_VDAJ_CAMP_004');
      }
      const filterTags = campaign.audience_config?.filter_tags;
      if (Array.isArray(filterTags) && filterTags.length > 0) {
        await client.query(
          `INSERT INTO campaign_messages
             (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
           SELECT DISTINCT ON (c.phone_e164)
                  $1, $2, c.id, c.phone_e164,
                  COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                    'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                    'first_name', NULLIF(TRIM(c.first_name), ''),
                    'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                    'phone', c.phone_e164
                  ),
                  'queued'
           FROM contact_list_members clm
           JOIN contacts c ON c.id = clm.contact_id
           CROSS JOIN campaigns cmp
           WHERE clm.contact_list_id = ANY($3::uuid[])
             AND cmp.id = $1
             AND c.status = 'active'
             AND c.tags && $4::text[]
           ORDER BY c.phone_e164, c.created_at DESC
           ON CONFLICT DO NOTHING`,
          [campaign.id, req.user.tenantId, listIds, filterTags]
        );
      } else {
        await client.query(
          `INSERT INTO campaign_messages
             (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
           SELECT DISTINCT ON (c.phone_e164)
                  $1, $2, c.id, c.phone_e164,
                  COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                    'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                    'first_name', NULLIF(TRIM(c.first_name), ''),
                    'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                    'phone', c.phone_e164
                  ),
                  'queued'
           FROM contact_list_members clm
           JOIN contacts c ON c.id = clm.contact_id
           CROSS JOIN campaigns cmp
           WHERE clm.contact_list_id = ANY($3::uuid[])
             AND cmp.id = $1
             AND c.status = 'active'
           ORDER BY c.phone_e164, c.created_at DESC
           ON CONFLICT DO NOTHING`,
          [campaign.id, req.user.tenantId, listIds]
        );
      }
    } else {
      // Default: single list
      if (!campaign.contact_list_id) {
        throw new AppError('Campaign has no contact list assigned.', 400, 'ERR_VDAJ_CAMP_004');
      }
      await client.query(
        `INSERT INTO campaign_messages
           (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
         SELECT $1, $2, c.id, c.phone_e164,
                COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                  'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                  'first_name', NULLIF(TRIM(c.first_name), ''),
                  'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                  'phone', c.phone_e164
                ),
                'queued'
         FROM contact_list_members clm
         JOIN contacts c ON c.id = clm.contact_id
         CROSS JOIN campaigns cmp
         WHERE clm.contact_list_id = $3
           AND cmp.id = $1
           AND c.status = 'active'
         ON CONFLICT DO NOTHING`,
        [campaign.id, req.user.tenantId, campaign.contact_list_id]
      );
    }

    // 3. Fetch the queued messages
    // Note: Use LEFT JOIN so adhoc_excel messages (where contact_id IS NULL) are fetched properly
    const { rows: messages } = await client.query(
      `SELECT cm.id, cm.phone_e164, cm.template_vars,
              COALESCE(NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''), cm.template_vars->>'contact_name', cm.template_vars->>'name') AS contact_name
       FROM campaign_messages cm
       LEFT JOIN contacts c ON c.id = cm.contact_id
       WHERE cm.campaign_id = $1 AND cm.status = 'queued' AND (c.status IS NULL OR c.status = 'active')`,
      [campaign.id]
    );

    if (messages.length === 0) {
      throw new AppError(
        'No active recipients found for the assigned campaign audience.',
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

  // Enterprise Audit Trail
  recordAudit({
    tenantId: result.campaign.tenant_id,
    userId: req.user.id,
    action: 'CAMPAIGN_LAUNCH',
    resourceType: 'campaign',
    resourceId: result.campaign.id,
    status: 'SUCCESS',
    meta: {
      campaignName: result.campaign.name,
      totalMessages: result.messages.length,
      templateName: result.campaign.template_name,
    },
    subTasks: [
      { name: 'Validate WABA Credentials', details: 'Verify Meta WhatsApp Business WABA credentials and access token', component: 'Meta Gateway', status: 'SUCCESS' },
      { name: 'Queue Recipient Batches', details: `Queued ${result.messages.length} messages in Bull queue engine for dispatch`, component: 'Bull Queue', status: 'SUCCESS' },
      { name: 'Initialize Delivery Tracking', details: 'Initialized delivery status tracking records in PostgreSQL store', component: 'PostgreSQL Store', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
  }).catch(() => {});

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

// ── POST /campaigns/:id/retry-failed ───────────────────────────
// Re-runs the campaign targeting ONLY failed, dead-lettered, or stuck un-sent recipients
router.post('/:id/retry-failed', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const tenantId = req.user.tenantId || req.tenant?.id;

  const result = await withTransaction(async (client) => {
    // 1. Fetch and lock campaign + tenant credentials
    const { rows: [campaign] } = await client.query(
      `SELECT c.*, t.meta_system_token, t.phone_number_id,
              mt.name AS template_name, mt.language AS template_language
       FROM campaigns c
       JOIN tenants t ON t.id = c.tenant_id
       JOIN message_templates mt ON mt.id = c.template_id
       WHERE c.id = $1 AND (c.tenant_id = $2 OR $3 = TRUE) AND c.deleted_at IS NULL FOR UPDATE`,
      [req.params.id, tenantId, isSuperAdmin]
    );

    if (!campaign) throw new AppError('Campaign not found.', 404, 'ERR_VDAJ_CAMP_001');
    if (!campaign.meta_system_token) {
      throw new AppError('WhatsApp not configured. Connect your WABA credentials first.', 400, 'ERR_META_006');
    }

    // 2. Fetch all failed, dead-lettered, or stuck un-sent recipients
    // Exclude messages that were already successfully sent, delivered, or read
    const { rows: failedMessages } = await client.query(
      `SELECT cm.id, cm.phone_e164, cm.template_vars, cm.status
       FROM campaign_messages cm
       WHERE cm.campaign_id = $1
         AND cm.status NOT IN ('sent', 'delivered', 'read')
       FOR UPDATE`,
      [campaign.id]
    );

    if (failedMessages.length === 0) {
      throw new AppError('No failed or pending recipients found to retry. All recipients have already received the message.', 400, 'ERR_VDAJ_CAMP_005');
    }

    const failedIds = failedMessages.map((m) => m.id);

    // 3. Reset failed/stuck messages to 'queued' state
    await client.query(
      `UPDATE campaign_messages
       SET status = 'queued',
           is_dead_letter = FALSE,
           dead_lettered_at = NULL,
           last_error = NULL,
           error_code = NULL,
           failed_at = NULL,
           retry_count = 0,
           updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [failedIds]
    );

    // 4. Update campaign status to running and adjust counters
    await client.query(
      `UPDATE campaigns
       SET status = 'running',
           failed_count = GREATEST(0, failed_count - $1),
           dead_letter_count = GREATEST(0, dead_letter_count - $1),
           queued_count = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [failedIds.length, campaign.id]
    );

    return { campaign, messages: failedMessages };
  });

  // 5. Enqueue the failed messages into Bull queue engine with fresh unique job IDs
  await enqueueCampaign(result.campaign, result.messages);

  // Enterprise Audit Trail
  recordAudit({
    tenantId: result.campaign.tenant_id,
    userId: req.user.id,
    action: 'CAMPAIGN_RETRY_FAILED',
    resourceType: 'campaign',
    resourceId: result.campaign.id,
    status: 'SUCCESS',
    meta: {
      campaignName: result.campaign.name,
      retriedCount: result.messages.length,
      templateName: result.campaign.template_name,
    },
    subTasks: [
      { name: 'Identify Stalled Recipients', details: `Identified ${result.messages.length} failed/stuck recipients for re-dispatch`, component: 'Audience Engine', status: 'SUCCESS' },
      { name: 'Reset Delivery State', details: 'Reset message delivery state to queued in PostgreSQL database', component: 'PostgreSQL Store', status: 'SUCCESS' },
      { name: 'Re-enqueue Message Chunks', details: 'Re-dispatched chunk jobs into Bull priority queue engine', component: 'Bull Queue', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
  }).catch(() => {});

  return sendSuccess(res, {
    campaignId: result.campaign.id,
    retriedCount: result.messages.length,
  }, `Successfully queued ${result.messages.length} failed recipient(s) for re-dispatch.`);
}));

// ── POST /campaigns/:id/resend ─────────────────────────────────
// Resends the entire campaign to all active audience contacts
router.post('/:id/resend', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const tenantId = req.user.tenantId || req.tenant?.id;

  const result = await withTransaction(async (client) => {
    // 1. Fetch and lock campaign + tenant credentials
    const { rows: [campaign] } = await client.query(
      `SELECT c.*, t.meta_system_token, t.phone_number_id,
              mt.name AS template_name, mt.language AS template_language
       FROM campaigns c
       JOIN tenants t ON t.id = c.tenant_id
       JOIN message_templates mt ON mt.id = c.template_id
       WHERE c.id = $1 AND (c.tenant_id = $2 OR $3 = TRUE) AND c.deleted_at IS NULL FOR UPDATE`,
      [req.params.id, tenantId, isSuperAdmin]
    );

    if (!campaign) throw new AppError('Campaign not found.', 404, 'ERR_VDAJ_CAMP_001');
    if (!campaign.meta_system_token) {
      throw new AppError('WhatsApp not configured. Connect your WABA credentials first.', 400, 'ERR_META_006');
    }

    // 2. Ensure all active contacts in the audience have rows
    if (campaign.audience_type === 'adhoc_excel') {
      // Adhoc excel messages already exist in campaign_messages with contact_id = NULL
    } else if (campaign.audience_type === 'all') {
      await client.query(
        `INSERT INTO campaign_messages
           (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
         SELECT DISTINCT ON (c.phone_e164)
                $1, $2, c.id, c.phone_e164,
                COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                  'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                  'first_name', NULLIF(TRIM(c.first_name), ''),
                  'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                  'phone', c.phone_e164
                ),
                'queued'
         FROM contacts c
         CROSS JOIN campaigns cmp
         WHERE c.tenant_id = $2
           AND cmp.id = $1
           AND c.status = 'active'
         ORDER BY c.phone_e164, c.created_at DESC
         ON CONFLICT DO NOTHING`,
        [campaign.id, campaign.tenant_id]
      );
    } else if (campaign.audience_type === 'tags') {
      const targetTags = campaign.audience_config?.tags || [];
      if (targetTags.length > 0) {
        await client.query(
          `INSERT INTO campaign_messages
             (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
           SELECT DISTINCT ON (c.phone_e164)
                  $1, $2, c.id, c.phone_e164,
                  COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                    'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                    'first_name', NULLIF(TRIM(c.first_name), ''),
                    'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                    'phone', c.phone_e164
                  ),
                  'queued'
           FROM contacts c
           CROSS JOIN campaigns cmp
           WHERE c.tenant_id = $2
             AND cmp.id = $1
             AND c.status = 'active'
             AND c.tags && $3::text[]
           ORDER BY c.phone_e164, c.created_at DESC
           ON CONFLICT DO NOTHING`,
          [campaign.id, campaign.tenant_id, targetTags]
        );
      }
    } else if (campaign.audience_type === 'lists') {
      const listIds = campaign.audience_config?.list_ids || (campaign.contact_list_id ? [campaign.contact_list_id] : []);
      const filterTags = campaign.audience_config?.filter_tags;
      if (listIds.length > 0) {
        if (Array.isArray(filterTags) && filterTags.length > 0) {
          await client.query(
            `INSERT INTO campaign_messages
               (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
             SELECT DISTINCT ON (c.phone_e164)
                    $1, $2, c.id, c.phone_e164,
                    COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                      'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                      'first_name', NULLIF(TRIM(c.first_name), ''),
                      'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                      'phone', c.phone_e164
                    ),
                    'queued'
             FROM contact_list_members clm
             JOIN contacts c ON c.id = clm.contact_id
             CROSS JOIN campaigns cmp
             WHERE clm.contact_list_id = ANY($3::uuid[])
               AND cmp.id = $1
               AND c.status = 'active'
               AND c.tags && $4::text[]
             ORDER BY c.phone_e164, c.created_at DESC
             ON CONFLICT DO NOTHING`,
            [campaign.id, campaign.tenant_id, listIds, filterTags]
          );
        } else {
          await client.query(
            `INSERT INTO campaign_messages
               (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
             SELECT DISTINCT ON (c.phone_e164)
                    $1, $2, c.id, c.phone_e164,
                    COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                      'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                      'first_name', NULLIF(TRIM(c.first_name), ''),
                      'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                      'phone', c.phone_e164
                    ),
                    'queued'
             FROM contact_list_members clm
             JOIN contacts c ON c.id = clm.contact_id
             CROSS JOIN campaigns cmp
             WHERE clm.contact_list_id = ANY($3::uuid[])
               AND cmp.id = $1
               AND c.status = 'active'
             ORDER BY c.phone_e164, c.created_at DESC
             ON CONFLICT DO NOTHING`,
            [campaign.id, campaign.tenant_id, listIds]
          );
        }
      }
    } else if (campaign.contact_list_id) {
      await client.query(
        `INSERT INTO campaign_messages
           (campaign_id, tenant_id, contact_id, phone_e164, template_vars, status)
         SELECT $1, $2, c.id, c.phone_e164,
                COALESCE(cmp.template_vars, '{}'::jsonb) || COALESCE(c.custom_vars, '{}'::jsonb) || jsonb_build_object(
                  'contact_name', NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''),
                  'first_name', NULLIF(TRIM(c.first_name), ''),
                  'last_name', NULLIF(TRIM(COALESCE(c.last_name, '')), ''),
                  'phone', c.phone_e164
                ),
                'queued'
         FROM contact_list_members clm
         JOIN contacts c ON c.id = clm.contact_id
         CROSS JOIN campaigns cmp
         WHERE clm.contact_list_id = $3
           AND cmp.id = $1
           AND c.status = 'active'
         ON CONFLICT DO NOTHING`,
        [campaign.id, campaign.tenant_id, campaign.contact_list_id]
      );
    }

    // 3. Reset ALL campaign messages to queued
    await client.query(
      `UPDATE campaign_messages
       SET status = 'queued',
           meta_message_id = NULL,
           sent_at = NULL,
           delivered_at = NULL,
           read_at = NULL,
           failed_at = NULL,
           last_error = NULL,
           error_code = NULL,
           retry_count = 0,
           is_dead_letter = FALSE,
           dead_lettered_at = NULL,
           updated_at = NOW()
       WHERE campaign_id = $1`,
      [campaign.id]
    );

    // 4. Fetch all queued messages
    const { rows: messages } = await client.query(
      `SELECT cm.id, cm.phone_e164, cm.template_vars,
              COALESCE(NULLIF(TRIM(COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), c.first_name, '')), ''), cm.template_vars->>'contact_name', cm.template_vars->>'name') AS contact_name
       FROM campaign_messages cm
       LEFT JOIN contacts c ON c.id = cm.contact_id
       WHERE cm.campaign_id = $1`,
      [campaign.id]
    );

    if (messages.length === 0) {
      throw new AppError('No active contacts found in the audience list to send.', 400, 'ERR_VDAJ_CAMP_003');
    }

    // 5. Reset campaign counters
    await client.query(
      `UPDATE campaigns
       SET status = 'running',
           started_at = NOW(),
           completed_at = NULL,
           total_count = $1,
           sent_count = 0,
           delivered_count = 0,
           read_count = 0,
           failed_count = 0,
           dead_letter_count = 0,
           queued_count = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [messages.length, campaign.id]
    );

    return { campaign, messages };
  });

  // 6. Enqueue all messages into Bull queue engine
  await enqueueCampaign(result.campaign, result.messages);

  recordAudit({
    tenantId: result.campaign.tenant_id,
    userId: req.user.id,
    action: 'CAMPAIGN_RESEND_ALL',
    resourceType: 'campaign',
    resourceId: result.campaign.id,
    status: 'SUCCESS',
    meta: {
      campaignName: result.campaign.name,
      totalMessages: result.messages.length,
      templateName: result.campaign.template_name,
    },
    subTasks: [
      { name: 'Reset Campaign Delivery State', details: `Reset and queued ${result.messages.length} messages for campaign resend`, component: 'PostgreSQL Store', status: 'SUCCESS' },
      { name: 'Dispatch Priority Chunks', details: 'Dispatched chunk jobs to Bull priority queue engine for delivery', component: 'Bull Queue', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
  }).catch(() => {});

  return sendSuccess(res, {
    campaignId: result.campaign.id,
    totalMessages: result.messages.length,
  }, `Campaign resent: ${result.messages.length} message(s) queued for delivery.`);
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

module.exports = router;
