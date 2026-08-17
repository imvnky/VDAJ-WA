/**
 * VDAJ Services — Seed Script
 * Creates the SuperAdmin user with a correct bcrypt hash.
 * Run once: node src/database/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');

async function seed() {
  const password = 'VDAJAdmin@2025!';
  const hash = await bcrypt.hash(password, 12);

  console.log('Generated hash:', hash);

  // Upsert superadmin user
  await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_verified)
     VALUES ($1, $2, $3, $4, 'super_admin', TRUE, TRUE)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           first_name    = EXCLUDED.first_name,
           last_name     = EXCLUDED.last_name,
           is_active     = TRUE,
           is_verified   = TRUE,
           updated_at    = NOW()
     RETURNING id, email, role`,
    ['admin@vdajservices.com', hash, 'Venkatesh', 'Joshi']
  );

  // Verify
  const result = await query('SELECT id, email, role, is_active FROM users WHERE email = $1', ['admin@vdajservices.com']);
  console.log('\n✅ SuperAdmin user ready:');
  console.table(result.rows);

  // Test bcrypt compare immediately
  const testHash = result.rows[0] ? (await query('SELECT password_hash FROM users WHERE email = $1', ['admin@vdajservices.com'])).rows[0].password_hash : null;
  if (testHash) {
    const match = await bcrypt.compare(password, testHash);
    console.log(`\n✅ Password verify test: ${match ? 'PASS ✓' : 'FAIL ✗'}`);
  }

  await pool.end();
  console.log('\n🚀 Seed complete. Login with: admin@vdajservices.com / VDAJAdmin@2025!');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
