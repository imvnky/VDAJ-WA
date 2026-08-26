/**
 * VDAJ Services — Standard Error Code Registry
 * All custom error codes used across the platform.
 * Format: ERR_{DOMAIN}_{CODE}
 */

const ERROR_CODES = {
  // ---- AUTHENTICATION & AUTHORIZATION ----
  ERR_VDAJ_AUTH_001: 'Invalid credentials. Email or password is incorrect.',
  ERR_VDAJ_AUTH_002: 'Account is inactive or suspended. Contact support.',
  ERR_VDAJ_AUTH_003: 'Authentication token is missing.',
  ERR_VDAJ_AUTH_004: 'Authentication token has expired. Please login again.',
  ERR_VDAJ_AUTH_005: 'Authentication token is invalid or tampered.',
  ERR_VDAJ_AUTH_006: 'Insufficient permissions for this action.',
  ERR_VDAJ_AUTH_007: 'Account email is not verified.',
  ERR_VDAJ_AUTH_008: 'Password reset token is invalid or expired.',

  // ---- TENANT ----
  ERR_VDAJ_TENANT_001: 'Tenant not found.',
  ERR_VDAJ_TENANT_002: 'Tenant is inactive.',
  ERR_VDAJ_TENANT_003: 'Tenant has not completed Meta WhatsApp onboarding.',
  ERR_VDAJ_TENANT_004: 'Tenant daily message quota exceeded.',
  ERR_VDAJ_TENANT_005: 'Tenant monthly message quota exceeded.',

  // ---- VALIDATION ----
  ERR_VDAJ_VAL_001: 'Request body validation failed.',
  ERR_VDAJ_VAL_002: 'Phone number is not in valid E.164 format (e.g. +919876543210).',
  ERR_VDAJ_VAL_003: 'File type is not permitted.',
  ERR_VDAJ_VAL_004: 'File size exceeds the maximum limit.',
  ERR_VDAJ_VAL_005: 'Required field is missing.',
  ERR_VDAJ_VAL_006: 'Invalid value for enum field. Check the allowed values.',

  // ---- META / WHATSAPP API ----
  ERR_META_AUTH: 'Meta system token is invalid or expired. Re-authorize via Embedded Signup.',
  ERR_META_001: 'Meta API rate limit hit. Messages will retry automatically.',
  ERR_META_002: 'Phone number is not registered on WhatsApp.',
  ERR_META_003: 'Message template is not approved by Meta.',
  ERR_META_004: 'Message send failed. Invalid phone number format.',
  ERR_META_005: 'Meta API returned an unexpected error.',
  ERR_META_006: 'WhatsApp Business Account (WABA) ID not configured for this tenant.',

  // ---- CAMPAIGN ----
  ERR_VDAJ_CAMP_001: 'Campaign not found.',
  ERR_VDAJ_CAMP_002: 'Campaign is already running or completed. Cannot modify.',
  ERR_VDAJ_CAMP_003: 'Campaign has no contacts. Add contacts before launching.',
  ERR_VDAJ_CAMP_004: 'Scheduled time must be in the future.',
  ERR_VDAJ_CAMP_005: 'Campaign failed to start. Contact support with this error code.',

  // ---- CONTACT ----
  ERR_VDAJ_CONT_001: 'Contact not found.',
  ERR_VDAJ_CONT_002: 'Contact has opted out and cannot receive messages.',
  ERR_VDAJ_CONT_003: 'Duplicate contact. Phone number already exists.',
  ERR_VDAJ_CONT_004: 'Contact list not found.',
  ERR_VDAJ_CONT_005: 'CSV import failed. Check the file format.',

  // ---- TEMPLATE ----
  ERR_VDAJ_TMPL_001: 'Template not found.',
  ERR_VDAJ_TMPL_002: 'Template is not approved.',
  ERR_VDAJ_TMPL_003: 'Template variable count mismatch.',

  // ---- QUEUE / WORKER ----
  ERR_VDAJ_QUEUE_001: 'Job failed to enqueue. Redis may be unavailable.',
  ERR_VDAJ_QUEUE_002: 'Job exceeded maximum retry limit and moved to dead-letter queue.',
  ERR_VDAJ_QUEUE_003: 'Worker processing error. Job will be retried.',

  // ---- SERVER ----
  ERR_VDAJ_SRV_001: 'Internal server error. Our team has been notified.',
  ERR_VDAJ_SRV_002: 'Service temporarily unavailable. Please try again shortly.',
  ERR_VDAJ_SRV_003: 'Database connection error.',
  ERR_VDAJ_SRV_004: 'Route not found.',
};

module.exports = ERROR_CODES;
