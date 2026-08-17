/**
 * VDAJ Services — Custom AppError Class
 * All thrown errors extend this for consistent structure.
 */

class AppError extends Error {
  /**
   * @param {string} message - Human-readable message (internal)
   * @param {number} statusCode - HTTP status code
   * @param {string} errorCode - VDAJ error code (e.g. ERR_VDAJ_AUTH_001)
   * @param {object} [details] - Optional extra context (validation errors, etc.)
   */
  constructor(message, statusCode = 500, errorCode = 'ERR_VDAJ_SRV_001', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // Operational = safe to send to client
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
