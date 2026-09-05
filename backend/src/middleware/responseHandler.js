/**
 * VDAJ Services — Standard API Response & Global Error Handler
 * Task 3: Middleware
 */

const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');

// ============================================================
// SUCCESS RESPONSE HELPER
// ============================================================

/**
 * Send a standard success response.
 * @param {object} res - Express response object
 * @param {*} data - Response payload
 * @param {string} [message] - Optional success message
 * @param {number} [statusCode=200] - HTTP status code
 * @param {object} [meta] - Optional pagination/meta info
 */
const sendSuccess = (res, data, message = 'Success', statusCode = 200, meta = null) => {
  const response = {
    success: true,
    message,
    data,
  };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

/**
 * Send a standard created response (201).
 */
const sendCreated = (res, data, message = 'Resource created successfully') =>
  sendSuccess(res, data, message, 201);

// ============================================================
// ERROR RESPONSE HELPER (internal)
// ============================================================

const sendError = (res, statusCode, errorCode, message, details = null) => {
  const response = {
    success: false,
    errorCode,
    message,
    error: message,
  };
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }
  return res.status(statusCode).json(response);
};

// ============================================================
// HANDLE SPECIFIC KNOWN ERRORS
// ============================================================

const handleJWTExpiredError = () =>
  new AppError(ERROR_CODES.ERR_VDAJ_AUTH_004, 401, 'ERR_VDAJ_AUTH_004');

const handleJWTInvalidError = () =>
  new AppError(ERROR_CODES.ERR_VDAJ_AUTH_005, 401, 'ERR_VDAJ_AUTH_005');

const handlePgUniqueViolation = (err) => {
  const match = err.detail?.match(/Key \((.+)\)=\(.+\) already exists/);
  const field = match ? match[1] : 'field';
  return new AppError(`Duplicate value for ${field}.`, 409, 'ERR_VDAJ_VAL_001', { field });
};

const handlePgForeignKeyViolation = () =>
  new AppError('Referenced resource does not exist.', 400, 'ERR_VDAJ_VAL_001');

const handlePgNotNullViolation = (err) =>
  new AppError(`Missing required field: ${err.column}`, 400, 'ERR_VDAJ_VAL_005', { field: err.column });

// ============================================================
// GLOBAL ERROR HANDLER MIDDLEWARE
// ============================================================

/**
 * Express global error handler. Must be registered LAST in middleware chain.
 * Catches all errors thrown via next(err) or throw in async routes.
 */
const globalErrorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let error = { ...err, message: err.message, stack: err.stack };

  // Map known error types to AppError
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  else if (err.name === 'JsonWebTokenError') error = handleJWTInvalidError();
  else if (err.code === '23505') error = handlePgUniqueViolation(err);   // PG unique violation
  else if (err.code === '23503') error = handlePgForeignKeyViolation();   // PG foreign key
  else if (err.code === '23502') error = handlePgNotNullViolation(err);   // PG not-null
  else if (err.code === '22P02') error = new AppError(               // PG invalid ENUM cast
    `Invalid value for enum field: ${err.message.match(/invalid input value for enum \S+: "([^"]+)"/)?.[1] || 'unknown'}`,
    400, 'ERR_VDAJ_VAL_006'
  );

  const statusCode = error.statusCode || 500;
  const errorCode = error.errorCode || 'ERR_VDAJ_SRV_001';
  const isOperational = error.isOperational === true;

  // Always log server errors fully
  if (statusCode >= 500) {
    logger.error('Unhandled server error', {
      errorCode,
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      tenantId: req.tenant?.id,
      userId: req.user?.id,
      ip: req.ip,
    });
  } else {
    logger.warn('Operational error', {
      errorCode,
      message: err.message,
      url: req.originalUrl,
      method: req.method,
    });
  }

  // Never leak stack traces to client in production
  const clientMessage = isOperational
    ? (ERROR_CODES[errorCode] || error.message)
    : ERROR_CODES['ERR_VDAJ_SRV_001'];

  return sendError(res, statusCode, errorCode, clientMessage, error.details);
};

// ============================================================
// 404 NOT FOUND HANDLER
// ============================================================

const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found.`, 404, 'ERR_VDAJ_SRV_004'));
};

// ============================================================
// ASYNC WRAPPER — Eliminates try/catch boilerplate in routes
// ============================================================

/**
 * Wraps an async route handler and forwards errors to next().
 * @param {Function} fn - Async express handler
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  globalErrorHandler,
  notFoundHandler,
  catchAsync,
};
