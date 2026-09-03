/**
 * VDAJ Services — Express Server Entry Point
 *
 * Security stack: Helmet · CORS · Rate-limit · HPP · Compression · Cookie-parser
 * Transport:      HTTP/1.1 + WebSocket (/ws/inbox)
 * Background:     Analytics cron (daily 00:10 UTC)
 *
 * Route tree:
 *   /api/v1/auth          — Auth (login, logout, me, Meta OAuth callback)
 *   /api/v1/tenants       — Tenant management (SuperAdmin + self-service)
 *   /api/v1/campaigns     — Campaign CRUD + launch
 *   /api/v1/contacts      — Contacts CRUD + bulk import
 *   /api/v1/templates     — Message templates + Meta submission
 *   /api/v1/webhooks      — Meta webhook (verification + inbound + status)
 *   /api/v1/inbox         — Two-way inbox conversations
 *   /api/v1/analytics     — KPI overview, trend, campaign stats, snapshot trigger
 *   /api/v1/automations   — Drip automations + AI responder config
 *   /api/v1/commerce      — Meta Commerce catalogs + products
 *   /api/v1/billing       — Subscription tiers + usage + checkout placeholder
 *   /api/v1/admin/queue   — Bull queue admin (SuperAdmin only)
 */

require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const morgan       = require('morgan');
const hpp          = require('hpp');

const logger = require('./utils/logger');
const { globalErrorHandler, notFoundHandler } = require('./middleware/responseHandler');

// ── Route imports ──────────────────────────────────────────────
const authRoutes       = require('./routes/authRoutes');
const tenantRoutes     = require('./routes/tenantRoutes');
const campaignRoutes   = require('./routes/campaignRoutes');
const contactRoutes    = require('./routes/contactRoutes');
const templateRoutes   = require('./routes/templateRoutes');
const webhookRoutes    = require('./routes/webhookRoutes');
const queueRoutes      = require('./routes/queueRoutes');
const inboxRoutes      = require('./routes/inboxRoutes');
const analyticsRoutes  = require('./routes/analyticsRoutes');
const automationRoutes = require('./routes/automationRoutes');
const commerceRoutes   = require('./routes/commerceRoutes');
const billingRoutes    = require('./routes/billingRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const teamRoutes       = require('./routes/teamRoutes');

// ── Background workers ─────────────────────────────────────────
const { startAnalyticsCron, startWABAHealthCron } = require('./workers/analyticsWorker');

// ── WebSocket ──────────────────────────────────────────────────
const { WebSocketServer } = require('ws');
const jwt    = require('jsonwebtoken');
const cookie = require('cookie');

// ──────────────────────────────────────────────────────────────
const app        = express();
app.set('trust proxy', 1); // Trust Render's load balancer proxy for rate limiting

const PORT       = process.env.PORT || 5000;
const API_PREFIX = '/api/v1';

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", 'https://connect.facebook.net'],
        frameSrc:   ["'self'", 'https://www.facebook.com'],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for Meta Embedded Signup iFrame
  })
);

// Strict CORS — allowed origins from env (comma-separated) + FRONTEND_URL
app.use(
  cors({
    origin: (origin, callback) => {
      const defaults = [
        'https://wa.vdajservices.com',
        'https://vdajservices.com',
        'http://localhost:3000',
        'http://localhost:5173',
      ];
      const envAllowed = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
      const allowed = [...defaults, ...envAllowed];
      if (process.env.FRONTEND_URL) {
        allowed.push(process.env.FRONTEND_URL.trim());
      }
      if (!origin || allowed.includes(origin) || origin.endsWith('.vdajservices.com')) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not permitted.`));
      }
    },
    credentials:    true, // Required for HTTP-only cookie auth
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Request-ID', 'Authorization', 'X-Requested-With'],
  })
);

// ============================================================
// RATE LIMITERS
// ============================================================

// In development, dramatically raise both limits so localhost testing is never blocked.
// Production env keeps the strict values from .env / defaults.
const IS_DEV = process.env.NODE_ENV === 'development';

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max:      IS_DEV ? 10_000 : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success:   false,
    errorCode: 'ERR_VDAJ_SRV_002',
    message:   'Too many requests. Please slow down.',
  },
  // Skip health probe + all requests in dev so local tooling never gets blocked
  skip: (req) => req.path === `${API_PREFIX}/health` || IS_DEV,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Dev: 1 000 attempts per window — no lockout during rapid login testing
  max:      IS_DEV ? 1_000 : 20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success:   false,
    errorCode: 'ERR_VDAJ_SRV_002',
    message:   'Too many auth attempts. Try again in 15 minutes.',
  },
  skip: () => IS_DEV, // fully bypass in dev
});

app.use(globalLimiter);

// ============================================================
// BODY PARSING & SANITIZATION
// ============================================================

// Webhook endpoint requires raw Buffer for HMAC signature verification
app.use(`${API_PREFIX}/webhooks`, express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(hpp());           // HTTP Parameter Pollution guard
app.use(cookieParser());
app.use(compression());

// ============================================================
// REQUEST LOGGING
// ============================================================

if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip:   (req) => req.path === `${API_PREFIX}/health`,
    })
  );
}

// ============================================================
// HEALTH CHECK (unauthenticated, rate-limit exempt)
// ============================================================

app.get(`${API_PREFIX}/health`, (req, res) => {
  res.status(200).json({
    success:     true,
    service:     'vdajservices-backend',
    version:     process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
  });
});

// ============================================================
// API ROUTE TREE
// ============================================================

// ── Auth (stricter rate limit) ─────────────────────────────────
app.use(`${API_PREFIX}/auth`,         authLimiter, authRoutes);

// ── Core platform routes (JWT-protected inside each router) ────
app.use(`${API_PREFIX}/tenants`,      tenantRoutes);
app.use(`${API_PREFIX}/campaigns`,    campaignRoutes);
app.use(`${API_PREFIX}/contacts`,     contactRoutes);
app.use(`${API_PREFIX}/templates`,    templateRoutes);
app.use(`${API_PREFIX}/inbox`,        inboxRoutes);
app.use(`${API_PREFIX}/analytics`,    analyticsRoutes);
app.use(`${API_PREFIX}/automations`,  automationRoutes);
app.use(`${API_PREFIX}/team`,         teamRoutes);

// ── Sprint 3: Commerce & Billing ───────────────────────────────
app.use(`${API_PREFIX}/commerce`,     commerceRoutes);
app.use(`${API_PREFIX}/billing`,      billingRoutes);

// ── Meta webhook (no auth — HMAC-verified inside the handler) ──
app.use(`${API_PREFIX}/webhooks`,     webhookRoutes);

// ── Admin: queue management (SuperAdmin / tenant_admin only) ───
app.use(`${API_PREFIX}/admin/queue`,  queueRoutes);

// ── Super Admin: tenant & user management ─────────────────────
app.use(`${API_PREFIX}/admin`,        superAdminRoutes);

// ============================================================
// ERROR HANDLERS (must be LAST)
// ============================================================

app.use(notFoundHandler);
app.use(globalErrorHandler);

// ============================================================
// HTTP SERVER
// ============================================================

const server = app.listen(PORT, () => {
  logger.info('VDAJ Services backend running', {
    port:       PORT,
    env:        process.env.NODE_ENV,
    version:    process.env.APP_VERSION,
    tenantMode: process.env.TENANT_MODE,
    routes: [
      'auth', 'tenants', 'campaigns', 'contacts', 'templates',
      'inbox', 'analytics', 'automations', 'commerce', 'billing',
      'webhooks', 'admin/queue',
    ],
  });
});

// ============================================================
// WEBSOCKET SERVER — Real-time Inbox (/ws/inbox)
// ============================================================

const wss = new WebSocketServer({ server, path: '/ws/inbox' });

/** tenantId → Set<WebSocket> */
const tenantRooms = new Map();

wss.on('connection', (ws, req) => {
  let tenantId = null;

  // 1. Try HTTP-only cookie (primary)
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token   = cookies[process.env.JWT_COOKIE_NAME || 'vdaj_access_token'];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      tenantId = decoded.tenantId || null;
    }
  } catch {}

  // 2. Fallback: query param (browser WebSocket can't set cookies)
  if (!tenantId) {
    const url = new URL(req.url, 'http://localhost');
    tenantId  = url.searchParams.get('tenantId');
  }

  if (!tenantId) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  // Join tenant room
  if (!tenantRooms.has(tenantId)) tenantRooms.set(tenantId, new Set());
  tenantRooms.get(tenantId).add(ws);
  logger.debug('WS client joined tenant room', { tenantId });

  ws.on('close', () => {
    tenantRooms.get(tenantId)?.delete(ws);
    if (tenantRooms.get(tenantId)?.size === 0) tenantRooms.delete(tenantId);
  });

  ws.on('error', (err) => logger.error('WS error', { error: err.message }));

  // Heartbeat: respond to ping with pong
  ws.on('message', (data) => {
    try {
      if (JSON.parse(data).type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {}
  });
});

/**
 * Broadcast a payload to all WebSocket clients in a tenant room.
 * Used by webhookRoutes (inbound messages) and analyticsWorker.
 *
 * @param {string} tenantId
 * @param {object} payload  — { type: 'new_message'|'analytics_updated', data: {...} }
 */
const broadcastToTenant = (tenantId, payload) => {
  const clients = tenantRooms.get(tenantId);
  if (!clients?.size) return;
  const msg = JSON.stringify(payload);
  clients.forEach((ws) => { if (ws.readyState === 1) ws.send(msg); });
};

// Expose via app.get() so any route/worker can call it
app.set('broadcastToTenant', broadcastToTenant);

// ============================================================
// BACKGROUND WORKERS
// ============================================================

// Analytics daily aggregation cron (00:10 UTC)
if (process.env.NODE_ENV !== 'test') {
  startAnalyticsCron();
  // WABA health sync cron (every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC)
  // Keeps quality_rating, messaging_tier, and display_phone_number fresh.
  startWABAHealthCron();
}

// ============================================================
// PROCESS LIFECYCLE
// ============================================================

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully…');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION — shutting down', { reason: String(reason) });
  server.close(() => process.exit(1));
});

module.exports = app;
