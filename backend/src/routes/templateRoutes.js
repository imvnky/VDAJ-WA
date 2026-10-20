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
const { createMetaTemplate, syncMetaTemplateStatus, fetchMetaTemplates } = require('../services/metaApiService');
const { recordAudit } = require('../services/auditService');

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
  const { name, category, language, bodyText, headerText, headerType, headerSampleUrl, footerText, buttons, variablesSchema, bodySampleValues } = req.body;

  if (!name?.trim() || !bodyText?.trim()) {
    throw new AppError('name and bodyText are required.', 400, 'ERR_VDAJ_VAL_001');
  }

  const resolvedHeaderType = (headerType || (headerText ? 'TEXT' : 'NONE')).toUpperCase();

  // ── BSP Compliance: marketing templates MUST contain opt-out text ──
  const resolvedCategory = (category || 'marketing').toLowerCase();
  if (resolvedCategory === 'marketing') {
    const OPT_OUT_REGEX = /\b(stop|unsubscribe|opt.?out|no more)\b/i;
    if (!OPT_OUT_REGEX.test(bodyText) && !OPT_OUT_REGEX.test(footerText || '')) {
      throw new AppError(
        'Marketing templates must include an opt-out instruction in the message body or footer ' +
        '(e.g. "Reply STOP to unsubscribe"). Meta will reject templates without this.',
        400,
        'ERR_TEMPLATE_NO_OPTOUT'
      );
    }
  }

  // Insert local record first (status = 'pending')
  const { rows: [template] } = await query(
    `INSERT INTO message_templates
       (tenant_id, name, category, language, body_text, header_text, header_type, header_sample_url, footer_text,
        buttons, variables_schema, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
     RETURNING *`,
    [
      req.user.tenantId,
      name.trim().toLowerCase().replace(/\s+/g, '_'),
      resolvedCategory,
      language || 'en',
      bodyText,
      headerText || null,
      resolvedHeaderType,
      headerSampleUrl || null,
      footerText || null,
      JSON.stringify(buttons || []),
      JSON.stringify(variablesSchema || []),
      req.user.id,
    ]
  );

  // Attempt Meta submission — non-fatal if credentials missing
  const effectiveWabaId = req.tenant?.waba_id || req.tenant?.wabaId || process.env.META_WABA_ID;
  const effectiveToken  = req.tenant?.meta_system_token || req.tenant?.metaSystemToken || req.tenant?.whatsapp_access_token || process.env.META_ACCESS_TOKEN;

  if (effectiveWabaId && effectiveToken) {
    try {
      template.body_sample_values = bodySampleValues;
      const { metaTemplateId, status: metaStatus } = await createMetaTemplate(
        { wabaId: effectiveWabaId, accessToken: effectiveToken },
        template
      );

      // Update local record with Meta's ID + status
      const { rows: [updated] } = await query(
        `UPDATE message_templates
         SET meta_template_id = $1, status = $2, rejection_reason = NULL, updated_at = NOW()
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
      const reason = metaErr.message || 'Meta submission failed.';
      await query(
        `UPDATE message_templates
         SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [`Meta submission rejected: ${reason}`, template.id]
      );

      throw new AppError(
        `Template saved, but Meta rejected submission: ${reason}`,
        metaErr.statusCode || 400,
        metaErr.errorCode || 'ERR_META_SUBMISSION_FAILED'
      );
    }
  } else {
    await query(
      `UPDATE message_templates
       SET status = 'rejected', rejection_reason = 'WhatsApp credentials not configured for this workspace.', updated_at = NOW()
       WHERE id = $1`,
      [template.id]
    );
    throw new AppError(
      'WhatsApp credentials not configured for this workspace. Please configure WABA ID and Access Token in Settings.',
      400,
      'ERR_META_006'
    );
  }

  recordAudit({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    action: template.meta_template_id ? 'TEMPLATE_SUBMITTED' : 'TEMPLATE_CREATED',
    resourceType: 'template',
    resourceId: template.id,
    status: template.meta_template_id ? 'SUCCESS' : (req.metaError ? 'WARNING' : 'SUCCESS'),
    meta: {
      templateName: template.name,
      category: template.category,
      language: template.language,
      metaTemplateId: template.meta_template_id || null,
      metaError: req.metaError || null,
    },
    subTasks: [
      { name: 'Schema & Opt-out Policy Validation', details: `Validated ${template.category} opt-out guidelines and variables`, component: 'Compliance Engine', status: 'SUCCESS' },
      { name: 'Template Record Persistence', details: `Saved template definition in PostgreSQL store`, component: 'PostgreSQL Store', status: 'SUCCESS' },
      ...(template.meta_template_id ? [{ name: 'Meta Review Submission', details: `Submitted to Meta Graph API (ID: ${template.meta_template_id})`, component: 'Meta Graph API', status: 'SUCCESS' }] : []),
    ],
    ipAddress: req.ip,
  }).catch(() => {});

  return sendCreated(
    res,
    template,
    effectiveWabaId && effectiveToken
      ? `Template saved locally but Meta submission failed: ${req.metaError}. Retry via /templates/${template.id}/sync.`
      : 'Template saved locally. Connect WhatsApp (at /whatsapp-setup) to submit to Meta for approval.'
  );
}));

// ── POST /templates/sync — Bulk import/sync all templates from Meta Graph API ─
router.post('/sync', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId;
  const isSuperAdmin = req.user.role === 'super_admin';

  let tenant = req.tenant;
  if ((!tenant?.waba_id && !tenant?.wabaId) && tenantId) {
    const { rows: [t] } = await query(
      `SELECT waba_id, meta_system_token, phone_number_id FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (t) tenant = t;
  }

  const effectiveWabaId = tenant?.waba_id || tenant?.wabaId || process.env.META_WABA_ID;
  const effectiveToken  = tenant?.meta_system_token || tenant?.metaSystemToken || tenant?.whatsapp_access_token || process.env.META_ACCESS_TOKEN;

  if (!effectiveWabaId || !effectiveToken) {
    throw new AppError(
      'WhatsApp credentials not configured for this tenant. Connect at /whatsapp-setup first.',
      400,
      'ERR_META_006'
    );
  }

  const metaTemplates = await fetchMetaTemplates(effectiveWabaId, effectiveToken);

  let targetTenantId = tenantId;
  if (!targetTenantId && isSuperAdmin) {
    const { rows: [firstTenant] } = await query(`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`);
    targetTenantId = firstTenant?.id;
  }

  if (!targetTenantId) {
    throw new AppError('Tenant context required to sync templates.', 400, 'ERR_TENANT_REQUIRED');
  }

  let syncedCount = 0;
  for (const item of metaTemplates) {
    let rawCategory = (item.category || 'marketing').toLowerCase();
    if (!['marketing', 'utility', 'authentication'].includes(rawCategory)) {
      rawCategory = 'marketing';
    }

    let rawStatus = (item.status || 'pending').toLowerCase();
    if (!['approved', 'pending', 'rejected'].includes(rawStatus)) {
      if (rawStatus === 'paused') rawStatus = 'approved';
      else if (rawStatus.includes('reject')) rawStatus = 'rejected';
      else rawStatus = 'pending';
    }

    const components = Array.isArray(item.components) ? item.components : [];
    const bodyComp = components.find((c) => c.type === 'BODY');
    const headerComp = components.find((c) => c.type === 'HEADER');
    const footerComp = components.find((c) => c.type === 'FOOTER');
    const buttonsComp = components.find((c) => c.type === 'BUTTONS');

    const bodyText = bodyComp?.text || item.name;
    const headerType = (headerComp?.format || (headerComp?.text ? 'TEXT' : 'NONE')).toUpperCase();
    const headerText = headerComp?.text || null;
    const footerText = footerComp?.text || null;
    const buttons = buttonsComp?.buttons || [];

    const varMatches = [...bodyText.matchAll(/\{\{(\w+)\}\}/g)];
    const varKeys = [...new Set(varMatches.map((m) => m[1]))];
    const variablesSchema = varKeys.map((k) => ({
      name: k,
      type: 'text',
      example: k === '1' ? 'Customer' : `Sample ${k}`,
    }));

    await query(
      `INSERT INTO message_templates
         (tenant_id, name, meta_template_id, category, language, status,
          body_text, header_text, header_type, footer_text, buttons,
          variables_schema, rejection_reason, created_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (tenant_id, name, language) DO UPDATE SET
         meta_template_id = EXCLUDED.meta_template_id,
         category         = EXCLUDED.category,
         status           = EXCLUDED.status,
         body_text        = EXCLUDED.body_text,
         header_text      = EXCLUDED.header_text,
         header_type      = EXCLUDED.header_type,
         footer_text      = EXCLUDED.footer_text,
         buttons          = EXCLUDED.buttons,
         variables_schema = EXCLUDED.variables_schema,
         rejection_reason = EXCLUDED.rejection_reason,
         deleted_at       = NULL,
         updated_at       = NOW()`,
      [
        targetTenantId,
        item.name.toLowerCase().trim(),
        item.id,
        rawCategory,
        item.language || 'en',
        rawStatus,
        bodyText,
        headerText,
        headerType,
        footerText,
        JSON.stringify(buttons),
        JSON.stringify(variablesSchema),
        item.rejected_reason || null,
        req.user.id,
      ]
    );
    syncedCount++;
  }

  // Soft-delete local templates that were removed/deleted on Meta
  const activeMetaNames = metaTemplates.map((m) => m.name.toLowerCase().trim());
  if (activeMetaNames.length > 0) {
    await query(
      `UPDATE message_templates
       SET deleted_at = NOW()
       WHERE tenant_id = $1
         AND deleted_at IS NULL
         AND LOWER(name) != ALL($2::text[])`,
      [targetTenantId, activeMetaNames]
    );
  } else {
    await query(
      `UPDATE message_templates
       SET deleted_at = NOW()
       WHERE tenant_id = $1
         AND deleted_at IS NULL`,
      [targetTenantId]
    );
  }

  const { rows } = await query(
    `SELECT * FROM message_templates WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [targetTenantId]
  );

  return sendSuccess(res, { count: syncedCount, templates: rows }, `Successfully synced ${syncedCount} templates from Meta.`);
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
  const isSuperAdmin = req.user.role === 'super_admin';
  const { rows: [template] } = await query(
    `SELECT * FROM message_templates
     WHERE id = $1 AND (tenant_id = $2 OR $3 = TRUE) AND deleted_at IS NULL`,
    [req.params.id, req.user.tenantId, isSuperAdmin]
  );
  if (!template) throw new AppError('Template not found.', 404, 'ERR_VDAJ_TMPL_001');

  // Resolve tenant credentials (handles both tenant users and super_admin)
  let tenant = req.tenant;
  if ((!tenant?.waba_id && !tenant?.wabaId) && template.tenant_id) {
    const { rows: [t] } = await query(
      `SELECT waba_id, meta_system_token, phone_number_id FROM tenants WHERE id = $1`,
      [template.tenant_id]
    );
    if (t) tenant = t;
  }

  const effectiveWabaId = tenant?.waba_id || tenant?.wabaId || process.env.META_WABA_ID;
  const effectiveToken  = tenant?.meta_system_token || tenant?.metaSystemToken || tenant?.whatsapp_access_token || process.env.META_ACCESS_TOKEN;

  if (!effectiveWabaId || !effectiveToken) {
    throw new AppError(
      'WhatsApp credentials not configured for this template\'s tenant. Connect in Settings first.',
      400,
      'ERR_META_006'
    );
  }

  if (!template.meta_template_id) {
    // Not yet submitted — attempt initial submission now
    try {
      const { metaTemplateId, status: metaStatus } = await createMetaTemplate(
        { wabaId: effectiveWabaId, accessToken: effectiveToken },
        template
      );

      const { rows: [updated] } = await query(
        `UPDATE message_templates
         SET meta_template_id = $1, status = $2, rejection_reason = NULL, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [metaTemplateId, metaStatus, template.id]
      );

      return sendSuccess(res, updated, `Template submitted to Meta successfully! Status: ${metaStatus}.`);
    } catch (metaErr) {
      const reason = metaErr.message || 'Meta submission failed.';
      await query(
        `UPDATE message_templates
         SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [`Submission failed: ${reason}`, template.id]
      );
      throw metaErr;
    }
  }

  // Already submitted — poll Meta for current approval status

  const { status: metaStatus, rejectionReason } = await syncMetaTemplateStatus(
    effectiveWabaId,
    effectiveToken,
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

  recordAudit({
    tenantId: template.tenant_id || req.user.tenantId,
    userId: req.user.id,
    action: 'TEMPLATE_SYNCED',
    resourceType: 'template',
    resourceId: template.id,
    status: metaStatus === 'APPROVED' ? 'SUCCESS' : (metaStatus === 'REJECTED' ? 'FAILED' : 'WARNING'),
    meta: {
      templateName: template.name,
      metaStatus,
      rejectionReason: rejectionReason || null,
    },
    subTasks: [
      { name: 'Meta Graph API Status Query', details: `Polled Meta for template ${template.meta_template_id}`, component: 'Meta Graph API', status: 'SUCCESS' },
      { name: 'Approval State Synchronized', details: `Updated approval status to ${metaStatus}${rejectionReason ? ` (Reason: ${rejectionReason})` : ''}`, component: 'PostgreSQL Store', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
  }).catch(() => {});

  return sendSuccess(res, updated, `Template status synced: ${metaStatus}.`);
}));

module.exports = router;
