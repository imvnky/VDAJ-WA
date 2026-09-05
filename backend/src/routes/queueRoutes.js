/**
 * VDAJ Services — Queue Admin Routes
 * GET /admin/queue/stats | POST /admin/queue/dlq/:jobId/replay
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { sendSuccess, catchAsync } = require('../middleware/responseHandler');
const { getQueueStats, deadLetterQueue, messageQueue } = require('../workers/messageWorker');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');

router.use(authenticate, authorize('super_admin', 'tenant_admin'));

// ---- GET /admin/queue/stats ----
router.get('/stats', catchAsync(async (req, res) => {
  let stats = {
    messageQueue: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
    deadLetterQueue: { waiting: 0, completed: 0 },
  };
  try {
    stats = await getQueueStats();
  } catch (err) {
    // Gracefully handle Redis connection issues without throwing 500
  }
  return sendSuccess(res, stats, 'Queue stats fetched.');
}));

// ---- GET /admin/queue/dlq — List dead-letter jobs ----
router.get('/dlq', authorize('super_admin'), catchAsync(async (req, res) => {
  let simplified = [];
  try {
    const jobs = await deadLetterQueue.getJobs(['waiting', 'completed', 'failed']);
    simplified = jobs.map((j) => ({
      id: j.id,
      campaignId: j.data.campaignId,
      tenantId: j.data.tenantId,
      chunkIndex: j.data.chunkIndex,
      messageCount: j.data.messages?.length,
      failedAt: j.data.failedAt,
      originalError: j.data.error,
      state: j.finishedOn ? 'completed' : 'waiting',
    }));
  } catch (err) {
    // Gracefully handle Redis connection issues — return empty DLQ
  }
  return sendSuccess(res, simplified, 'Dead-letter jobs fetched.');
}));

// ---- POST /admin/queue/dlq/:jobId/replay — Re-enqueue from DLQ ----
router.post('/dlq/:jobId/replay', authorize('super_admin'), catchAsync(async (req, res) => {
  const job = await deadLetterQueue.getJob(req.params.jobId);
  if (!job) throw new AppError('Dead-letter job not found.', 404, 'ERR_VDAJ_QUEUE_001');

  await messageQueue.add(
    {
      ...job.data,
      replayed: true,
      replayedAt: new Date().toISOString(),
    },
    { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );

  await job.remove();

  recordAudit({
    tenantId: job.data.tenantId || null,
    userId: req.user.id,
    action: 'QUEUE_DLQ_REPLAY',
    resourceType: 'queue_job',
    resourceId: req.params.jobId,
    status: 'SUCCESS',
    meta: {
      campaignId: job.data.campaignId,
      chunkIndex: job.data.chunkIndex,
      messageCount: job.data.messages?.length || 0,
      originalError: job.data.error || null,
    },
    subTasks: [
      { name: 'Retrieve DLQ Job', details: `Retrieved job payload ${req.params.jobId} from dead-letter queue`, component: 'Redis Bull Engine', status: 'SUCCESS' },
      { name: 'Re-enqueue Message Chunks', details: `Dispatched ${job.data.messages?.length || 0} recipient messages to active worker pool`, component: 'Bull Queue', status: 'SUCCESS' },
      { name: 'Purge Dead-Letter Store', details: 'Removed resolved entry from deadLetterQueue', component: 'Redis Store', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
  }).catch(() => {});

  return sendSuccess(res, { replayedJobId: req.params.jobId }, 'Job replayed from dead-letter queue.');
}));

module.exports = router;
