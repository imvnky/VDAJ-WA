/**
 * VDAJ Services — Redis Client (ioredis)
 * Used by Bull queue and caching layer.
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'vdaj:',
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 200, 3000);
    logger.warn(`Redis retry attempt ${times}, delay ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err) => {
    logger.error('Redis connection error', { error: err.message });
    return true;
  },
};

const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'vdaj:',
      maxRetriesPerRequest: 3,
      retryStrategy: redisConfig.retryStrategy,
      reconnectOnError: redisConfig.reconnectOnError,
    })
  : new Redis(redisConfig);

redisClient.on('connect', () => logger.info('Redis connected'));
redisClient.on('ready', () => logger.info('Redis ready'));
redisClient.on('error', (err) => logger.error('Redis error', { error: err.message }));
redisClient.on('close', () => logger.warn('Redis connection closed'));

module.exports = redisClient;
