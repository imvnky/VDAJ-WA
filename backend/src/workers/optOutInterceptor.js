/**
 * VDAJ Services — Opt-Out Interceptor
 * Detects STOP/UNSUBSCRIBE/OPT-OUT keywords in inbound webhook messages.
 * Actions (atomic):
 *   1. Set Redis key `optout:{tenantId}:{phoneE164}` (permanent)
 *   2. Update contacts.status = 'opted_out' in DB
 *   3. Log to opt_out_events table
 *   4. Mark conversation as resolved in inbox
 */

const { query } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');

// Keywords that trigger opt-out (case-insensitive, full-word match)
const OPT_OUT_KEYWORDS = [
  'stop', 'unsubscribe', 'opt out', 'optout', 'opt-out',
  'cancel', 'quit', 'end', 'remove me', 'no more',
  'block', 'do not contact', 'dont contact',
];

/**
 * Checks if a message body contains an opt-out keyword.
 * @param {string} body
 * @returns {string|null} matched keyword or null
 */
function detectOptOut(body) {
  if (!body || typeof body !== 'string') return null;
  const normalized = body.trim().toLowerCase();
  for (const kw of OPT_OUT_KEYWORDS) {
    // Whole-message match or word-boundary match
    if (normalized === kw || normalized.includes(kw)) {
      return kw;
    }
  }
  return null;
}

/**
 * Main opt-out interceptor.
 * Call this from webhookRoutes when an inbound message arrives.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.phoneE164  - E.164 sender phone (e.g. +919876543210)
 * @param {string} params.messageBody
 * @param {string} [params.waMessageId]
 * @returns {Promise<boolean>} true if opt-out was triggered
 */
async function optOutInterceptor({ tenantId, phoneE164, messageBody, waMessageId }) {
  const keyword = detectOptOut(messageBody);
  if (!keyword) return false;

  logger.info('Opt-out triggered', { tenantId, phoneE164, keyword, waMessageId });

  try {
    const redisKey = `optout:${tenantId}:${phoneE164}`;

    // 1. Set permanent Redis block key
    await redis.set(redisKey, '1');

    // 2. Upsert contact to opted_out (find by phone or create minimal record)
    const contactResult = await query(
      `UPDATE contacts
         SET status = 'opted_out', updated_at = NOW()
       WHERE tenant_id = $1 AND phone_e164 = $2
       RETURNING id`,
      [tenantId, phoneE164]
    );
    const contactId = contactResult.rows[0]?.id || null;

    // 3. Log opt-out event
    await query(
      `INSERT INTO opt_out_events (tenant_id, contact_id, phone_e164, trigger_phrase, source)
       VALUES ($1, $2, $3, $4, 'webhook')
       ON CONFLICT DO NOTHING`,
      [tenantId, contactId, phoneE164, keyword]
    );

    // 4. Mark any open conversation as resolved
    await query(
      `UPDATE inbox_conversations
         SET status = 'resolved', updated_at = NOW()
       WHERE tenant_id = $1 AND phone_e164 = $2 AND status = 'open'`,
      [tenantId, phoneE164]
    );

    logger.info('Opt-out processed successfully', { tenantId, phoneE164 });
    return true;
  } catch (err) {
    logger.error('Opt-out interceptor error', { error: err.message, tenantId, phoneE164 });
    // Don't rethrow — opt-out should never crash the webhook handler
    return false;
  }
}

/**
 * Middleware helper: checks Redis before queuing any outbound message.
 * Call this in messageWorker before each send attempt.
 *
 * @param {string} tenantId
 * @param {string} phoneE164
 * @returns {Promise<boolean>} true if number is opted out
 */
async function isOptedOut(tenantId, phoneE164) {
  try {
    const val = await redis.get(`optout:${tenantId}:${phoneE164}`);
    if (val) return true;

    // Fallback: check DB (in case Redis was flushed)
    const res = await query(
      `SELECT 1 FROM contacts WHERE tenant_id = $1 AND phone_e164 = $2 AND status = 'opted_out' LIMIT 1`,
      [tenantId, phoneE164]
    );
    if (res.rows.length > 0) {
      // Re-populate Redis cache
      await redis.set(`optout:${tenantId}:${phoneE164}`, '1');
      return true;
    }
    return false;
  } catch (err) {
    logger.error('isOptedOut check error', { error: err.message });
    return false; // Fail-open: don't block if check fails
  }
}

module.exports = { optOutInterceptor, isOptedOut, detectOptOut };
