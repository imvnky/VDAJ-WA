/**
 * VDAJ Services — Convert SMR Committee Names to English
 * ────────────────────────────────────────────────────────
 * Converts all committee members from Marathi script to professional English.
 * Cleans up any mismatched first_name/last_name combinations.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

const COMMITTEE_ENGLISH_MAP = [
  { phone: '9420933333', firstName: 'Laxmiraman', lastName: 'Lahoti' },
  { phone: '9881955555', firstName: 'Shaileshkumar', lastName: 'Lahoti' },
  { phone: '9423076701', firstName: 'Rajendrakumar', lastName: 'Malpani' },
  { phone: '7888013050', firstName: 'Ashish', lastName: 'Bajpai' },
  { phone: '9422470222', firstName: 'Kamalkishor', lastName: 'Agrawal' },
  { phone: '9823025258', firstName: 'Hukumchand', lastName: 'Kalantri' },
  { phone: '8888888525', firstName: 'Ashish', lastName: 'Agrawal' },
  { phone: '9822602737', firstName: 'Chaitanya', lastName: 'Bhargav' },
  { phone: '9850022500', firstName: 'Ashish', lastName: 'Baheti' },
  { phone: '9422071374', firstName: 'Sanjay', lastName: 'Gaikwad' },
  { phone: '9422071855', firstName: 'Dhanraj', lastName: 'Joshi' },
  { phone: '9822295627', firstName: 'Abhay', lastName: 'Shah' },
  { phone: '9823177446', firstName: 'Ganesh', lastName: 'Hedda' },
  { phone: '9049338338', firstName: 'Nikhil', lastName: 'Rathi' },
  { phone: '9325345298', firstName: 'Manish', lastName: 'Rathi' },
  { phone: '9850047778', firstName: 'Ashish', lastName: 'Somani' },
  { phone: '9850153322', firstName: 'Anand', lastName: 'Lakhotia' },
  { phone: '9422070183', firstName: 'Ajay', lastName: 'Mantri' },
  { phone: '9422070500', firstName: 'Deepak', lastName: 'Baheti' },
  { phone: '94222878588', firstName: 'Deepak', lastName: 'Baheti' }, // In case entered with prefix/suffix
];

async function convertToEnglish() {
  console.log('\n======================================================');
  console.log('🔤 CONVERTING SMR COMMITTEE NAMES TO ENGLISH');
  console.log('======================================================\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug FROM tenants 
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' 
     ORDER BY created_at ASC LIMIT 1`
  );
  if (!tenants.length) {
    console.error('❌ SMR Tenant not found');
    return;
  }
  const tenant = tenants[0];
  console.log(`✔ Tenant: ${tenant.name} (${tenant.id})\n`);

  let updated = 0;
  for (const c of COMMITTEE_ENGLISH_MAP) {
    const rawDigits = c.phone.replace(/[^0-9]/g, '');
    const p10 = rawDigits.slice(-10);
    const phoneE164 = `+91${p10}`;

    const { rowCount } = await query(
      `UPDATE contacts
       SET first_name  = $1,
           last_name   = $2,
           updated_at  = NOW()
       WHERE tenant_id = $3
         AND phone_e164 LIKE '%' || $4`,
      [c.firstName, c.lastName, tenant.id, p10]
    );

    if (rowCount > 0) {
      console.log(`  ✔ Updated: ${c.firstName} ${c.lastName} (${phoneE164})`);
      updated++;
    }
  }

  // Also clean up any remaining contacts with Marathi script in their first_name/last_name
  const { rows: remainingMarathi } = await query(
    `SELECT id, phone_e164, first_name, last_name 
     FROM contacts 
     WHERE tenant_id = $1 
       AND (first_name ~ '[\\u0900-\\u097F]' OR last_name ~ '[\\u0900-\\u097F]')`,
    [tenant.id]
  );

  if (remainingMarathi.length > 0) {
    console.log(`\nFound ${remainingMarathi.length} additional contacts with Marathi characters:`);
    for (const r of remainingMarathi) {
      console.log(`  - ${r.phone_e164}: "${r.first_name}" "${r.last_name}"`);
    }
  }

  console.log('\n======================================================');
  console.log(`🎉 COMPLETED! Successfully updated ${updated} contacts to English.`);
  console.log('======================================================\n');
}

convertToEnglish()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Error:', err);
    pool.end();
  });
