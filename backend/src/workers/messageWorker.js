/**
 * VDAJ Services — Heavy-Duty Redis/Bull Message Worker
 * Task 5: Chunking, rate-limiting, retries, dead-letter queue
 *
 * Architecture:
 *  Campaign start → split contacts into chunks → enqueue each chunk as a Bull job
 *  → Worker picks up chunk → sends to Meta API → updates DB → webhook updates delivery status
 */

require('dotenv').config();
const Bull = require('bull');
const { v4: uuidv4 } = require('uuid'); // uuid@11 still exposes v4 in CJS
const db = require('../config/database');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');
const { sendWhatsAppMessage } = require('../services/metaApiService');
const AppError = require('../utils/AppError');

// ============================================================
// QUEUE CONFIGURATION
// ============================================================

const QUEUE_CONFIG = {
  CHUNK_SIZE: parseInt(process.env.QUEUE_CHUNK_SIZE || '50', 10),
  DELAY_BETWEEN_CHUNKS_MS: parseInt(process.env.QUEUE_DELAY_BETWEEN_CHUNKS_MS || '1000', 10),
  MAX_RETRIES: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
  BACKOFF_DELAY_MS: parseInt(process.env.QUEUE_BACKOFF_DELAY_MS || '5000', 10),
  DEAD_LETTER_THRESHOLD: parseInt(process.env.QUEUE_DEAD_LETTER_THRESHOLD || '3', 10),
  CONCURRENCY: 5, // Process 5 chunk-jobs simultaneously
  META_DELAY_BETWEEN_MESSAGES_MS: 100, // Trickle: 100ms between each message within a chunk
};

const REDIS_OPTIONS = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
};

// ============================================================
// QUEUE DEFINITIONS
// ============================================================

/** Main campaign message queue */
const messageQueue = process.env.REDIS_URL
  ? new Bull('vdaj:message-queue', process.env.REDIS_URL, {
      prefix: 'vdaj',
      defaultJobOptions: {
        attempts: QUEUE_CONFIG.MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: QUEUE_CONFIG.BACKOFF_DELAY_MS,
        },
        removeOnComplete: { count: 1000, age: 86400 }, // Keep last 1000 completed jobs (24h)
        removeOnFail: false, // Keep failed jobs for inspection
      },
    })
  : new Bull('vdaj:message-queue', {
      redis: REDIS_OPTIONS,
      prefix: 'vdaj',
      defaultJobOptions: {
        attempts: QUEUE_CONFIG.MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: QUEUE_CONFIG.BACKOFF_DELAY_MS,
        },
        removeOnComplete: { count: 1000, age: 86400 }, // Keep last 1000 completed jobs (24h)
        removeOnFail: false, // Keep failed jobs for inspection
      },
    });

/** Dead-letter queue — jobs that exhausted all retries */
const deadLetterQueue = process.env.REDIS_URL
  ? new Bull('vdaj:dead-letter-queue', process.env.REDIS_URL, {
      prefix: 'vdaj',
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    })
  : new Bull('vdaj:dead-letter-queue', {
      redis: REDIS_OPTIONS,
      prefix: 'vdaj',
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    });

// ============================================================
// CHUNK SPLITTING — Accepts array, returns array of chunk arrays
// ============================================================

/**
 * Split a large contacts array into fixed-size chunks.
 * @param {Array} arr - Full contacts array
 * @param {number} size - Chunk size
 * @returns {Array[]} - Array of chunks
 */
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

// ============================================================
// ENQUEUE CAMPAIGN — Called by campaign service on launch
// ============================================================

/**
 * Split campaign contacts into chunks and enqueue all jobs with staggered delays.
 * @param {object} campaign - Campaign record from DB
 * @param {Array} messages - Array of campaign_messages records with phone_e164, template_vars, id
 */
const enqueueCampaign = async (campaign, messages) => {
  const chunks = chunkArray(messages, campaign.chunk_size || QUEUE_CONFIG.CHUNK_SIZE);
  const totalChunks = chunks.length;

  logger.info('Enqueueing campaign', {
    campaignId: campaign.id,
    tenantId: campaign.tenant_id,
    totalMessages: messages.length,
    totalChunks,
    chunkSize: QUEUE_CONFIG.CHUNK_SIZE,
  });

  const jobs = chunks.map((chunk, index) => ({
    name: `chunk-${index + 1}-of-${totalChunks}`,
    data: {
      campaignId: campaign.id,
      tenantId: campaign.tenant_id,
      chunkIndex: index,
      totalChunks,
      phoneNumberId: campaign.phone_number_id,
      metaSystemToken: campaign.meta_system_token,
      templateName: campaign.template_name,
      templateLanguage: campaign.template_language,
      messages: chunk,
    },
    opts: {
      // Stagger: each chunk starts DELAY_BETWEEN_CHUNKS_MS * index after the previous
      delay: index * (campaign.delay_ms || QUEUE_CONFIG.DELAY_BETWEEN_CHUNKS_MS),
      jobId: `${campaign.id}-chunk-${index}`,
    },
  }));

  await messageQueue.addBulk(jobs);

  logger.info('All chunks enqueued', {
    campaignId: campaign.id,
    totalChunks,
    firstDelay: 0,
    lastDelay: (totalChunks - 1) * QUEUE_CONFIG.DELAY_BETWEEN_CHUNKS_MS,
  });
};

// ============================================================
// PROCESS A SINGLE MESSAGE — Send via Meta API, update DB
// ============================================================

/**
 * Send a single WhatsApp message and update its status in DB.
 * @param {object} msg - { id, phone_e164, template_vars }
 * @param {object} jobData - Full chunk job data
 * @returns {Promise<{success: boolean, metaMessageId?: string, error?: string}>}
 */
const processMessage = async (msg, jobData) => {
  const { phoneNumberId, metaSystemToken, templateName, templateLanguage } = jobData;

  try {
    // Validate E.164 format
    if (!/^\+[1-9]\d{7,14}$/.test(msg.phone_e164)) {
      throw new AppError(`Invalid phone: ${msg.phone_e164}`, 400, 'ERR_VDAJ_VAL_002');
    }

    const metaResponse = await sendWhatsAppMessage({
      phoneNumberId,
      accessToken: metaSystemToken,
      to: msg.phone_e164,
      templateName,
      templateLanguage,
      templateVars: msg.template_vars || {},
    });

    // Update message status to 'sent'
    await db.query(
      `UPDATE campaign_messages
       SET status = 'sent', meta_message_id = $1, sent_at = NOW(), retry_count = $2, updated_at = NOW()
       WHERE id = $3`,
      [metaResponse.messages[0].id, msg.retryCount || 0, msg.id]
    );

    // Increment campaign sent_count
    await db.query(
      `UPDATE campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1`,
      [jobData.campaignId]
    );

    return { success: true, metaMessageId: metaResponse.messages[0].id };
  } catch (err) {
    const errorCode = err.errorCode || 'ERR_META_005';
    const errorMessage = err.message;

    // Update message with error info
    await db.query(
      `UPDATE campaign_messages
       SET last_error = $1, error_code = $2, retry_count = retry_count + 1, updated_at = NOW()
       WHERE id = $3`,
      [errorMessage, errorCode, msg.id]
    );

    logger.warn('Message send failed', {
      messageId: msg.id,
      phone: msg.phone_e164,
      campaignId: jobData.campaignId,
      errorCode,
      error: errorMessage,
    });

    return { success: false, error: errorMessage, errorCode };
  }
};

// ============================================================
// MAIN PROCESSOR — Handles each chunk job
// ============================================================

messageQueue.process(QUEUE_CONFIG.CONCURRENCY, async (job) => {
  const { campaignId, tenantId, chunkIndex, totalChunks, messages } = job.data;

  logger.info('Processing chunk', {
    jobId: job.id,
    campaignId,
    tenantId,
    chunkIndex: chunkIndex + 1,
    totalChunks,
    messagesInChunk: messages.length,
  });

  const results = { sent: 0, failed: 0, failedIds: [] };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Update job progress
    await job.progress(Math.round(((i + 1) / messages.length) * 100));

    const result = await processMessage(msg, job.data);

    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.failedIds.push(msg.id);
    }

    // Trickle delay between individual messages — Meta-safe
    if (i < messages.length - 1) {
      await new Promise((r) => setTimeout(r, QUEUE_CONFIG.META_DELAY_BETWEEN_MESSAGES_MS));
    }
  }

  // If all chunks are done, check if campaign is complete
  if (chunkIndex + 1 === totalChunks) {
    await db.query(
      `UPDATE campaigns
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'running'`,
      [campaignId]
    );
    logger.info('Campaign completed', { campaignId, tenantId });
  }

  logger.info('Chunk processed', {
    jobId: job.id,
    campaignId,
    chunkIndex: chunkIndex + 1,
    ...results,
  });

  return results;
});

// ============================================================
// RETRY EVENT — Log retries
// ============================================================

messageQueue.on('active', (job) => {
  if (job.attemptsMade > 0) {
    logger.info('Job retrying', {
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      maxAttempts: QUEUE_CONFIG.MAX_RETRIES,
      campaignId: job.data.campaignId,
    });
  }
});

// ============================================================
// FAILED EVENT — Move to dead-letter queue
// ============================================================

messageQueue.on('failed', async (job, err) => {
  logger.error('Job failed after all retries', {
    jobId: job.id,
    campaignId: job.data.campaignId,
    tenantId: job.data.tenantId,
    chunkIndex: job.data.chunkIndex,
    attempts: job.attemptsMade,
    error: err.message,
  });

  // Move to dead-letter queue
  try {
    await deadLetterQueue.add(
      {
        originalJobId: job.id,
        originalQueue: 'vdaj:message-queue',
        campaignId: job.data.campaignId,
        tenantId: job.data.tenantId,
        chunkIndex: job.data.chunkIndex,
        messages: job.data.messages,
        error: err.message,
        failedAt: new Date().toISOString(),
        attempts: job.attemptsMade,
      },
      { jobId: `dlq-${job.id}-${uuidv4()}` }
    );

    // Mark dead-lettered messages in DB
    const messageIds = job.data.messages.map((m) => m.id);
    if (messageIds.length > 0) {
      await db.query(
        `UPDATE campaign_messages
         SET is_dead_letter = TRUE, dead_lettered_at = NOW(), status = 'dead_letter',
             error_code = 'ERR_VDAJ_QUEUE_002', updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [messageIds]
      );

      await db.query(
        `UPDATE campaigns
         SET dead_letter_count = dead_letter_count + $1,
             failed_count = failed_count + $1, updated_at = NOW()
         WHERE id = $2`,
        [messageIds.length, job.data.campaignId]
      );
    }

    logger.warn('Chunk moved to dead-letter queue', {
      campaignId: job.data.campaignId,
      deadLetterCount: messageIds.length,
    });
  } catch (dlqErr) {
    logger.error('Failed to push to dead-letter queue', { error: dlqErr.message });
  }
});

// ============================================================
// DEAD-LETTER QUEUE PROCESSOR (Manual review/replay support)
// ============================================================

deadLetterQueue.process(1, async (job) => {
  // DLQ jobs just sit here for manual inspection/replay.
  // Admins can replay via API: POST /api/v1/admin/queue/dlq/:jobId/replay
  logger.warn('Dead-letter job received (awaiting manual review)', {
    originalJobId: job.data.originalJobId,
    campaignId: job.data.campaignId,
    tenantId: job.data.tenantId,
    failedAt: job.data.failedAt,
    messageCount: job.data.messages?.length,
  });

  return { status: 'awaiting_manual_review' };
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

const gracefulShutdown = async () => {
  logger.info('Worker shutting down gracefully...');
  await messageQueue.pause(true);     // Pause: don't pick new jobs
  await messageQueue.close();         // Close after current job finishes
  await deadLetterQueue.close();
  await redisClient.quit();
  logger.info('Worker shutdown complete.');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ============================================================
// HEALTH STATS — Exported for monitoring API
// ============================================================

const getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    messageQueue.getWaitingCount(),
    messageQueue.getActiveCount(),
    messageQueue.getCompletedCount(),
    messageQueue.getFailedCount(),
    messageQueue.getDelayedCount(),
  ]);

  const [dlqWaiting, dlqCompleted] = await Promise.all([
    deadLetterQueue.getWaitingCount(),
    deadLetterQueue.getCompletedCount(),
  ]);

  return {
    messageQueue: { waiting, active, completed, failed, delayed },
    deadLetterQueue: { waiting: dlqWaiting, completed: dlqCompleted },
  };
};

module.exports = { messageQueue, deadLetterQueue, enqueueCampaign, getQueueStats };
