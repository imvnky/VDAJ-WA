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
  const jobs = await deadLetterQueue.getJobs(['waiting', 'completed', 'failed']);
  const simplified = jobs.map((j) => ({
    id: j.id,
    campaignId: j.data.campaignId,
    tenantId: j.data.tenantId,
    chunkIndex: j.data.chunkIndex,
    messageCount: j.data.messages?.length,
    failedAt: j.data.failedAt,
    originalError: j.data.error,
    state: j.finishedOn ? 'completed' : 'waiting',
  }));
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

  return sendSuccess(res, { replayedJobId: req.params.jobId }, 'Job replayed from dead-letter queue.');
}));

module.exports = router;
