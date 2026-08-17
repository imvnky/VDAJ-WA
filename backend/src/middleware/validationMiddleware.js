/**
 * VDAJ Services — Validation Middleware (express-validator)
 * Input sanitization: SQL injection, XSS, E.164 phone format
 */

const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Run validationResult and throw AppError if there are validation errors.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    throw new AppError('Validation failed.', 422, 'ERR_VDAJ_VAL_001', details);
  }
  next();
};

// ============================================================
// SHARED VALIDATORS
// ============================================================

const phoneE164Validator = body('phone')
  .trim()
  .matches(/^\+[1-9]\d{7,14}$/)
  .withMessage('Phone must be E.164 format (e.g. +919876543210). Code: ERR_VDAJ_VAL_002')
  .customSanitizer((val) => val.replace(/[^\d+]/g, '')); // Strip non-digit non-plus

const emailValidator = (field = 'email') =>
  body(field).trim().isEmail().normalizeEmail().withMessage('Invalid email address.');

const passwordValidator = (field = 'password') =>
  body(field)
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.')
    .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .withMessage('Password must contain uppercase, number, and special character.');

const uuidParamValidator = (paramName) =>
  param(paramName).isUUID(4).withMessage(`${paramName} must be a valid UUID.`);

// ============================================================
// ROUTE-SPECIFIC VALIDATOR CHAINS
// ============================================================

const loginValidators = [
  emailValidator('email'),
  body('password').notEmpty().withMessage('Password is required.'),
];

const campaignValidators = [
  body('name').trim().notEmpty().isLength({ max: 512 }).escape(),
  body('templateId').isUUID(4),
  body('contactListId').isUUID(4),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be valid ISO8601 UTC.')
    .custom((val) => {
      if (new Date(val) <= new Date()) throw new Error('Scheduled time must be in the future. ERR_VDAJ_CAMP_004');
      return true;
    }),
];

const contactValidators = [
  body('phoneE164')
    .trim()
    .matches(/^\+[1-9]\d{7,14}$/)
    .withMessage('ERR_VDAJ_VAL_002: Phone must be E.164 format.'),
  body('firstName').optional().trim().isLength({ max: 100 }).escape(),
  body('lastName').optional().trim().isLength({ max: 100 }).escape(),
  body('email').optional().trim().isEmail().normalizeEmail(),
];

module.exports = {
  validate,
  phoneE164Validator,
  emailValidator,
  passwordValidator,
  uuidParamValidator,
  loginValidators,
  campaignValidators,
  contactValidators,
};
