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

let tablesInitialized = false;
async function ensureTables() {
  if (tablesInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS automations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_type VARCHAR(100) NOT NULL DEFAULT 'manual',
        trigger_config JSONB NOT NULL DEFAULT '{}',
        steps JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        run_count INTEGER NOT NULL DEFAULT 0,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS automation_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
        phone_e164 VARCHAR(20) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'running',
        current_step_id VARCHAR(100),
        trigger_type VARCHAR(100),
        matched_keyword VARCHAR(255),
        logs JSONB NOT NULL DEFAULT '[]',
        error_message TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);
    tablesInitialized = true;
  } catch (err) {
    // Non-fatal if already initialized
  }
}

// ---- GET /automations ----
router.get('/', catchAsync(async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  await ensureTables();
  let rows = [];
  try {
    const result = await query(
      `SELECT a.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM automations a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.tenant_id = $1
       ORDER BY a.is_active DESC, a.updated_at DESC`,
      [req.user.tenantId]
    );
    rows = result.rows;
  } catch (err) {
    if (err.code !== '42P01') throw err;
  }
  return sendSuccess(res, rows);
}));

// ---- POST /automations ----
router.post('/', catchAsync(async (req, res) => {
  await ensureTables();
  const { name, description, triggerType = 'manual', triggerConfig = {}, steps = [], isActive = true } = req.body;
  if (!name?.trim()) throw new AppError('Automation name is required.', 400, 'ERR_AUTO_001');

  const stepsJson = typeof steps === 'object' && steps !== null ? JSON.stringify(steps) : (steps || '[]');
  const triggerConfigJson = typeof triggerConfig === 'object' && triggerConfig !== null ? JSON.stringify(triggerConfig) : (triggerConfig || '{}');

  // If this automation is active, deactivate others for this tenant to avoid split execution
  if (isActive) {
    await query(`UPDATE automations SET is_active = false WHERE tenant_id = $1`, [req.user.tenantId]);
  }

  const { rows } = await query(
    `INSERT INTO automations (tenant_id, name, description, trigger_type, trigger_config, steps, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
     RETURNING *`,
    [req.user.tenantId, name.trim(), description, triggerType, triggerConfigJson, stepsJson, Boolean(isActive), req.user.id]
  );
  return sendSuccess(res, rows[0], 'Automation created.', 201);
}));

// ---- PUT /automations/:id ----
router.put('/:id', catchAsync(async (req, res) => {
  await ensureTables();
  const { name, description, triggerType, triggerConfig, steps, isActive } = req.body;

  const stepsJson = steps !== undefined
    ? (typeof steps === 'object' && steps !== null ? JSON.stringify(steps) : steps)
    : null;
  const triggerConfigJson = triggerConfig !== undefined
    ? (typeof triggerConfig === 'object' && triggerConfig !== null ? JSON.stringify(triggerConfig) : triggerConfig)
    : null;

  // If making active, deactivate any conflicting automations
  if (isActive === true) {
    await query(`UPDATE automations SET is_active = false WHERE tenant_id = $1 AND id != $2`, [req.user.tenantId, req.params.id]);
  }

  const { rows } = await query(
    `UPDATE automations
     SET name           = COALESCE($1, name),
         description    = COALESCE($2, description),
         trigger_type   = COALESCE($3, trigger_type),
         trigger_config = COALESCE($4::jsonb, trigger_config),
         steps          = COALESCE($5::jsonb, steps),
         is_active      = COALESCE($6, is_active),
         updated_at     = NOW()
     WHERE id = $7 AND tenant_id = $8
     RETURNING *`,
    [
      name ? name.trim() : null,
      description,
      triggerType,
      triggerConfigJson,
      stepsJson,
      typeof isActive === 'boolean' ? isActive : null,
      req.params.id,
      req.user.tenantId,
    ]
  );
  if (!rows.length) throw new AppError('Automation not found.', 404, 'ERR_AUTO_002');
  return sendSuccess(res, rows[0], 'Automation updated.');
}));

// ---- GET /automations/:id/runs ----
router.get('/:id/runs', catchAsync(async (req, res) => {
  await ensureTables();
  try {
    const { rows } = await query(
      `SELECT * FROM automation_runs
       WHERE automation_id = $1 AND tenant_id = $2
       ORDER BY started_at DESC
       LIMIT 50`,
      [req.params.id, req.user.tenantId]
    );
    return sendSuccess(res, rows);
  } catch (err) {
    return sendSuccess(res, []);
  }
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
  let config = null;
  try {
    const { rows } = await query(
      'SELECT * FROM ai_responder_configs WHERE tenant_id = $1',
      [req.user.tenantId]
    );
    config = rows[0] || null;
  } catch (err) {
    if (err.code !== '42P01') throw err;
  }
  return sendSuccess(res, config);
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
