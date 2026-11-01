'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const jwt = require('jsonwebtoken');
const { query, pool } = require('../src/config/database');

async function generateToken() {
  console.log('\n======================================================');
  console.log('🔑 GENERATING PORTAL API TOKEN FOR SMR INTEGRATION');
  console.log('======================================================\n');

  // 1. Find SMR tenant or create if not present
  let { rows: tenants } = await query(
    `SELECT id, name, slug FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' LIMIT 1`
  );

  let tenant = tenants[0];
  if (!tenant) {
    console.log('SMR tenant not found in local DB. Looking up any active tenant or creating SMR...');
    const { rows: anyTenants } = await query(`SELECT id, name FROM tenants LIMIT 1`);
    tenant = anyTenants[0];
  }

  if (!tenant) {
    console.error('❌ No tenant found.');
    await pool.end();
    return;
  }

  // 2. Find user in this tenant
  let { rows: users } = await query(
    `SELECT id, email, first_name, last_name, role FROM users WHERE tenant_id = $1 AND is_active = TRUE LIMIT 1`,
    [tenant.id]
  );

  let user = users[0];
  if (!user) {
    // If no user in tenant, get first admin user
    const { rows: admins } = await query(
      `SELECT id, email, first_name, last_name, role FROM users WHERE is_active = TRUE LIMIT 1`
    );
    user = admins[0];
  }

  if (!user) {
    console.error('❌ No user found.');
    await pool.end();
    return;
  }

  // 3. Sign a long-lived JWT token (1 year)
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, tenantId: tenant.id },
    process.env.JWT_SECRET,
    { expiresIn: '365d' }
  );

  console.log(`🏢 Workspace: ${tenant.name} (${tenant.id})`);
  console.log(`👤 User:      ${user.email} (${user.role})`);
  console.log('\n🎯 SMR_PORTAL_TOKEN (Valid for 1 Year):\n');
  console.log(token);
  console.log('\n======================================================\n');

  await pool.end();
}

generateToken().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});

