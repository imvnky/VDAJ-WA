/**
 * VDAJ Services — Meta Graph API Service
 *
 * Functions:
 *  - sendWhatsAppMessage()       — Send a template message via Cloud API
 *  - createMetaTemplate()        — Submit a new template to Meta for approval
 *  - syncMetaTemplateStatus()    — Poll Meta for approval status of a local template
 *  - exchangeEmbeddedSignupToken() — Code → system-user token exchange
 *
 * All functions map Meta error codes → VDAJ error codes and log structured errors.
 */

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const META_API_BASE = process.env.META_GRAPH_API_URL || 'https://graph.facebook.com';
const API_VERSION   = process.env.META_API_VERSION   || 'v21.0';

// ── Error code mapping ─────────────────────────────────────────
const mapMetaError = (metaErrorCode) => {
  if (metaErrorCode === 190)                        return 'ERR_META_AUTH';    // Invalid token
  if (metaErrorCode === 130429 || metaErrorCode === 80007) return 'ERR_META_001'; // Rate limit
  if (metaErrorCode === 131030)                     return 'ERR_META_002';    // Phone not on WA
  if (metaErrorCode === 132000 || metaErrorCode === 132001) return 'ERR_META_003'; // Template error
  if (metaErrorCode === 131021)                     return 'ERR_META_004';    // Invalid phone
  return 'ERR_META_005';
};

// ── Generic Meta Graph API caller ─────────────────────────────
const callMetaApi = async ({ method = 'POST', path, accessToken, body }) => {
  const url = `${META_API_BASE}/${API_VERSION}/${path}`;
  let response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      timeout: 15000,
    });
  } catch (networkErr) {
    throw new AppError(`Meta API network error: ${networkErr.message}`, 503, 'ERR_META_005');
  }

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const metaErr  = responseBody?.error;
    const errorCode = mapMetaError(metaErr?.code);

    logger.error('Meta API error', {
      method,
      path,
      statusCode:    response.status,
      metaErrorCode: metaErr?.code,
      metaMessage:   metaErr?.message,
      errorCode,
    });

    if (errorCode === 'ERR_META_001') {
      const err = new AppError(`Meta rate limit. Code: ${metaErr?.code}`, 429, 'ERR_META_001');
      err.isRateLimit = true;
      throw err;
    }

    throw new AppError(metaErr?.message || 'Meta API error', response.status, errorCode);
  }

  return responseBody;
};

// ─────────────────────────────────────────────────────────────────
// sendWhatsAppMessage — Send a single template message
// ─────────────────────────────────────────────────────────────────

/**
 * Build template payload for Cloud API.
 * templateVars: { body: ['val1','val2'], header: 'val' }
 */
const buildTemplatePayload = (to, templateName, language, templateVars = {}) => {
  const components = [];

  if (Array.isArray(templateVars.body) && templateVars.body.length > 0) {
    components.push({
      type: 'body',
      parameters: templateVars.body.map((val) => ({ type: 'text', text: String(val) })),
    });
  }

  if (templateVars.header) {
    components.push({
      type: 'header',
      parameters: [{ type: 'text', text: String(templateVars.header) }],
    });
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to,
    type:     'template',
    template: {
      name:       templateName,
      language:   { code: language || 'en' },
      components: components.length > 0 ? components : undefined,
    },
  };
};

/**
 * Send a WhatsApp template message.
 * @param {object} options
 * @param {string} options.phoneNumberId
 * @param {string} options.accessToken
 * @param {string} options.to                 — E.164 recipient
 * @param {string} options.templateName
 * @param {string} options.templateLanguage
 * @param {object} options.templateVars       — { body: [], header: '' }
 * @param {string} [options.body]             — Free-text body for non-template messages
 * @returns {Promise<object>}
 */
const sendWhatsAppMessage = async ({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  templateLanguage,
  templateVars,
  body: freeTextBody,
}) => {
  let messagePayload;

  if (templateName) {
    // Template send
    messagePayload = buildTemplatePayload(to, templateName, templateLanguage, templateVars);
  } else if (freeTextBody) {
    // Free-text reply (used by Inbox)
    messagePayload = {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'text',
      text: { body: freeTextBody, preview_url: false },
    };
  } else {
    throw new AppError('Either templateName or body is required.', 400, 'ERR_VDAJ_VAL_001');
  }

  return callMetaApi({
    method:      'POST',
    path:        `${phoneNumberId}/messages`,
    accessToken,
    body:        messagePayload,
  });
};

// ─────────────────────────────────────────────────────────────────
// createMetaTemplate — Submit a new template to Meta for approval
// ─────────────────────────────────────────────────────────────────

/**
 * Submit a WhatsApp message template to Meta for review.
 * Updates local DB record with Meta's template_id and sets status to 'pending'.
 *
 * @param {object} tenantCredentials
 * @param {string} tenantCredentials.wabaId           — WhatsApp Business Account ID
 * @param {string} tenantCredentials.accessToken      — System-user token
 * @param {object} templateData                        — Local template record from DB
 * @param {string} templateData.name
 * @param {string} templateData.category              — 'marketing' | 'utility' | 'authentication'
 * @param {string} templateData.language
 * @param {string} templateData.body_text
 * @param {string} [templateData.header_text]
 * @param {string} [templateData.footer_text]
 * @param {Array}  [templateData.buttons]             — [{type:'QUICK_REPLY'|'URL', text:'...', url?:'...'}]
 * @returns {Promise<{metaTemplateId: string, status: string}>}
 */
const createMetaTemplate = async (tenantCredentials, templateData) => {
  const { wabaId, accessToken } = tenantCredentials;

  if (!wabaId || !accessToken) {
    throw new AppError(
      'WABA ID and access token are required to submit templates.',
      400,
      'ERR_META_006'
    );
  }

  // Build components array for Meta's template API
  const components = [];

  if (templateData.header_text) {
    components.push({
      type:   'HEADER',
      format: 'TEXT',
      text:   templateData.header_text,
    });
  }

  // Body — always required
  components.push({
    type: 'BODY',
    text: templateData.body_text,
  });

  if (templateData.footer_text) {
    components.push({
      type: 'FOOTER',
      text: templateData.footer_text,
    });
  }

  // Buttons (optional)
  if (Array.isArray(templateData.buttons) && templateData.buttons.length > 0) {
    const metaButtons = templateData.buttons.map((btn) => {
      if (btn.type === 'URL') {
        return { type: 'URL', text: btn.text, url: btn.url };
      }
      // Default: QUICK_REPLY
      return { type: 'QUICK_REPLY', text: btn.text };
    });
    components.push({ type: 'BUTTONS', buttons: metaButtons });
  }

  const metaPayload = {
    name:       templateData.name,
    category:   templateData.category.toUpperCase(), // Meta expects uppercase
    language:   templateData.language,
    components,
  };

  logger.info('Submitting template to Meta', {
    wabaId,
    templateName: templateData.name,
    category:     metaPayload.category,
    language:     templateData.language,
  });

  const responseBody = await callMetaApi({
    method:      'POST',
    path:        `${wabaId}/message_templates`,
    accessToken,
    body:        metaPayload,
  });

  const metaTemplateId = responseBody?.id;
  const metaStatus     = responseBody?.status?.toLowerCase() || 'pending';

  logger.info('Template submitted to Meta successfully', {
    templateName:   templateData.name,
    metaTemplateId,
    metaStatus,
  });

  return { metaTemplateId, status: metaStatus };
};

// ─────────────────────────────────────────────────────────────────
// syncMetaTemplateStatus — Poll Meta for latest approval status
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch current approval status of a template from Meta.
 * Used to update local DB when Meta processes the review.
 *
 * @param {string} wabaId
 * @param {string} accessToken
 * @param {string} metaTemplateId — Meta's ID for the template
 * @returns {Promise<{status: string, rejectionReason?: string}>}
 */
const syncMetaTemplateStatus = async (wabaId, accessToken, metaTemplateId) => {
  const responseBody = await callMetaApi({
    method:      'GET',
    path:        `${metaTemplateId}?fields=id,name,status,rejected_reason`,
    accessToken,
  });

  const status          = responseBody?.status?.toLowerCase() || 'pending';
  const rejectionReason = responseBody?.rejected_reason || null;

  return { status, rejectionReason };
};

// ─────────────────────────────────────────────────────────────────
// exchangeEmbeddedSignupToken — Short-lived code → system-user token
// ─────────────────────────────────────────────────────────────────

/**
 * Exchange Meta Embedded Signup short-lived code for a system-user token.
 * @param {string} code
 * @param {string} metaAppId
 * @param {string} metaAppSecret
 * @returns {Promise<{accessToken: string, tokenType: string}>}
 */
const exchangeEmbeddedSignupToken = async (code, metaAppId, metaAppSecret) => {
  const tokenUrl = `${META_API_BASE}/${API_VERSION}/oauth/access_token`;
  const params = new URLSearchParams({
    client_id:     metaAppId,
    client_secret: metaAppSecret,
    code,
    redirect_uri: `${process.env.NGROK_URL || process.env.CORS_ORIGIN}/api/v1/auth/meta/callback`,
  });

  let tokenRes;
  try {
    tokenRes = await fetch(`${tokenUrl}?${params}`, { timeout: 10000 });
  } catch (networkErr) {
    throw new AppError(`Meta token exchange network error: ${networkErr.message}`, 503, 'ERR_META_005');
  }

  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || tokenData.error) {
    logger.error('Meta token exchange failed', { error: tokenData.error });
    throw new AppError(
      tokenData.error?.message || 'Failed to exchange Meta authorization code.',
      401,
      'ERR_META_AUTH'
    );
  }

  return {
    accessToken: tokenData.access_token,
    tokenType:   tokenData.token_type,
  };
};

module.exports = {
  sendWhatsAppMessage,
  createMetaTemplate,
  syncMetaTemplateStatus,
  exchangeEmbeddedSignupToken,
};
