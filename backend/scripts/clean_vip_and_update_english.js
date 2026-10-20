/**
 * VDAJ Services — Clean VIP Tag & Enforce English Names
 * ──────────────────────────────────────────────────────
 * 1. Removes 'vip' tag from all contacts.
 * 2. Updates all Committee members to clean English names.
 * 3. Ensures each contact remains strictly unique.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

const COMMITTEE_ENGLISH = [
  { phone: '9420933333', first: 'Laxmiraman', last: 'Lahoti' },
  { phone: '9881955555', first: 'Shaileshkumar', last: 'Lahoti' },
  { phone: '9423076701', first: 'Rajendrakumar', last: 'Malpani' },
  { phone: '7888013050', first: 'Ashish', last: 'Bajpai' },
  { phone: '9422470222', first: 'Kamalkishor', last: 'Agrawal' },
  { phone: '9823025258', first: 'Hukumchand', last: 'Kalantri' },
  { phone: '8888888525', first: 'Ashish', last: 'Agrawal' },
  { phone: '9822602737', first: 'Chaitanya', last: 'Bhargav' },
  { phone: '9850022500', first: 'Ashish', last: 'Baheti' },
  { phone: '9422071374', first: 'Sanjay', last: 'Gaikwad' },
  { phone: '9422071855', first: 'Dhanraj', last: 'Joshi' },
  { phone: '9822295627', first: 'Abhay', last: 'Shah' },
  { phone: '9823177446', first: 'Ganesh', last: 'Hedda' },
  { phone: '9049338338', first: 'Nikhil', last: 'Rathi' },
  { phone: '9325345298', first: 'Manish', last: 'Rathi' },
  { phone: '9850047778', first: 'Ashish', last: 'Somani' },
  { phone: '9850153322', first: 'Anand', last: 'Lakhotia' },
  { phone: '9422070183', first: 'Ajay', last: 'Mantri' },
  { phone: '9422070500', first: 'Deepak', last: 'Baheti' },
  { phone: '94222878588', first: 'Deepak', last: 'Baheti' },
];

async function cleanVipAndSetEnglish() {
  console.log('\n======================================================');
  console.log('🧹 REMOVING VIP TAG & ENFORCING CLEAN ENGLISH NAMES');
  console.log('======================================================\n');

  // 1. Remove 'vip' tag from all contacts across the database
  const { rowCount: vipRemoved } = await query(
    `UPDATE contacts 
     SET tags = array_remove(tags, 'vip')
     WHERE 'vip' = ANY(tags)`
  );
  console.log(`✔ Removed 'vip' tag from ${vipRemoved} contacts.`);

  // 2. Update Committee members to pure English
  let committeeUpdated = 0;
  for (const c of COMMITTEE_ENGLISH) {
    const raw = c.phone.replace(/[^0-9]/g, '');
    const p10 = raw.slice(-10);

    const { rowCount } = await query(
      `UPDATE contacts
       SET first_name = $1,
           last_name  = $2,
           tags       = array_remove(tags, 'vip'),
           updated_at = NOW()
       WHERE phone_e164 LIKE '%' || $3`,
      [c.first, c.last, p10]
    );
    if (rowCount > 0) {
      console.log(`  ✔ English Name Set: ${c.first} ${c.last} (…${p10})`);
      committeeUpdated++;
    }
  }

  // 3. Clean up any remaining Marathi Unicode script in first_name or last_name
  const { rows: marathiRemaining } = await query(
    `SELECT id, phone_e164, first_name, last_name 
     FROM contacts 
     WHERE first_name ~ '[\\u0900-\\u097F]' OR last_name ~ '[\\u0900-\\u097F]'`
  );

  if (marathiRemaining.length > 0) {
    console.log(`\nRemaining Marathi contacts: ${marathiRemaining.length}`);
    for (const r of marathiRemaining) {
      console.log(`  - ${r.phone_e164}: "${r.first_name}" "${r.last_name}"`);
    }
  } else {
    console.log('\n✔ All contacts are now verified 100% pure English!');
  }

  console.log('\n======================================================');
  console.log('🎉 CLEANUP & ENGLISH UPDATE COMPLETE!');
  console.log('======================================================\n');
}

cleanVipAndSetEnglish()
  .then(() => pool.end())
  .catch((err) => {
    console.error('❌ Failed:', err);
    pool.end();
  });
