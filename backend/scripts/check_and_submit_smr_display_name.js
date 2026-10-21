/**
 * VDAJ Services — SMR Meta Display Name Submission & Profile Audit
 * ─────────────────────────────────────────────────────────────────
 * 1. Checks current Meta phone number details & name_status
 * 2. Checks WhatsApp Business Profile (Category/Vertical, Websites, Bio)
 * 3. Submits "SMR Swimming Pool & Health Club" to Meta Graph API
 * 4. Checks review status & attempts certificate activation via register endpoint
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { query, pool } = require('../src/config/database');

async function run() {
  console.log('\n================================================================');
  console.log('🏊 SMR SWIMMING POOL & HEALTH CLUB — META DISPLAY NAME & AUDIT');
  console.log('================================================================\n');

  // 1. Locate SMR Tenant in database
  const { rows: tenants } = await query(
    `SELECT id, name, slug, waba_id, phone_number_id, display_phone_number, verified_name, meta_system_token
     FROM tenants
     WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%'
     LIMIT 1`
  );

  if (!tenants.length) {
    console.error('❌ Could not find SMR tenant in database.');
    await pool.end();
    process.exit(1);
  }

  const t = tenants[0];
  const token = t.meta_system_token || process.env.META_ACCESS_TOKEN;
  const phoneId = t.phone_number_id;
  const wabaId = t.waba_id;
  const TARGET_NAME = 'SMR Swimming Pool & Health Club';

  console.log(`🏢 Tenant Name:        ${t.name}`);
  console.log(`📞 Phone Number ID:    ${phoneId}`);
  console.log(`💼 WABA ID:            ${wabaId}`);
  console.log(`🎯 Target Display Name: "${TARGET_NAME}"\n`);

  if (!phoneId || !token) {
    console.error('❌ Missing phone_number_id or meta_system_token for this tenant.');
    await pool.end();
    process.exit(1);
  }

  // 2. Fetch current Meta Phone Number Status
  console.log('📡 STEP 1: Querying Meta Graph API for Phone Number & Display Name Status...');
  let phoneData = {};
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status,quality_rating,status,code_verification_status&access_token=${token}`
    );
    phoneData = await res.json();
    console.log('--- Current Phone Info from Meta ---');
    console.log(`Phone Number:     ${phoneData.display_phone_number || 'N/A'}`);
    console.log(`Verified Name:    ${phoneData.verified_name || 'NONE (Unapproved)'}`);
    console.log(`Name Status:      ${phoneData.name_status || 'NOT_SUBMITTED'}`);
    console.log(`New Name:         ${phoneData.new_display_name || 'None'}`);
    console.log(`New Name Status:  ${phoneData.new_name_status || 'None'}`);
    console.log(`Status:           ${phoneData.status || 'N/A'}`);
    console.log(`Quality Rating:   ${phoneData.quality_rating || 'N/A'}`);
    if (phoneData.error) {
      console.error('Meta API Error:', JSON.stringify(phoneData.error, null, 2));
    }
  } catch (err) {
    console.error('❌ Failed to query phone number:', err.message);
  }

  // 3. Fetch current WhatsApp Business Profile (Category, Websites, Bio)
  console.log('\n🔍 STEP 2: Checking Business Profile & Category/Vertical Linkage...');
  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical&access_token=${token}`
    );
    const profileData = await profileRes.json();
    const prof = profileData?.data?.[0] || {};
    console.log('--- WhatsApp Business Profile Details ---');
    console.log(`Category (Vertical): ${prof.vertical || 'NOT SET'}`);
    console.log(`Websites:            ${(prof.websites || []).join(', ') || 'None'}`);
    console.log(`About:               ${prof.about || 'None'}`);
    console.log(`Description:         ${prof.description || 'None'}`);
    console.log(`Address:             ${prof.address || 'None'}`);
  } catch (err) {
    console.error('❌ Failed to fetch business profile:', err.message);
  }

  // 4. Ensure Category is set to ENTERTAIN or OTHER if missing
  console.log('\n⚙️ STEP 3: Ensuring Category is Properly Aligned...');
  try {
    const updateRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/whatsapp_business_profile`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          vertical: 'ENTERTAIN', // Entertainment & Recreation
          description: 'SMR Swimming Pool & Health Club — Premium swimming, fitness and sports facility.'
        })
      }
    );
    const updateData = await updateRes.json();
    if (updateData.success) {
      console.log('✅ Business Profile category updated to ENTERTAIN (Recreation & Sports).');
    } else {
      console.log('Profile Category response:', JSON.stringify(updateData));
    }
  } catch (err) {
    console.log('Notice: Could not update category directly:', err.message);
  }

  // 5. Submit Display Name if not already verified
  if (phoneData.verified_name !== TARGET_NAME) {
    console.log(`\n🚀 STEP 4: Submitting Exact Display Name "${TARGET_NAME}" to Meta...`);
    try {
      const submitUrl = `https://graph.facebook.com/v21.0/${phoneId}?new_display_name=${encodeURIComponent(TARGET_NAME)}&access_token=${token}`;
      const submitRes = await fetch(submitUrl, { method: 'POST' });
      const submitData = await submitRes.json();
      console.log('Meta Submission Response:', JSON.stringify(submitData, null, 2));

      if (submitData.success) {
        console.log(`✅ Display name "${TARGET_NAME}" successfully submitted to Meta!`);
      }
    } catch (err) {
      console.error('❌ Submission request failed:', err.message);
    }

    // Check updated status
    console.log('\n📡 STEP 5: Verifying Updated Meta Review Status...');
    try {
      const checkRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status,status&access_token=${token}`
      );
      const checkData = await checkRes.json();
      console.log('--- Post-Submission Status ---');
      console.log(`Verified Name:   ${checkData.verified_name || 'Pending'}`);
      console.log(`Name Status:     ${checkData.name_status}`);
      console.log(`New Name:        ${checkData.new_display_name}`);
      console.log(`New Name Status: ${checkData.new_name_status}`);

      if (checkData.new_name_status === 'APPROVED' || checkData.name_status === 'APPROVED') {
        console.log('\n🎉 Name is APPROVED! Attempting phone re-registration to activate certificate...');
        const regRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/register`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ messaging_product: 'whatsapp' })
        });
        const regData = await regRes.json();
        console.log('Registration response:', JSON.stringify(regData));
      }
    } catch (err) {
      console.error('Check error:', err.message);
    }
  } else {
    console.log(`\n✅ Verified name is ALREADY "${TARGET_NAME}" on Meta!`);
  }

  await pool.end();
  console.log('\n================================================================\n');
}

run().catch(async (err) => {
  console.error('Fatal execution error:', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
