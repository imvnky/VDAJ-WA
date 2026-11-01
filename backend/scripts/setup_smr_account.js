'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function setupSmrAccount() {
  console.log('\n======================================================');
  console.log('🏊 SMR SWIMMING POOL — DEDICATED ACCOUNT & TOKEN SETUP');
  console.log('======================================================\n');

  // 1. Resolve SMR tenant
  const { rows: tenants } = await query(
    `SELECT id, name, slug FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' LIMIT 1`
  );
  if (!tenants.length) {
    console.error('❌ SMR tenant not found.');
    await pool.end();
    return;
  }
  const tenant = tenants[0];

  // 2. Ensure SMR Dedicated User exists
  const email = 'admin@smrswimming.com';
  let { rows: users } = await query(`SELECT id, email, role, tenant_id FROM users WHERE email = $1`, [email]);

  let user = users[0];
  if (!user) {
    const passwordHash = await bcrypt.hash('SMRAdmin@2026!', 10);
    const { rows: [newUser] } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_verified, tenant_id)
       VALUES ($1, $2, 'SMR', 'Admin', 'tenant_admin', TRUE, TRUE, $3)
       RETURNING id, email, role, tenant_id`,
      [email, passwordHash, tenant.id]
    );
    user = newUser;
    console.log(`✔ Created dedicated SMR user: ${user.email} (ID: ${user.id})`);
  } else {
    await query(`UPDATE users SET tenant_id = $1, is_active = TRUE WHERE id = $2`, [tenant.id, user.id]);
    console.log(`✔ Found SMR user: ${user.email} (ID: ${user.id})`);
  }

  // 3. Generate 1-Year JWT Token locked strictly to SMR
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: 'tenant_admin', tenantId: tenant.id },
    process.env.JWT_SECRET,
    { expiresIn: '365d' }
  );

  console.log(`\n🏢 Workspace: ${tenant.name}`);
  console.log(`🔒 Workspace ID: ${tenant.id}`);
  console.log(`👤 Bound User: ${user.email}`);
  console.log('\n======================================================');
  console.log('🔑 EXACT TOKEN FOR DEVELOPER (Valid for 1 Year):');
  console.log('======================================================\n');
  console.log(token);
  console.log('\n======================================================\n');

  await pool.end();
}

setupSmrAccount().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
});

