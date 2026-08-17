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

router.use(authenticate);

// ── GET /contacts ─────────────────────────────────────────────
router.get('/', catchAsync(async (req, res) => {
  const { page = 1, limit = 50, search, status } = req.query;
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
// Body: { contacts: [{phoneE164, firstName, lastName, email, customVars}], listId? }
//
// Strategy:
//  - Validate minimum required fields (phoneE164 E.164 format) server-side.
//  - Upsert in a single transaction using UNNEST for performance.
//  - ON CONFLICT updates firstName/lastName/email if they are provided.
//  - Optionally adds all contacts to a contact list.
//  - Returns counts: inserted, updated, invalid.
router.post('/bulk', catchAsync(async (req, res) => {
  const { contacts: rawContacts, listId } = req.body;

  if (!Array.isArray(rawContacts) || rawContacts.length === 0) {
    throw new AppError('contacts array is required and must not be empty.', 400, 'ERR_VDAJ_VAL_001');
  }

  const MAX_BULK = 5000;
  if (rawContacts.length > MAX_BULK) {
    throw new AppError(
      `Bulk import is limited to ${MAX_BULK} contacts per request. Split your CSV into smaller chunks.`,
      400,
      'ERR_VDAJ_CONT_004'
    );
  }

  // ── Server-side E.164 validation + sanitization ───────────
  const E164_REGEX = /^\+[1-9]\d{7,14}$/;
  const valid   = [];
  const invalid = [];

  for (const raw of rawContacts) {
    let phone = String(raw.phoneE164 || '').trim().replace(/[\s\-().]/g, '');
    if (!phone.startsWith('+')) phone = '+' + phone;

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

    // ── Validate listId belongs to this tenant (if provided) ──
    if (listId) {
      const { rows: listRows } = await client.query(
        `SELECT id FROM contact_lists WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [listId, req.user.tenantId]
      );
      if (!listRows.length) {
        throw new AppError('Contact list not found.', 404, 'ERR_VDAJ_CONT_002');
      }
    }

    // ── Bulk upsert using UNNEST (single round-trip to DB) ────
    // xmax = 0 means the row was inserted (not updated via UPDATE path of ON CONFLICT)
    const { rows: upserted } = await client.query(
      `INSERT INTO contacts
         (tenant_id, phone_e164, first_name, last_name, email, custom_vars)
       SELECT
         $1,
         phone, first_name, last_name, email,
         custom_vars::jsonb
       FROM UNNEST(
         $2::text[], $3::text[], $4::text[], $5::text[], $6::text[]
       ) AS t(phone, first_name, last_name, email, custom_vars)
       ON CONFLICT (tenant_id, phone_e164) DO UPDATE
         SET
           first_name  = COALESCE(EXCLUDED.first_name,  contacts.first_name),
           last_name   = COALESCE(EXCLUDED.last_name,   contacts.last_name),
           email       = COALESCE(EXCLUDED.email,       contacts.email),
           custom_vars = contacts.custom_vars || EXCLUDED.custom_vars,
           updated_at  = NOW()
       RETURNING id, (xmax = 0) AS is_new`,
      [
        req.user.tenantId,
        phones,
        firstNames,
        lastNames,
        emails,
        customVarsArr,
      ]
    );

    inserted       = upserted.filter((r) => r.is_new).length;
    updated        = upserted.filter((r) => !r.is_new).length;
    newContactIds  = upserted.map((r) => r.id);

    // ── Add all contacts to the specified list ─────────────────
    if (listId && newContactIds.length > 0) {
      await client.query(
        `INSERT INTO contact_list_members (contact_list_id, contact_id)
         SELECT $1, UNNEST($2::uuid[])
         ON CONFLICT DO NOTHING`,
        [listId, newContactIds]
      );
    }
  });

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

// ── PATCH /contacts/:id/opt-out ────────────────────────────────
router.patch('/:id/opt-out', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const { rows: [contact] } = await query(
    `UPDATE contacts
     SET status = 'opted_out', opted_out_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING id, phone_e164, status`,
    [req.params.id, req.user.tenantId]
  );
  if (!contact) throw new AppError('Contact not found.', 404, 'ERR_VDAJ_CONT_001');
  return sendSuccess(res, contact, 'Contact opted out.');
}));

module.exports = router;
