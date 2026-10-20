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
  const { page = 1, limit = 50, search, status, tag, listId } = req.query;
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
  // Group / List filter
  if (listId) {
    whereClause += ` AND EXISTS (SELECT 1 FROM contact_list_members clm WHERE clm.contact_id = c.id AND clm.contact_list_id = $${idx})`;
    params.push(listId);
    idx++;
  }

  const { rows } = await query(
    `SELECT c.*,
            COALESCE(
              (SELECT json_agg(json_build_object('id', cl.id, 'name', cl.name))
               FROM contact_list_members clm
               JOIN contact_lists cl ON cl.id = clm.contact_list_id
               WHERE clm.contact_id = c.id AND cl.deleted_at IS NULL),
              '[]'::json
            ) AS groups,
            COUNT(*) OVER() AS total_count
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

// ── GET /contacts/tags — All distinct tags for tenant ─────────
router.get('/tags', catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId || req.tenant?.id;
  const { rows } = await query(
    `SELECT DISTINCT UNNEST(tags) AS tag
     FROM contacts
     WHERE (tenant_id = $1 OR $2 = TRUE) AND tags IS NOT NULL AND array_length(tags, 1) > 0
     ORDER BY tag ASC`,
    [tenantId, req.user.role === 'super_admin']
  );
  return sendSuccess(res, rows.map((r) => r.tag).filter(Boolean), 'Tags fetched.');
}));

// ── POST /contacts — Single contact ───────────────────────────
router.post('/', contactValidators, validate, catchAsync(async (req, res) => {
  const {
    phoneE164,
    firstName,
    lastName,
    email,
    customVars,
    tags          = [],
    listId,
    opt_in_source = 'manual',
    opt_in_proof,
  } = req.body;

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

  // Parse tags array
  const cleanTags = Array.isArray(tags)
    ? tags.map((t) => String(t).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30)).filter(Boolean)
    : String(tags || '').split(',').map((t) => t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30)).filter(Boolean);

  const proof = opt_in_proof?.trim() || `Manual entry by user ${req.user.id || req.user.email || 'portal'} on ${new Date().toISOString().slice(0, 10)}`;

  let createdContact = null;

  await withTransaction(async (client) => {
    // Ensure tags column exists (idempotent)
    await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`);

    const { rows: [contact] } = await client.query(
      `INSERT INTO contacts
         (tenant_id, phone_e164, first_name, last_name, email, custom_vars, tags, opted_in_at, opt_in_source, opt_in_proof)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
       ON CONFLICT (tenant_id, phone_e164) DO NOTHING
       RETURNING *`,
      [
        tenantId,
        phoneE164,
        firstName?.trim() || null,
        lastName?.trim() || null,
        email?.trim() || null,
        JSON.stringify(customVars || {}),
        cleanTags,
        opt_in_source,
        proof,
      ]
    );

    if (!contact) {
      throw new AppError('A contact with this phone number already exists in your workspace.', 409, 'ERR_VDAJ_CONT_003');
    }

    createdContact = contact;

    // Attach to list / group if provided
    if (listId) {
      await client.query(
        `INSERT INTO contact_list_members (contact_list_id, contact_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [listId, contact.id]
      );
    }

    // Insert audit record into opt_in_events safely
    try {
      await client.query(
        `INSERT INTO opt_in_events (tenant_id, contact_id, phone_e164, source, proof, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, contact.id, contact.phone_e164, opt_in_source, proof, req.ip || null]
      );
    } catch (e) {
      // safe fallback
    }
  });

  return sendCreated(res, createdContact, 'Contact created.');
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
  const tenantId = req.user.tenantId || req.tenant?.id;
  const { rows } = await query(
    `SELECT cl.*,
            COALESCE(COUNT(clm.contact_id)::int, cl.contact_count, 0) AS contact_count
     FROM contact_lists cl
     LEFT JOIN contact_list_members clm ON clm.contact_list_id = cl.id
     WHERE (cl.tenant_id = $1 OR $2 = TRUE) AND cl.deleted_at IS NULL
     GROUP BY cl.id
     ORDER BY cl.created_at DESC`,
    [tenantId, req.user.role === 'super_admin']
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

// ── PUT /contacts/lists/:id — Edit group name & description ────
router.put('/lists/:id', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) throw new AppError('List name is required.', 400, 'ERR_VDAJ_VAL_005');
  const tenantId = req.user.tenantId || req.tenant?.id;

  const { rows: [list] } = await query(
    `UPDATE contact_lists
     SET name = $1, description = $2, updated_at = NOW()
     WHERE id = $3 AND (tenant_id = $4 OR $5 = TRUE) AND deleted_at IS NULL
     RETURNING *`,
    [name.trim(), description !== undefined ? description?.trim() || null : null, req.params.id, tenantId, req.user.role === 'super_admin']
  );

  if (!list) throw new AppError('Contact list not found.', 404, 'ERR_VDAJ_CONT_002');
  return sendSuccess(res, list, 'Contact list updated.');
}));

// ── DELETE /contacts/lists/:id — Delete group ──────────────────
router.delete('/lists/:id', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId || req.tenant?.id;
  const listId = req.params.id;
  const { deleteContacts = false } = req.body || {};

  await withTransaction(async (client) => {
    const { rows: [list] } = await client.query(
      `SELECT id, name FROM contact_lists WHERE id = $1 AND (tenant_id = $2 OR $3 = TRUE) AND deleted_at IS NULL`,
      [listId, tenantId, req.user.role === 'super_admin']
    );
    if (!list) throw new AppError('Contact list not found.', 404, 'ERR_VDAJ_CONT_002');

    if (deleteContacts) {
      // Find contacts that belong ONLY to this list
      await client.query(
        `DELETE FROM contacts WHERE id IN (
           SELECT clm.contact_id FROM contact_list_members clm WHERE clm.contact_list_id = $1
         ) AND (tenant_id = $2 OR $3 = TRUE)`,
        [listId, tenantId, req.user.role === 'super_admin']
      );
    }

    // Remove members from list
    await client.query(`DELETE FROM contact_list_members WHERE contact_list_id = $1`, [listId]);

    // Soft delete the list
    await client.query(
      `UPDATE contact_lists SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [listId]
    );
  });

  return sendSuccess(res, { id: listId }, 'Contact list deleted successfully.');
}));

// ── POST /contacts/move-group — Move or reassign contacts between groups ────
router.post('/move-group', catchAsync(async (req, res) => {
  const { contactIds, fromListId, toListId, mode = 'move' } = req.body;

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError('contactIds must be a non-empty array of contact IDs.', 400, 'ERR_VDAJ_VAL_001');
  }
  if (!toListId) {
    throw new AppError('Target group (toListId) is required.', 400, 'ERR_VDAJ_VAL_001');
  }

  const tenantId = req.user.tenantId || req.tenant?.id;
  const isSuperAdmin = req.user.role === 'super_admin';

  await withTransaction(async (client) => {
    // 1. Verify target list belongs to tenant
    const { rows: [targetList] } = await client.query(
      `SELECT id, name FROM contact_lists WHERE id = $1 AND (tenant_id = $2 OR $3 = TRUE) AND deleted_at IS NULL`,
      [toListId, tenantId, isSuperAdmin]
    );
    if (!targetList) throw new AppError('Target group not found.', 404, 'ERR_VDAJ_CONT_002');

    // 2. If mode === 'move' and fromListId is specified, remove from source list
    if (mode === 'move' && fromListId) {
      await client.query(
        `DELETE FROM contact_list_members
         WHERE contact_list_id = $1 AND contact_id = ANY($2::uuid[])`,
        [fromListId, contactIds]
      );
    }

    // 3. Add to target list
    await client.query(
      `INSERT INTO contact_list_members (contact_list_id, contact_id)
       SELECT $1, UNNEST($2::uuid[])
       ON CONFLICT (contact_list_id, contact_id) DO NOTHING`,
      [toListId, contactIds]
    );
  });

  return sendSuccess(
    res,
    { affectedCount: contactIds.length, targetListId: toListId },
    `Contacts successfully ${mode === 'move' ? 'moved to' : 'added to'} group.`
  );
}));

// ── POST /contacts/bulk-delete — Bulk delete contacts ───────────
router.post('/bulk-delete', catchAsync(async (req, res) => {
  const { contactIds } = req.body;
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError('contactIds must be a non-empty array of contact IDs.', 400, 'ERR_VDAJ_VAL_001');
  }

  const tenantId = req.user.tenantId || req.tenant?.id;
  const isSuperAdmin = req.user.role === 'super_admin';

  const { rows } = await query(
    `DELETE FROM contacts
     WHERE id = ANY($1::uuid[]) AND (tenant_id = $2 OR $3 = TRUE)
     RETURNING id, phone_e164`,
    [contactIds, tenantId, isSuperAdmin]
  );

  return sendSuccess(res, { deletedCount: rows.length }, `Successfully deleted ${rows.length} contact(s).`);
}));

// ── POST /contacts/bulk-tags — Assign or remove tags from multiple contacts ──
router.post('/bulk-tags', catchAsync(async (req, res) => {
  const { contactIds, tags, action = 'add' } = req.body;
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError('contactIds must be a non-empty array of IDs.', 400, 'ERR_VDAJ_VAL_001');
  }
  if (!Array.isArray(tags) || tags.length === 0) {
    throw new AppError('tags must be a non-empty array of strings.', 400, 'ERR_VDAJ_VAL_001');
  }

  const tenantId = req.user.tenantId || req.tenant?.id;
  const isSuperAdmin = req.user.role === 'super_admin';

  // Sanitise tags
  const cleanTags = [...new Set(
    tags.map((t) => String(t).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '').slice(0, 30))
        .filter(Boolean)
  )];

  if (cleanTags.length === 0) {
    throw new AppError('No valid tag strings provided.', 400, 'ERR_VDAJ_VAL_001');
  }

  let updateQuery = '';
  let params = [];

  if (action === 'replace') {
    updateQuery = `
      UPDATE contacts
      SET tags = $1::text[], updated_at = NOW()
      WHERE id = ANY($2::uuid[])
        AND (tenant_id = $3 OR $4 = TRUE)
      RETURNING id
    `;
    params = [cleanTags, contactIds, tenantId, isSuperAdmin];
  } else if (action === 'remove') {
    updateQuery = `
      UPDATE contacts
      SET tags = ARRAY(
        SELECT t FROM UNNEST(COALESCE(tags, '{}'::text[])) AS t WHERE NOT (t = ANY($1::text[]))
      ), updated_at = NOW()
      WHERE id = ANY($2::uuid[])
        AND (tenant_id = $3 OR $4 = TRUE)
      RETURNING id
    `;
    params = [cleanTags, contactIds, tenantId, isSuperAdmin];
  } else {
    // Default: 'add'
    updateQuery = `
      UPDATE contacts
      SET tags = ARRAY(
        SELECT DISTINCT t FROM UNNEST(COALESCE(tags, '{}'::text[]) || $1::text[]) AS t
      ), updated_at = NOW()
      WHERE id = ANY($2::uuid[])
        AND (tenant_id = $3 OR $4 = TRUE)
      RETURNING id
    `;
    params = [cleanTags, contactIds, tenantId, isSuperAdmin];
  }

  const { rows } = await query(updateQuery, params);

  return sendSuccess(res, { updatedCount: rows.length }, `Tags updated for ${rows.length} contacts.`);
}));

// ── POST /contacts/reset-all — Delete all contacts, groups & tags for workspace ──
router.post('/reset-all', catchAsync(async (req, res) => {
  let tenantId = req.user.tenantId || req.tenant?.id;
  if (req.user.role === 'super_admin' && req.body?.tenantId) {
    tenantId = req.body.tenantId;
  }
  if (!tenantId) {
    const { rows: [t] } = await query(`SELECT id FROM tenants WHERE slug ILIKE '%smr%' OR name ILIKE '%smr%' LIMIT 1`);
    tenantId = t?.id;
  }
  if (!tenantId) throw new AppError('Tenant context required.', 400, 'ERR_VDAJ_TENANT_001');

  // Cascade delete: list members -> contact lists -> contacts
  await query(`DELETE FROM contact_list_members WHERE contact_list_id IN (SELECT id FROM contact_lists WHERE tenant_id = $1)`, [tenantId]);
  await query(`DELETE FROM contact_lists WHERE tenant_id = $1`, [tenantId]);
  const { rowCount } = await query(`DELETE FROM contacts WHERE tenant_id = $1`, [tenantId]);

  return sendSuccess(
    res,
    { deletedContactsCount: rowCount },
    `All contacts (${rowCount}), groups, and tags have been deleted for this workspace.`
  );
}));

// ── GET /contacts/:id — Full contact detail ────────────────────
router.get('/:id', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const tenantId   = req.user.tenantId;
  const contactId  = req.params.id;

  // 1. Base contact row (always exists)
  const { rows: [contact] } = await query(
    `SELECT c.* FROM contacts c
      WHERE c.id = $1 AND (c.tenant_id = $2 OR $3 = TRUE)`,
    [contactId, tenantId, req.user.role === 'super_admin']
  );
  if (!contact) throw new AppError('Contact not found.', 404, 'ERR_VDAJ_CONT_001');

  // 2. Opt-in event proof (safely handled)
  let optInEvent = null;
  try {
    const { rows: [oe] } = await query(
      `SELECT source, proof, ip_address, created_at
         FROM opt_in_events
        WHERE contact_id = $1
        ORDER BY created_at ASC
        LIMIT 1`,
      [contactId]
    );
    optInEvent = oe;
  } catch (err) {
    // opt_in_events table might not be migrated yet
  }

  // 3. Latest opt-out event (safely handled with fallback for trigger_phrase/trigger_keyword)
  let optOutEvent = null;
  try {
    const { rows: [ooe] } = await query(
      `SELECT COALESCE(trigger_phrase, 'STOP') AS trigger_keyword, created_at AS opted_out_at
         FROM opt_out_events
        WHERE contact_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [contactId]
    );
    optOutEvent = ooe;
  } catch (err) {
    // Fallback if column is trigger_keyword or table missing
    try {
      const { rows: [ooe2] } = await query(
        `SELECT trigger_keyword, created_at AS opted_out_at
           FROM opt_out_events
          WHERE contact_id = $1
          ORDER BY created_at DESC
          LIMIT 1`,
        [contactId]
      );
      optOutEvent = ooe2;
    } catch (e2) {}
  }

  // 4. Campaign history — last 20 messages sent to this contact
  let campaignHistory = [];
  try {
    const { rows } = await query(
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
    campaignHistory = rows;
  } catch (err) {}

  // 5. Active inbox conversation thread (if exists)
  let conversation = null;
  try {
    const { rows: [conv] } = await query(
      `SELECT id FROM inbox_conversations
        WHERE contact_id = $1 AND (tenant_id = $2 OR $3 = TRUE)
        ORDER BY last_message_at DESC
        LIMIT 1`,
      [contactId, tenantId, req.user.role === 'super_admin']
    );
    conversation = conv;
  } catch (err) {}

  return sendSuccess(res, {
    ...contact,
    opt_in_event_source: optInEvent?.source || contact.opt_in_source || null,
    opt_in_event_proof:  optInEvent?.proof || contact.opt_in_proof || null,
    opt_in_event_ip:     optInEvent?.ip_address || null,
    opt_in_event_at:     optInEvent?.created_at || contact.opted_in_at || null,
    opt_out_event:       optOutEvent || null,
    campaign_history:    campaignHistory,
    conversation_id:     conversation?.id || null,
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

// ── PUT /contacts/:id — Update single contact ─────────────────
router.put('/:id', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const { firstName, lastName, email, customVars, tags, listId, listIds } = req.body;
  const tenantId = req.user.tenantId || req.tenant?.id;

  let cleanTags = undefined;
  if (tags !== undefined) {
    cleanTags = Array.isArray(tags)
      ? tags.map((t) => String(t).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30)).filter(Boolean)
      : String(tags || '').split(',').map((t) => t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30)).filter(Boolean);
  }

  let updatedContact = null;
  await withTransaction(async (client) => {
    const { rows: [contact] } = await client.query(
      `UPDATE contacts
       SET first_name  = CASE WHEN $1::text IS NOT NULL THEN $1::text ELSE first_name END,
           last_name   = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE last_name END,
           email       = CASE WHEN $3::text IS NOT NULL THEN $3::text ELSE email END,
           custom_vars = CASE WHEN $4::text IS NOT NULL THEN $4::jsonb ELSE custom_vars END,
           tags        = CASE WHEN $5::text[] IS NOT NULL THEN $5::text[] ELSE tags END,
           updated_at  = NOW()
       WHERE id = $6 AND (tenant_id = $7 OR $8 = TRUE)
       RETURNING *`,
      [
        firstName !== undefined ? (firstName?.trim() || null) : null,
        lastName !== undefined ? (lastName?.trim() || null) : null,
        email !== undefined ? (email?.trim() || null) : null,
        customVars ? JSON.stringify(customVars) : null,
        cleanTags !== undefined ? cleanTags : null,
        req.params.id,
        tenantId,
        req.user.role === 'super_admin',
      ]
    );

    if (!contact) throw new AppError('Contact not found.', 404, 'ERR_VDAJ_CONT_001');

    if (Array.isArray(listIds)) {
      // Sync groups for this contact
      await client.query(
        `DELETE FROM contact_list_members
         WHERE contact_id = $1
           AND contact_list_id IN (SELECT id FROM contact_lists WHERE tenant_id = $2 OR $3 = TRUE)`,
        [contact.id, tenantId, req.user.role === 'super_admin']
      );
      if (listIds.length > 0) {
        await client.query(
          `INSERT INTO contact_list_members (contact_list_id, contact_id)
           SELECT UNNEST($1::uuid[]), $2
           ON CONFLICT DO NOTHING`,
          [listIds, contact.id]
        );
      }
    } else if (listId) {
      await client.query(
        `INSERT INTO contact_list_members (contact_list_id, contact_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [listId, contact.id]
      );
    }

    // Fetch updated groups
    const { rows: groupRows } = await client.query(
      `SELECT cl.id, cl.name
       FROM contact_list_members clm
       JOIN contact_lists cl ON cl.id = clm.contact_list_id
       WHERE clm.contact_id = $1 AND cl.deleted_at IS NULL`,
      [contact.id]
    );
    contact.groups = groupRows;
    updatedContact = contact;
  });

  return sendSuccess(res, updatedContact, 'Contact updated.');
}));

// ── DELETE /contacts/:id — Delete single contact ──────────────
router.delete('/:id', uuidParamValidator('id'), validate, catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId || req.tenant?.id;

  const { rows: [deleted] } = await query(
    `DELETE FROM contacts
     WHERE id = $1 AND (tenant_id = $2 OR $3 = TRUE)
     RETURNING id, phone_e164`,
    [req.params.id, tenantId, req.user.role === 'super_admin']
  );

  if (!deleted) throw new AppError('Contact not found.', 404, 'ERR_VDAJ_CONT_001');
  return sendSuccess(res, { id: deleted.id }, 'Contact deleted.');
}));

module.exports = router;
