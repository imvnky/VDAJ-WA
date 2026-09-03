/**
 * VDAJ Services — Enterprise Audit Logging Service
 * ───────────────────────────────────────────────────
 * Records immutable, hierarchical audit trails for compliance
 * following MNC enterprise standards (SOC2, ISO 27001, GDPR).
 */

'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Record a consolidated audit event with hierarchical sub-actions.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} params.action - e.g. 'CAMPAIGN_LAUNCH', 'TEMPLATE_SUBMIT', 'CLIENT_ONBOARD'
 * @param {string} [params.resourceType] - e.g. 'campaign', 'template', 'tenant'
 * @param {string} [params.resourceId]
 * @param {string} [params.status='SUCCESS'] - 'SUCCESS' | 'WARNING' | 'FAILED'
 * @param {Array}  [params.subTasks=[]] - Child operations executed under this action
 * @param {object} [params.meta={}] - Detailed parameters, diffs, or metadata
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {string} [params.timezone='Asia/Kolkata']
 */
async function recordAudit({
  tenantId,
  userId,
  action,
  resourceType,
  resourceId,
  status = 'SUCCESS',
  subTasks = [],
  meta = {},
  ipAddress,
  userAgent,
  timezone = 'Asia/Kolkata',
}) {
  try {
    const payload = {
      ...meta,
      status,
      timezone,
      sub_tasks: subTasks,
      logged_at: new Date().toISOString(),
    };

    const { rows: [log] } = await query(
      `INSERT INTO audit_logs
         (tenant_id, user_id, action, resource_type, resource_id, meta, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id, action, created_at`,
      [
        tenantId || null,
        userId || null,
        action,
        resourceType || null,
        resourceId || null,
        JSON.stringify(payload),
        ipAddress && ipAddress !== '::1' && ipAddress !== '127.0.0.1' ? ipAddress : null,
        userAgent || null,
      ]
    );

    return log;
  } catch (err) {
    // Audit logging should never crash the main application, but must be logged to stderr
    logger.error('Failed to write audit log entry', {
      action,
      tenantId,
      error: err.message,
    });
    return null;
  }
}

module.exports = {
  recordAudit,
};
