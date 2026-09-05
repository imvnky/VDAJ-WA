/**
 * VDAJ Services — Auth Routes
 * POST /auth/login | POST /auth/logout | GET /auth/me
 * POST /auth/meta/callback (Embedded Signup token exchange)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { sendSuccess, catchAsync } = require('../middleware/responseHandler');
const { authenticate } = require('../middleware/authMiddleware');
const AppError = require('../utils/AppError');
const { loginValidators, validate } = require('../middleware/validationMiddleware');
const { exchangeEmbeddedSignupToken } = require('../services/metaApiService');
const { recordAudit } = require('../services/auditService');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// ---- POST /auth/login ----
router.post('/login', loginValidators, validate, catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT id, email, password_hash, first_name, last_name, role, is_active, is_verified, tenant_id
     FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email.toLowerCase()]
  );

  const user = rows[0];
  const passwordMatch = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !passwordMatch) {
    recordAudit({
      tenantId: user?.tenant_id || null,
      userId: user?.id || null,
      action: 'AUTH_LOGIN_FAILED',
      resourceType: 'user',
      resourceId: user?.id || email,
      status: 'FAILED',
      meta: {
        attemptedEmail: email,
        reason: !user ? 'Account not found' : 'Invalid password digest',
      },
      subTasks: [
        { name: 'User Identity Lookup', details: `Searched user database for ${email}`, component: 'Auth Engine', status: user ? 'SUCCESS' : 'FAILED' },
        { name: 'Password Hash Digest Check', details: 'Bcrypt cryptographic verification failed', component: 'Crypto Security', status: 'FAILED' },
      ],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    throw new AppError('Invalid credentials.', 401, 'ERR_VDAJ_AUTH_001');
  }

  if (!user.is_active) throw new AppError('Account inactive.', 403, 'ERR_VDAJ_AUTH_002');
  if (!user.is_verified) throw new AppError('Email not verified.', 403, 'ERR_VDAJ_AUTH_007');

  const token = jwt.sign(
    { sub: user.id, role: user.role, tenantId: user.tenant_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Update last login
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  res.cookie(process.env.JWT_COOKIE_NAME || 'vdaj_access_token', token, COOKIE_OPTIONS);

  recordAudit({
    tenantId: user.tenant_id,
    userId: user.id,
    action: 'AUTH_LOGIN_SUCCESS',
    resourceType: 'user',
    resourceId: user.id,
    status: 'SUCCESS',
    meta: {
      email: user.email,
      role: user.role,
      loginMethod: 'password',
    },
    subTasks: [
      { name: 'Identity & Password Verification', details: `Bcrypt hash verification succeeded for ${user.email}`, component: 'Crypto Security', status: 'SUCCESS' },
      { name: 'Session Token Issued', details: 'Signed JWT access cookie generated with 7d validity', component: 'JWT Service', status: 'SUCCESS' },
      { name: 'Refresh Last Login', details: 'Updated user last_login_at timestamp in database', component: 'PostgreSQL Store', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendSuccess(res, {
    token,
    user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role, tenantId: user.tenant_id }
  }, 'Login successful.');
}));

// ---- POST /auth/logout ----
router.post('/logout', authenticate, (req, res) => {
  recordAudit({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    action: 'AUTH_LOGOUT',
    resourceType: 'session',
    resourceId: req.user.id,
    status: 'SUCCESS',
    meta: { email: req.user.email, role: req.user.role },
    subTasks: [
      { name: 'Session Cookie Revocation', details: 'Cleared vdaj_access_token HTTP-only cookie', component: 'HTTP Session', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  res.clearCookie(process.env.JWT_COOKIE_NAME || 'vdaj_access_token', COOKIE_OPTIONS);
  return sendSuccess(res, null, 'Logged out successfully.');
});

// ---- GET /auth/me ----
router.get('/me', authenticate, (req, res) => {
  return sendSuccess(res, { user: req.user, tenant: req.tenant || null });
});

// ---- POST /auth/meta/callback — Embedded Signup code exchange ----
router.post('/meta/callback', authenticate, catchAsync(async (req, res) => {
  const { code } = req.body;
  if (!code) throw new AppError('Meta auth code is required.', 400, 'ERR_VDAJ_VAL_005');

  const { accessToken } = await exchangeEmbeddedSignupToken(
    code,
    process.env.META_APP_ID,
    process.env.META_APP_SECRET
  );

  const { wabaId, phoneNumberId } = req.body; // Passed from frontend after SDK callback

  await query(
    `UPDATE tenants SET meta_system_token = $1, waba_id = $2, phone_number_id = $3, updated_at = NOW()
     WHERE id = $4`,
    [accessToken, wabaId, phoneNumberId, req.user.tenantId]
  );

  recordAudit({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    action: 'META_WABA_LINKED',
    resourceType: 'waba_account',
    resourceId: wabaId,
    status: 'SUCCESS',
    meta: { wabaId, phoneNumberId },
    subTasks: [
      { name: 'Meta OAuth Token Exchange', details: 'Exchanged embedded signup authorization code for permanent system access token', component: 'Meta Graph API', status: 'SUCCESS' },
      { name: 'Tenant Assets Association', details: `Linked WABA ${wabaId} and Phone ID ${phoneNumberId} to tenant profile`, component: 'PostgreSQL Store', status: 'SUCCESS' },
    ],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {});

  return sendSuccess(res, { wabaId, phoneNumberId }, 'Meta account connected successfully.');
}));

module.exports = router;
