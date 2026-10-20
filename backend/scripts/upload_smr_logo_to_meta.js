/**
 * Direct Script to Upload SMR Emblem to Meta WhatsApp Profile
 */
'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');
const { uploadBusinessProfilePicture } = require('../src/services/metaApiService');

async function uploadLogo() {
  console.log('\n======================================================');
  console.log('🖼 UPLOADING SMR LOGO DIRECTLY TO META WHATSAPP PROFILE');
  console.log('======================================================\n');

  const { rows: tenants } = await query(
    `SELECT id, name, slug, phone_number_id, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%'
     LIMIT 1`
  );

  if (!tenants.length) {
    console.error('❌ SMR tenant not found.');
    process.exit(1);
  }

  const t = tenants[0];
  const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = t.phone_number_id;

  const logoPath = path.resolve(__dirname, '../assets/smr_logo.png');
  if (!fs.existsSync(logoPath)) {
    console.error(`❌ Logo file not found at ${logoPath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(logoPath);
  console.log(`Workspace: ${t.name}`);
  console.log(`Phone ID:  ${phoneId}`);
  console.log(`Logo Size: ${(fileBuffer.length / 1024).toFixed(1)} KB`);
  console.log('\nStreaming image to Meta Resumable Upload session...');

  const result = await uploadBusinessProfilePicture(phoneId, token, fileBuffer, 'image/png');
  console.log('\nMeta API Response:', result);

  if (result?.success) {
    console.log('\n✅ SUCCESS: Profile photo successfully attached to WhatsApp Phone Number on Meta!');
    console.log('Meta will now distribute it across the global WhatsApp edge network.');
  }

  await pool.end();
}

uploadLogo().catch((err) => {
  console.error('\n❌ Upload failed:', err.message || err);
  process.exit(1);
});
