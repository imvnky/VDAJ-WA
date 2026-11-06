/**
 * VDAJ Services — Meta WhatsApp Display Name Review Submitter
 * ────────────────────────────────────────────────────────────
 * Programmatically submits a WhatsApp display name for official Meta review
 * and checks its review status (APPROVED, PENDING_REVIEW, DECLINED).
 *
 * Usage:
 *   node backend/scripts/submit_display_name_review.js <PHONE_NUMBER_ID> <META_ACCESS_TOKEN> [DISPLAY_NAME]
 *
 * Or set environment variables:
 *   PHONE_NUMBER_ID=... META_ACCESS_TOKEN=... node backend/scripts/submit_display_name_review.js
 */

const https = require('https');

const phoneId = process.argv[2] || process.env.PHONE_NUMBER_ID || '1470208946166204';
const token = process.argv[3] || process.env.META_ACCESS_TOKEN;
const displayName = process.argv[4] || process.env.DISPLAY_NAME || 'Perfect Travels';

if (!token) {
  console.error('\x1b[31m[ERROR]\x1b[0m Meta Access Token is required.');
  console.log('\nUsage:');
  console.log('  node backend/scripts/submit_display_name_review.js <PHONE_NUMBER_ID> <META_ACCESS_TOKEN> "Perfect Travels"\n');
  process.exit(1);
}

function callMetaApi(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('\x1b[36m====================================================\x1b[0m');
  console.log('\x1b[36m  VDAJ — META DISPLAY NAME REVIEW SUBMISSION TOOL   \x1b[0m');
  console.log('\x1b[36m====================================================\x1b[0m\n');
  console.log(`Target Phone ID : ${phoneId}`);
  console.log(`Requested Name  : "${displayName}"\n`);

  // Step 1: Check Current Status
  console.log('[1/3] Checking current phone number details from Meta...');
  const current = await callMetaApi('GET', `${phoneId}?fields=display_phone_number,verified_name,name_status,quality_rating,code_verification_status`);
  
  if (current.data?.error) {
    console.error('\x1b[31m[FAILED]\x1b[0m Meta API Error:', current.data.error.message);
    process.exit(1);
  }

  console.log('Current Phone Number :', current.data.display_phone_number || 'N/A');
  console.log('Current Verified Name:', current.data.verified_name || '(None)');
  console.log('Current Name Status  :', current.data.name_status || '(Unsubmitted)');
  console.log('Quality Rating       :', current.data.quality_rating || 'N/A');
  console.log('----------------------------------------------------');

  // Step 2: Submit new_display_name to Meta for Review
  console.log(`\n[2/3] Submitting "${displayName}" for Meta Review...`);
  const submitRes = await callMetaApi('POST', phoneId, {
    new_display_name: displayName,
  });

  if (submitRes.data?.error) {
    console.error('\x1b[31m[FAILED]\x1b[0m Meta Review Submission Error:', submitRes.data.error.message);
    if (submitRes.data.error.error_user_title) {
      console.error('Details:', submitRes.data.error.error_user_title, '-', submitRes.data.error.error_user_msg);
    }
    process.exit(1);
  }

  console.log('\x1b[32m[SUCCESS]\x1b[0m Display name change request submitted to Meta!');
  console.log('API Response:', JSON.stringify(submitRes.data));

  // Step 3: Fetch updated status
  console.log('\n[3/3] Fetching updated name review status...');
  const updated = await callMetaApi('GET', `${phoneId}?fields=display_phone_number,verified_name,name_status`);
  console.log('Updated Verified Name:', updated.data?.verified_name);
  console.log('Updated Name Status  :', `\x1b[33m${updated.data?.name_status}\x1b[0m`);

  console.log('\n\x1b[32m✔ Submission Complete.\x1b[0m');
  console.log('Meta will review the display name. Once name_status is APPROVED:');
  console.log('Re-register the number using your 6-digit PIN to propagate the name to WhatsApp:');
  console.log(`  curl -X POST "https://graph.facebook.com/v21.0/${phoneId}/register" -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d \'{"messaging_product":"whatsapp","pin":"<YOUR_6_DIGIT_PIN>"}\'`);
}

run().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

