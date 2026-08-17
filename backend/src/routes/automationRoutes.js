/**
 * VDAJ Services — Automation Routes
 * CRUD for Drip Sequences + AI Responder config
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { sendSuccess, catchAsync } = require('../middleware/responseHandler');
const { authenticate } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const AppError = require('../utils/AppError');

router.use(authenticate, requireTenant);

// ---- GET /automations ----
router.get('/', catchAsync(async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, u.first_name || ' ' || u.last_name AS created_by_name
     FROM automations a
     LEFT JOIN users u ON a.created_by = u.id
     WHERE a.tenant_id = $1
     ORDER BY a.created_at DESC`,
    [req.user.tenantId]
  );
  return sendSuccess(res, rows);
}));

// ---- POST /automations ----
router.post('/', catchAsync(async (req, res) => {
  const { name, description, triggerType = 'manual', triggerConfig = {}, steps = [] } = req.body;
  if (!name?.trim()) throw new AppError('Automation name is required.', 400, 'ERR_AUTO_001');

  const { rows } = await query(
    `INSERT INTO automations (tenant_id, name, description, trigger_type, trigger_config, steps, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [req.user.tenantId, name, description, triggerType, JSON.stringify(triggerConfig), JSON.stringify(steps), req.user.id]
  );
  return sendSuccess(res, rows[0], 'Automation created.', null, 201);
}));

// ---- PUT /automations/:id ----
router.put('/:id', catchAsync(async (req, res) => {
  const { name, description, triggerType, triggerConfig, steps, isActive } = req.body;
  const { rows } = await query(
    `UPDATE automations
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         trigger_type = COALESCE($3, trigger_type),
         trigger_config = COALESCE($4, trigger_config),
         steps = COALESCE($5, steps),
         is_active = COALESCE($6, is_active),
         updated_at = NOW()
     WHERE id = $7 AND tenant_id = $8
     RETURNING *`,
    [name, description, triggerType, triggerConfig ? JSON.stringify(triggerConfig) : null,
     steps ? JSON.stringify(steps) : null, isActive, req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Automation not found.', 404, 'ERR_AUTO_002');
  return sendSuccess(res, rows[0], 'Automation updated.');
}));

// ---- DELETE /automations/:id ----
router.delete('/:id', catchAsync(async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM automations WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenantId]
  );
  if (!rowCount) throw new AppError('Automation not found.', 404, 'ERR_AUTO_002');
  return sendSuccess(res, null, 'Automation deleted.');
}));

// ---- GET /automations/ai-config ----
router.get('/ai-config', catchAsync(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM ai_responder_configs WHERE tenant_id = $1',
    [req.user.tenantId]
  );
  return sendSuccess(res, rows[0] || null);
}));

// ---- PUT /automations/ai-config ----
router.put('/ai-config', catchAsync(async (req, res) => {
  const { isEnabled, kbUrl, systemPrompt, confidenceThreshold, model } = req.body;
  const { rows } = await query(
    `INSERT INTO ai_responder_configs
       (tenant_id, is_enabled, kb_url, system_prompt, confidence_threshold, model)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id) DO UPDATE
       SET is_enabled = EXCLUDED.is_enabled,
           kb_url = COALESCE(EXCLUDED.kb_url, ai_responder_configs.kb_url),
           system_prompt = COALESCE(EXCLUDED.system_prompt, ai_responder_configs.system_prompt),
           confidence_threshold = COALESCE(EXCLUDED.confidence_threshold, ai_responder_configs.confidence_threshold),
           model = COALESCE(EXCLUDED.model, ai_responder_configs.model),
           updated_at = NOW()
     RETURNING *`,
    [req.user.tenantId, isEnabled ?? false, kbUrl, systemPrompt, confidenceThreshold ?? 0.75, model ?? 'gemini-1.5-flash']
  );
  return sendSuccess(res, rows[0], 'AI Responder config saved.');
}));

module.exports = router;
