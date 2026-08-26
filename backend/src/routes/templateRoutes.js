/**
 * VDAJ Services — Template Routes
 *
 * GET  /templates          — List all templates for tenant
 * POST /templates          — Create + submit to Meta Graph API for approval
 * GET  /templates/:id      — Single template
 * POST /templates/:id/sync — Pull latest approval status from Meta
 *
 * FIXES:
 *  - POST /templates now calls createMetaTemplate() → submits to Meta → stores metaTemplateId
 *  - POST /templates/:id/sync polls Meta for approval status updates
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { sendSuccess, sendCreated, catchAsync } = require('../middleware/responseHandler');
const { authenticate } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const AppError = require('../utils/AppError');
const { createMetaTemplate, syncMetaTemplateStatus } = require('../services/metaApiService');

router.use(authenticate, requireTenant);

// ── GET /templates ─────────────────────────────────────────────
router.get('/', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId;
  const isSuperAdmin = req.user.role === 'super_admin';

  let queryStr = `SELECT * FROM message_templates WHERE deleted_at IS NULL`;
  const params = [];
  if (!isSuperAdmin && tenantId) {
    queryStr += ` AND tenant_id = $1`;
    params.push(tenantId);
  }
  queryStr += ` ORDER BY created_at DESC`;

  const { rows } = await query(queryStr, params);
  return sendSuccess(res, rows, 'Templates fetched.');
}));

// ── POST /templates — Create locally + submit to Meta ──────────
router.post('/', catchAsync(async (req, res) => {
  const { name, category, language, bodyText, headerText, footerText, buttons, variablesSchema } = req.body;

  if (!name?.trim() || !bodyText?.trim()) {
    throw new AppError('name and bodyText are required.', 400, 'ERR_VDAJ_VAL_001');
  }

  // ── BSP Compliance: marketing templates MUST contain opt-out text ──
  // Meta's template policy requires that marketing (promotional) templates
  // inform recipients how to stop receiving messages. Templates submitted
  // without this are routinely rejected by Meta's review team.
  //
  // Accepted phrases (case-insensitive): STOP, unsubscribe, opt out,
  // opt-out, optout, no more — any of these satisfy the requirement.
  const resolvedCategory = (category || 'marketing').toLowerCase();
  if (resolvedCategory === 'marketing') {
    const OPT_OUT_REGEX = /\b(stop|unsubscribe|opt.?out|no more)\b/i;
    if (!OPT_OUT_REGEX.test(bodyText)) {
      throw new AppError(
        'Marketing templates must include an opt-out instruction in the message body ' +
        '(e.g. "Reply STOP to unsubscribe"). Meta will reject templates without this.',
        400,
        'ERR_TEMPLATE_NO_OPTOUT'
      );
    }
  }

  // Insert local record first (status = 'pending')
  const { rows: [template] } = await query(
    `INSERT INTO message_templates
       (tenant_id, name, category, language, body_text, header_text, footer_text,
        buttons, variables_schema, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
     RETURNING *`,
    [
      req.user.tenantId,
      name.trim().toLowerCase().replace(/\s+/g, '_'),
      resolvedCategory,
      language || 'en',
      bodyText,
      headerText || null,
      footerText || null,
      JSON.stringify(buttons || []),
      JSON.stringify(variablesSchema || []),
      req.user.id,
    ]
  );

  // Attempt Meta submission — non-fatal if credentials missing
  const { wabaId, metaSystemToken } = req.tenant || {};

  if (wabaId && metaSystemToken) {
    try {
      const { metaTemplateId, status: metaStatus } = await createMetaTemplate(
        { wabaId, accessToken: metaSystemToken },
        template
      );

      // Update local record with Meta's ID + status
      const { rows: [updated] } = await query(
        `UPDATE message_templates
         SET meta_template_id = $1, status = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [metaTemplateId, metaStatus, template.id]
      );

      return sendCreated(
        res,
        updated,
        `Template submitted to Meta. Status: ${metaStatus}.`
      );
    } catch (metaErr) {
      // Log Meta error but don't fail the request — template is saved locally
      // The tenant can retry submission via POST /templates/:id/sync
      req.metaError = metaErr.message;
    }
  }

  return sendCreated(
    res,
    template,
    wabaId && metaSystemToken
      ? `Template saved locally but Meta submission failed: ${req.metaError}. Retry via /templates/${template.id}/sync.`
      : 'Template saved locally. Connect WhatsApp (at /whatsapp-setup) to submit to Meta for approval.'
  );
}));

// ── GET /templates/:id ─────────────────────────────────────────
router.get('/:id', catchAsync(async (req, res) => {
  const { rows: [template] } = await query(
    `SELECT * FROM message_templates
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [req.params.id, req.user.tenantId]
  );
  if (!template) throw new AppError('Template not found.', 404, 'ERR_VDAJ_TMPL_001');
  return sendSuccess(res, template);
}));

// ── POST /templates/:id/sync — Pull latest Meta approval status ─
router.post('/:id/sync', catchAsync(async (req, res) => {
  const { rows: [template] } = await query(
    `SELECT * FROM message_templates
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [req.params.id, req.user.tenantId]
  );
  if (!template) throw new AppError('Template not found.', 404, 'ERR_VDAJ_TMPL_001');

  if (!template.meta_template_id) {
    // Not yet submitted — attempt initial submission now
    const { wabaId, metaSystemToken } = req.tenant || {};
    if (!wabaId || !metaSystemToken) {
      throw new AppError(
        'WhatsApp not configured. Connect at /whatsapp-setup first.',
        400,
        'ERR_META_006'
      );
    }

    const { metaTemplateId, status: metaStatus } = await createMetaTemplate(
      { wabaId, accessToken: metaSystemToken },
      template
    );

    const { rows: [updated] } = await query(
      `UPDATE message_templates
       SET meta_template_id = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [metaTemplateId, metaStatus, template.id]
    );

    return sendSuccess(res, updated, `Template submitted to Meta. Status: ${metaStatus}.`);
  }

  // Already submitted — poll Meta for current approval status
  const { wabaId, metaSystemToken } = req.tenant || {};
  if (!wabaId || !metaSystemToken) {
    throw new AppError('WhatsApp credentials missing.', 400, 'ERR_META_006');
  }

  const { status: metaStatus, rejectionReason } = await syncMetaTemplateStatus(
    wabaId,
    metaSystemToken,
    template.meta_template_id
  );

  const { rows: [updated] } = await query(
    `UPDATE message_templates
     SET status = $1,
         rejection_reason = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [metaStatus, rejectionReason, template.id]
  );

  return sendSuccess(res, updated, `Template status synced: ${metaStatus}.`);
}));

module.exports = router;
