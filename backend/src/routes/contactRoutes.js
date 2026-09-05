/**
 * VDAJ Services — Contact Routes
 * CRUD for contacts + contact lists.
 *
 * Sprint 2: Added POST /contacts/bulk — transactional batch upsert from CSV import.
 */

const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../config/database');
const { sendSuccess, sendCreated, catchAsync } = require('../middleware/responseHandler');
const { authenticate } = require('../middleware/authMiddleware');
const { contactValidators, uuidParamValidator, validate } = require('../middleware/validationMiddleware');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');

router.use(authenticate);

// ── GET /contacts ─────────────────────────────────────────────
router.get('/', catchAsync(async (req, res) => {
  const { page = 1, limit = 50, search, status, tag } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE c.tenant_id = $1';
  const params = [req.user.tenantId];
  let idx = 2;

  if (search) {
    whereClause += ` AND (c.phone_e164 ILIKE $${idx} OR c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }
  if (status) {
    whereClause += ` AND c.status = $${idx}`;
    params.push(status);
    idx++;
  }
  // Tag filter — uses GIN index for efficiency
  if (tag) {
    whereClause += ` AND $${idx} = ANY(c.tags)`;
    params.push(tag);
    idx++;
  }

  const { rows } = await query(
    `SELECT c.*, COUNT(*) OVER() AS total_count
     FROM contacts c
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  const total = parseInt(rows[0]?.total_count || 0, 10);
  return sendSuccess(res, rows, 'Contacts fetched.', 200, {
    page: +page,
    limit: +limit,
    total,
  });
}));

// ── POST /contacts — Single contact ───────────────────────────
router.post('/', contactValidators, validate, catchAsync(async (req, res) => {
  const { phoneE164, firstName, lastName, email, customVars } = req.body;

  const { rows: [contact] } = await query(
    `INSERT INTO contacts (tenant_id, phone_e164, first_name, last_name, email, custom_vars)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id, phone_e164) DO NOTHING
     RETURNING *`,
    [
      req.user.tenantId,
      phoneE164,
      firstName || null,
      lastName || null,
      email || null,
      JSON.stringify(customVars || {}),
    ]
  );

  if (!contact) throw new AppError('Contact already exists.', 409, 'ERR_VDAJ_CONT_003');
  return sendCreated(res, contact, 'Contact created.');
}));

// ── POST /contacts/bulk — CSV batch upsert ────────────────────
// Body: {
//   contacts: [{phoneE164, firstName, lastName, email, customVars}],
//   listId?,
//   opt_in_source?,   -- How contacts consented (required for BSP compliance)
//   opt_in_proof?,    -- Free-text proof (e.g. 'Web form on /sign-up page')
// }
//
// BSP Compliance Note:
//   opt_in_source is strongly recommended and will default to 'import' if
//   omitted.  Meta requires proof of consent for every number you message.
//   Accepted values: 'import' | 'web_form' | 'manual' | 'api' | 'verbal'
router.post('/bulk', catchAsync(async (req, res) => {
  const {
    contacts:    rawContacts,
    listId,
    newListName,
    tags          = [],
    opt_in_source = 'import',          // default: bulk import
    opt_in_proof  = 'Bulk CSV import', // fallback proof text
  } = req.body;

  if (!Array.isArray(rawContacts) || rawContacts.length === 0) {
    throw new AppError('contacts array is required and must not be empty.', 400, 'ERR_VDAJ_VAL_001');
  }

  // Resolve tenant ID safely (handles super_admin gracefully)
  let tenantId = req.user.tenantId || req.tenant?.id;
  if (!tenantId) {
    const { rows: [firstTenant] } = await query(
      `SELECT id FROM tenants WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`
    );
    tenantId = firstTenant?.id;
  }

  if (!tenantId) {
    throw new AppError('Tenant workspace could not be identified.', 400, 'ERR_VDAJ_TENANT_001');
  }

  const MAX_BULK = 5000;
  if (rawContacts.length > MAX_BULK) {
    throw new AppError(
      `Bulk import is limited to ${MAX_BULK} contacts per request. Split your CSV into smaller chunks.`,
      400,
      'ERR_VDAJ_CONT_004'
    );
  }

  // Parse tags array
  const cleanTags = Array.isArray(tags)
    ? tags.map((t) => String(t).trim()).filter(Boolean)
    : String(tags || '').split(',').map((t) => t.trim()).filter(Boolean);

  // ── Server-side E.164 validation + sanitization ───────────
  const E164_REGEX = /^\+[1-9]\d{7,14}$/;
  const valid   = [];
  const invalid = [];

  for (const raw of rawContacts) {
    let phone = String(raw.phoneE164 || '').trim().replace(/^['"\t]+|['"\t]+$/g, '');
    if (/^[0-9.]+[eE]\+[0-9]+$/.test(phone)) {
      try { phone = BigInt(Math.round(Number(phone))).toString(); } catch {}
    }
    phone = phone.replace(/[\s\-().]/g, '');
    if (/^[6-9]\d{9}$/.test(phone)) {
      phone = '+91' + phone;
    } else if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }

    if (!E164_REGEX.test(phone)) {
      invalid.push({ raw: raw.phoneE164, reason: 'invalid_e164' });
      continue;
    }

    valid.push({
      phone,
      firstName:  raw.firstName  || null,
      lastName:   raw.lastName   || null,
      email:      raw.email      || null,
      customVars: raw.customVars || {},
    });
  }

  if (valid.length === 0) {
    return sendSuccess(res, { inserted: 0, updated: 0, invalidCount: invalid.length }, 'No valid contacts to import.', 200);
  }

  // ── Build parallel arrays for UNNEST bulk insert ───────────
  const phones      = valid.map((c) => c.phone);
  const firstNames  = valid.map((c) => c.firstName);
  const lastNames   = valid.map((c) => c.lastName);
  const emails      = valid.map((c) => c.email);
  const customVarsArr = valid.map((c) => JSON.stringify(c.customVars));

  let inserted = 0;
  let updated  = 0;
  let newContactIds = [];

  await withTransaction(async (client) => {
    // ── Ensure contacts.tags column exists in DB (idempotent) ──
    await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`);

    // ── Create or resolve target listId ───────────────────────
    let targetListId = listId || null;

    if (!targetListId && newListName?.trim()) {
      const { rows: [createdList] } = await client.query(
        `INSERT INTO contact_lists (tenant_id, name, description, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [tenantId, newListName.trim(), 'Created during contact import', req.user.id]
      );
      if (createdList) {
        targetListId = createdList.id;
      }
    } else if (targetListId) {
      const { rows: listRows } = await client.query(
        `SELECT id FROM contact_lists WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [targetListId, tenantId]
      );
      if (!listRows.length) {
        throw new AppError('Contact list not found.', 404, 'ERR_VDAJ_CONT_002');
      }
    }

    // ── Bulk upsert using UNNEST (single round-trip to DB) ────
    const { rows: upserted } = await client.query(
      `INSERT INTO contacts
         (tenant_id, phone_e164, first_name, last_name, email, custom_vars, tags)
       SELECT
         $1,
         phone, first_name, last_name, email,
         custom_vars::jsonb,
         $7::text[]
       FROM UNNEST(
         $2::text[], $3::text[], $4::text[], $5::text[], $6::text[]
       ) AS t(phone, first_name, last_name, email, custom_vars)
       ON CONFLICT (tenant_id, phone_e164) DO UPDATE
         SET
           first_name  = COALESCE(EXCLUDED.first_name,  contacts.first_name),
           last_name   = COALESCE(EXCLUDED.last_name,   contacts.last_name),
           email       = COALESCE(EXCLUDED.email,       contacts.email),
           custom_vars = contacts.custom_vars || EXCLUDED.custom_vars,
           tags        = CASE
                           WHEN array_length($7::text[], 1) > 0
                           THEN COALESCE(contacts.tags, '{}'::text[]) || $7::text[]
                           ELSE contacts.tags
                         END,
           updated_at  = NOW()
       RETURNING id, (xmax = 0) AS is_new`,
      [
        tenantId,
        phones,
        firstNames,
        lastNames,
        emails,
        customVarsArr,
        cleanTags,
      ]
    );

    inserted       = upserted.filter((r) => r.is_new).length;
    updated        = upserted.filter((r) => !r.is_new).length;
    newContactIds  = upserted.map((r) => r.id);

    // ── Add all contacts to the specified list ─────────────────
    if (targetListId && newContactIds.length > 0) {
      await client.query(
        `INSERT INTO contact_list_members (contact_list_id, contact_id)
         SELECT $1, UNNEST($2::uuid[])
         ON CONFLICT DO NOTHING`,
        [targetListId, newContactIds]
      );
    }

    // ── BSP Compliance: record opt-in consent for all upserted contacts ──
    // Only set where opted_in_at IS NULL so explicit consent (web_form,
    // manual, etc.) recorded before this import is never overwritten.
    if (newContactIds.length > 0) {
      const proof = opt_in_proof?.trim()
        || `Bulk import by user ${req.user.id} on ${new Date().toISOString().slice(0, 10)}`;

      await client.query(
        `UPDATE contacts
           SET opted_in_at   = COALESCE(opted_in_at,   NOW()),
               opt_in_source = COALESCE(opt_in_source, $3),
               opt_in_proof  = COALESCE(opt_in_proof,  $4),
               updated_at    = NOW()
         WHERE id = ANY($1::uuid[])
           AND tenant_id = $2`,
        [newContactIds, tenantId, opt_in_source, proof]
      );

      // Insert audit records into opt_in_events (one row per newly inserted contact)
      // Only log truly NEW rows (is_new = true) to avoid duplicate audit noise on updates.
      const newlyInsertedIds = upserted.filter(r => r.is_new).map(r => r.id);
      if (newlyInsertedIds.length > 0) {
        await client.query(
          `INSERT INTO opt_in_events (tenant_id, contact_id, phone_e164, source, proof, ip_address)
           SELECT $1, c.id, c.phone_e164, $3, $4, $5
           FROM contacts c
           WHERE c.id = ANY($2::uuid[]) AND c.tenant_id = $1`,
          [
            tenantId,
            newlyInsertedIds,
            opt_in_source,
            proof,
            req.ip || null,
          ]
        );
      }
    }
  });

  // Record enterprise audit trail
  recordAudit({
    tenantId,
    userId: req.user.id,
    action: 'CONTACTS_BULK_IMPORT',
    resourceType: 'contacts',
    status: 'SUCCESS',
    meta: {
      total: valid.length,
      inserted,
      updated,
      invalidCount: invalid.length,
      opt_in_source,
    },
    subTasks: [
      { name: 'Phone Format Validation', details: 'Verify E.164 phone numbering standards', component: 'Validator Engine', status: 'SUCCESS' },
      { name: 'Contact Record Upsert', details: `Upsert ${valid.length} contacts into PostgreSQL store`, component: 'PostgreSQL Store', status: 'SUCCESS' },
      { name: 'Consent Proof Logging', details: `Record Meta BSP opt-in consent proof (${opt_in_source})`, component: 'Compliance Engine', status: 'SUCCESS' },
      ...(targetListId ? [{ name: 'List Association', details: `Assign contacts to contact list ${targetListId}`, component: 'Audience Engine', status: 'SUCCESS' }] : []),
    ],
    ipAddress: req.ip,
  }).catch(() => {});

  return sendSuccess(
    res,
    {
      inserted,
      updated,
      invalidCount: invalid.length,
      total: valid.length,
      ...(invalid.length > 0 ? { invalidSamples: invalid.slice(0, 5) } : {}),
    },
    `Bulk import complete. ${inserted} inserted, ${updated} updated, ${invalid.length} invalid.`
  );
}));

// ── GET /contacts/lists ────────────────────────────────────────
router.get('/lists', catchAsync(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM contact_lists
     WHERE tenant_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [req.user.tenantId]
  );
  return sendSuccess(res, rows, 'Contact lists fetched.');
}));

// ── POST /contacts/lists ───────────────────────────────────────
router.post('/lists', catchAsync(async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) throw new AppError('List name is required.', 400, 'ERR_VDAJ_VAL_005');

  const { rows: [list] } = await query(
    `INSERT INTO contact_lists (tenant_id, name, description, created_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.tenantId, name.trim(), description || null, req.user.id]
  );
  return sendCreated(res, list, 'Contact list created.');
}));

// ── GET /contacts/:id — Full contact detail ────────────────────
router.get('/:id', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const tenantId   = req.user.tenantId;
  const contactId  = req.params.id;

  // 1. Base contact row
  const { rows: [contact] } = await query(
    `SELECT c.*,
            oe.source        AS opt_in_event_source,
            oe.proof         AS opt_in_event_proof,
            oe.ip_address    AS opt_in_event_ip,
            oe.created_at    AS opt_in_event_at
       FROM contacts c
       LEFT JOIN LATERAL (
         SELECT source, proof, ip_address, created_at
           FROM opt_in_events
          WHERE contact_id = c.id
          ORDER BY created_at ASC
          LIMIT 1
       ) oe ON TRUE
      WHERE c.id = $1 AND (c.tenant_id = $2 OR $3 = TRUE)`,
    [contactId, tenantId, req.user.role === 'super_admin']
  );
  if (!contact) throw new AppError('Contact not found.', 404, 'ERR_VDAJ_CONT_001');

  // 2. Latest opt-out event (if any)
  const { rows: [optOutEvent] } = await query(
    `SELECT trigger_keyword, created_at AS opted_out_at
       FROM opt_out_events
      WHERE contact_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [contactId]
  );

  // 3. Campaign history — last 20 messages sent to this contact
  const { rows: campaignHistory } = await query(
    `SELECT
         cm.id,
         ca.name          AS campaign_name,
         cm.status        AS delivery_status,
         cm.wa_message_id,
         cm.sent_at,
         cm.delivered_at,
         cm.read_at,
         cm.failed_at,
         cm.error_message
       FROM campaign_messages cm
       JOIN campaigns ca ON ca.id = cm.campaign_id
      WHERE cm.contact_id = $1
        AND (ca.tenant_id = $2 OR $3 = TRUE)
      ORDER BY cm.created_at DESC
      LIMIT 20`,
    [contactId, tenantId, req.user.role === 'super_admin']
  );

  // 4. Active inbox conversation thread (if exists)
  const { rows: [conversation] } = await query(
    `SELECT id FROM inbox_conversations
      WHERE contact_id = $1 AND (tenant_id = $2 OR $3 = TRUE)
      ORDER BY last_message_at DESC
      LIMIT 1`,
    [contactId, tenantId, req.user.role === 'super_admin']
  );

  return sendSuccess(res, {
    ...contact,
    opt_out_event:     optOutEvent || null,
    campaign_history:  campaignHistory,
    conversation_id:   conversation?.id || null,
  }, 'Contact detail fetched.');
}));

// ── PATCH /contacts/:id/tags — Update tag array ────────────────
router.patch('/:id/tags', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const { tags } = req.body;
  if (!Array.isArray(tags)) throw new AppError('tags must be an array of strings.', 400, 'ERR_VDAJ_VAL_001');

  // Sanitise: lowercase, alphanumeric + dash/underscore, max 30 chars, max 20 tags
  const clean = [...new Set(
    tags.map((t) => String(t).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '').slice(0, 30))
        .filter(Boolean)
  )].slice(0, 20);

  const { rows: [contact] } = await query(
    `UPDATE contacts SET tags = $3, updated_at = NOW()
      WHERE id = $1 AND (tenant_id = $2 OR $4 = TRUE)
      RETURNING id, tags`,
    [req.params.id, req.user.tenantId, clean, req.user.role === 'super_admin']
  );
  if (!contact) throw new AppError('Contact not found.', 404, 'ERR_VDAJ_CONT_001');
  return sendSuccess(res, contact, 'Tags updated.');
}));

// ── PATCH /contacts/:id/status — Toggle between active & opted_out ────
router.patch('/:id/status', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'opted_out'].includes(status)) {
    throw new AppError('Status must be either "active" or "opted_out".', 400, 'ERR_VDAJ_VAL_001');
  }

  const tenantId = req.user.tenantId || req.tenant?.id;
  const isActivating = status === 'active';

  const { rows: [contact] } = await query(
    `UPDATE contacts
     SET status       = $1,
         opted_out_at = $2,
         opted_in_at  = CASE WHEN $3 = TRUE AND opted_in_at IS NULL THEN NOW() ELSE opted_in_at END,
         updated_at   = NOW()
     WHERE id = $4 AND (tenant_id = $5 OR $6 = TRUE)
     RETURNING id, phone_e164, status`,
    [
      status,
      isActivating ? null : new Date(),
      isActivating,
      req.params.id,
      tenantId,
      req.user.role === 'super_admin',
    ]
  );
  if (!contact) throw new AppError('Contact not found.', 404, 'ERR_VDAJ_CONT_001');
  return sendSuccess(res, contact, `Contact status changed to ${status}.`);
}));

// ── PATCH /contacts/:id/opt-out ────────────────────────────────
router.patch('/:id/opt-out', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const { rows: [contact] } = await query(
    `UPDATE contacts
     SET status = 'opted_out', opted_out_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND (tenant_id = $2 OR $3 = TRUE)
     RETURNING id, phone_e164, status`,
    [req.params.id, req.user.tenantId, req.user.role === 'super_admin']
  );
  if (!contact) throw new AppError('Contact not found.', 404, 'ERR_VDAJ_CONT_001');
  return sendSuccess(res, contact, 'Contact opted out.');
}));

module.exports = router;
