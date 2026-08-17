/**
 * VDAJ Services — Winston Logger
 * Structured JSON logging with daily rotation for MNC-grade observability.
 */

const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const base = `[${timestamp}] [${level.toUpperCase()}]: ${stack || message}`;
  const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
  return base + metaStr;
});

const fileTransport = new transports.DailyRotateFile({
  dirname: path.resolve(process.env.LOG_DIR || './logs'),
  filename: 'vdaj-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: combine(timestamp(), errors({ stack: true }), format.json()),
});

const errorFileTransport = new transports.DailyRotateFile({
  dirname: path.resolve(process.env.LOG_DIR || './logs'),
  filename: 'vdaj-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '60d',
  format: combine(timestamp(), errors({ stack: true }), format.json()),
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
  transports: [fileTransport, errorFileTransport],
  exitOnError: false,
});

// Console logging only in non-production
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
    })
  );
}

module.exports = logger;
