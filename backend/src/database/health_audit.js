/**
 * VDAJ QA Health Audit Script
 * Checks: DB tables, API routes (auth bypass with direct DB login)
 * Run: node src/database/health_audit.js
 */

require('dotenv').config();
const { Client } = require('pg');
const http = require('http');

const PASS = '\x1b[32m✔ PASS\x1b[0m';
const FAIL = '\x1b[31m✖ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠ WARN\x1b[0m';
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM  = (s) => `\x1b[2m${s}\x1b[0m`;

const BACKEND_PORT = process.env.PORT || 5000;
const BASE = `http://localhost:${BACKEND_PORT}/api/v1`;

// Expected tables across V1 + V2 + V3
const EXPECTED_TABLES = [
  // V1 Core
  'tenants', 'users', 'contacts', 'contact_lists', 'contact_list_members',
  'message_templates', 'campaigns', 'campaign_messages', 'webhook_events',
  'analytics_snapshots', 'schema_migrations',
  // V2 Extensions
  'subscription_tiers', 'subscriptions', 'inbox_conversations', 'inbox_messages',
  'automations', 'ai_responder_configs', 'commerce_catalogs', 'commerce_products',
  'opt_out_events',
  // V3 Flow Builder
  'flows', 'flow_nodes', 'flow_edges', 'flow_executions',
];

// Routes to audit — [method, path, expected_status, auth_required, label]
const ROUTES = [
  // Health (no auth)
  ['GET', '/health',                        200, false, 'Health check'],
  // Billing tiers (public)
  ['GET', '/billing/tiers',                 200, false, 'GET /billing/tiers (public)'],
  // Auth (unauthenticated — expect 400/422 on missing body, not 404/500)
  ['POST', '/auth/login',                   422, false, 'POST /auth/login (validation rejects)'],
  // Protected routes without token — expect 401, not 404/500
  ['GET', '/auth/me',                       401, false, 'GET /auth/me (401 without token)'],
  ['GET', '/campaigns',                     401, false, 'GET /campaigns (401 without token)'],
  ['GET', '/contacts',                      401, false, 'GET /contacts (401 without token)'],
  ['POST', '/contacts/bulk',                401, false, 'POST /contacts/bulk (401 without token)'],
  ['GET', '/contacts/lists',                401, false, 'GET /contacts/lists (401 without token)'],
  ['GET', '/templates',                     401, false, 'GET /templates (401 without token)'],
  ['GET', '/inbox/conversations',           401, false, 'GET /inbox/conversations (401 without token)'],
  ['GET', '/analytics/overview',            401, false, 'GET /analytics/overview (401 without token)'],
  ['GET', '/analytics/trend',               401, false, 'GET /analytics/trend (401 without token)'],
  ['GET', '/commerce/catalogs',             401, false, 'GET /commerce/catalogs (401 without token)'],
  ['GET', '/billing/subscription',          401, false, 'GET /billing/subscription (401 without token)'],
  ['GET', '/tenants/me',                    401, false, 'GET /tenants/me (401 without token)'],
  ['GET', '/automations',                   401, false, 'GET /automations (401 without token)'],
];

// ── HTTP helper ────────────────────────────────────────────────
function httpRequest(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port:     BACKEND_PORT,
      path:     `/api/v1${path}`,
      method,
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'X-Request-ID':  'audit-' + Date.now(),
        ...(token  ? { Cookie: `${process.env.JWT_COOKIE_NAME || 'vdaj_access_token'}=${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });

    if (payload) req.write(payload);
    req.end();
  });
}

// ── Main audit ─────────────────────────────────────────────────
async function runAudit() {
  const results = { pass: 0, fail: 0, warn: 0 };
  const report  = [];

  const log = (icon, label, detail = '') => {
    report.push({ icon, label, detail });
    if (icon === PASS) results.pass++;
    else if (icon === FAIL) results.fail++;
    else results.warn++;
  };

  // ── 1. Database Tables ─────────────────────────────────────
  console.log(BOLD('\n━━━  DATABASE TABLE AUDIT  ━━━\n'));

  const dbClient = new Client({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });

  try {
    await dbClient.connect();

    const { rows: tableRows } = await dbClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const existingTables = new Set(tableRows.map((r) => r.table_name));

    for (const table of EXPECTED_TABLES) {
      if (existingTables.has(table)) {
        log(PASS, `Table: ${table}`);
        console.log(`  ${PASS}  ${table}`);
      } else {
        log(FAIL, `Table: ${table}`, 'MISSING from database');
        console.log(`  ${FAIL}  ${table}  ${DIM('← MISSING')}`);
      }
    }

    // Report unexpected tables (informational)
    const extra = [...existingTables].filter((t) => !EXPECTED_TABLES.includes(t));
    if (extra.length) {
      console.log(DIM(`\n  Extra tables (not audited): ${extra.join(', ')}`));
    }

    // Row counts for seeded tables
    console.log('');
    for (const t of ['tenants', 'users', 'subscription_tiers', 'contacts', 'message_templates', 'campaigns']) {
      if (existingTables.has(t)) {
        const { rows } = await dbClient.query(`SELECT COUNT(*) AS n FROM ${t}`);
        console.log(DIM(`  ${t}: ${rows[0].n} rows`));
      }
    }

    await dbClient.end();
  } catch (err) {
    console.error(`  ${FAIL}  DB connection failed: ${err.message}`);
    results.fail++;
  }

  // ── 2. Backend Server Reachability ─────────────────────────
  console.log(BOLD('\n━━━  API ROUTE AUDIT  ━━━\n'));

  const health = await httpRequest('GET', '/health');
  if (health.status === 200) {
    console.log(`  ${PASS}  Backend server reachable on port ${BACKEND_PORT}`);
    results.pass++;
  } else {
    console.log(`  ${FAIL}  Backend server NOT reachable (status: ${health.status || health.error})`);
    console.log('       Cannot audit routes — is `npm run dev` running?\n');
    results.fail++;
    printSummary(results, report);
    return;
  }

  // ── 3. Route checks ────────────────────────────────────────
  for (const [method, path, expectedStatus, , label] of ROUTES) {
    const body = method === 'POST' ? {} : null;
    const res  = await httpRequest(method, path, body);

    const got    = res.status;
    const passed = got === expectedStatus;
    const icon   = passed ? PASS : (got === 0 ? FAIL : WARN);
    const detail = passed
      ? DIM(`→ ${got}`)
      : `→ got ${got}, expected ${expectedStatus}`;

    console.log(`  ${icon}  ${label}  ${detail}`);
    if (passed) results.pass++;
    else if (got === 0) results.fail++;
    else results.warn++;
  }

  // ── 4. WebSocket mount check (HTTP upgrade probe) ──────────
  console.log('');
  const wsProbe = await httpRequest('GET', '/../ws/inbox');
  const wsMount = wsProbe.status !== 0;
  if (wsMount) {
    console.log(`  ${PASS}  WS /ws/inbox — server accepts connections (HTTP ${wsProbe.status})`);
    results.pass++;
  } else {
    console.log(`  ${FAIL}  WS /ws/inbox — server not responding`);
    results.fail++;
  }

  printSummary(results, report);
}

function printSummary(results, report) {
  const total = results.pass + results.fail + results.warn;
  console.log(BOLD('\n━━━  AUDIT SUMMARY  ━━━\n'));
  console.log(`  \x1b[32mPASS: ${results.pass}\x1b[0m`);
  console.log(`  \x1b[33mWARN: ${results.warn}\x1b[0m`);
  console.log(`  \x1b[31mFAIL: ${results.fail}\x1b[0m`);
  console.log(`  Total checks: ${total}`);

  if (results.fail === 0 && results.warn === 0) {
    console.log('\n  \x1b[1m\x1b[32m🟢 ALL SYSTEMS OPERATIONAL\x1b[0m\n');
  } else if (results.fail === 0) {
    console.log('\n  \x1b[1m\x1b[33m🟡 MOSTLY OPERATIONAL — review warnings above\x1b[0m\n');
  } else {
    console.log('\n  \x1b[1m\x1b[31m🔴 FAILURES DETECTED — see items above\x1b[0m\n');
  }
}

runAudit().catch((err) => {
  console.error('Audit script crashed:', err.message);
  process.exit(1);
});
