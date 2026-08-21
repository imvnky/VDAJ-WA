const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'vdaj_user',
  password: 'vdaj_secure_2025',
  database: 'vdaj_whatsapp_db'
});

async function run() {
  try {
    const res = await pool.query("SELECT id, email, password_hash FROM users WHERE email = 'admin@idealdentalcare.in'");
    if (res.rows.length === 0) {
      console.log('User not found');
      return;
    }
    const user = res.rows[0];
    console.log('User:', user.email);
    
    const isMatch = await bcrypt.compare('VDAJAdmin@2025!', user.password_hash);
    console.log('Password Match for VDAJAdmin@2025! :', isMatch);

    // If it doesn't match, let's reset it to make sure they can log in
    if (!isMatch) {
      console.log('Resetting password to VDAJAdmin@2025! ...');
      const hash = await bcrypt.hash('VDAJAdmin@2025!', 10);
      await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [hash, user.email]);
      console.log('Password reset successfully.');
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
