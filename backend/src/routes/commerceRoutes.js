/**
 * VDAJ Services — Commerce Routes
 * Manages Meta Commerce Catalog connections and product listings.
 *
 * GET  /commerce/catalogs             — List tenant's linked catalogs
 * POST /commerce/catalogs             — Link a new Meta Catalog ID
 * GET  /commerce/catalogs/:id/products — List products in a catalog
 * POST /commerce/catalogs/:id/products — Manually add/sync a product
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { sendSuccess, sendCreated, catchAsync } = require('../middleware/responseHandler');
const { authenticate } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const AppError = require('../utils/AppError');

router.use(authenticate, requireTenant);

// ── GET /commerce/catalogs ─────────────────────────────────────
// Returns all Meta catalogs linked by this tenant, ordered by newest first.
router.get('/catalogs', catchAsync(async (req, res) => {
  let rows = [];
  try {
    const result = await query(
      `SELECT
         id, meta_catalog_id, name,
         is_verified, product_count,
         created_at, updated_at
       FROM commerce_catalogs
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [req.user.tenantId]
    );
    rows = result.rows;
  } catch (err) {
    if (err.code !== '42P01') throw err; // Only swallow "table does not exist"
  }
  return sendSuccess(res, rows, 'Catalogs fetched.');
}));

// ── POST /commerce/catalogs ────────────────────────────────────
// Links a Meta Catalog to this tenant account.
// Body: { metaCatalogId: string, name: string }
router.post('/catalogs', catchAsync(async (req, res) => {
  const { metaCatalogId, name } = req.body;

  if (!metaCatalogId?.trim()) {
    throw new AppError('metaCatalogId is required.', 400, 'ERR_VDAJ_COM_001');
  }
  if (!name?.trim()) {
    throw new AppError('Catalog name is required.', 400, 'ERR_VDAJ_COM_002');
  }

  const { rows: [catalog] } = await query(
    `INSERT INTO commerce_catalogs (tenant_id, meta_catalog_id, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, meta_catalog_id) DO UPDATE
       SET name       = EXCLUDED.name,
           updated_at = NOW()
     RETURNING *`,
    [req.user.tenantId, metaCatalogId.trim(), name.trim()]
  );

  return sendCreated(res, catalog, 'Catalog linked successfully.');
}));

// ── GET /commerce/catalogs/:id/products ───────────────────────
// Returns paginated product list for a specific catalog.
router.get('/catalogs/:id/products', catchAsync(async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  // Verify catalog belongs to tenant
  const { rows: catalogRows } = await query(
    `SELECT id FROM commerce_catalogs WHERE id = $1 AND tenant_id = $2`,
    [req.params.id, req.user.tenantId]
  );
  if (!catalogRows.length) {
    throw new AppError('Catalog not found.', 404, 'ERR_VDAJ_COM_003');
  }

  let where = 'WHERE p.catalog_id = $1 AND p.is_active = TRUE';
  const params = [req.params.id];
  let idx = 2;

  if (search?.trim()) {
    where += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx})`;
    params.push(`%${search.trim()}%`);
    idx++;
  }

  const { rows: products } = await query(
    `SELECT
       p.id, p.meta_product_id, p.name, p.description,
       p.price, p.currency, p.image_url, p.is_active,
       p.created_at,
       COUNT(*) OVER() AS total_count
     FROM commerce_products p
     ${where}
     ORDER BY p.name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, Number(limit), offset]
  );

  const total = parseInt(products[0]?.total_count || 0, 10);

  return sendSuccess(res, products, 'Products fetched.', 200, {
    page: Number(page),
    limit: Number(limit),
    total,
  });
}));

// ── POST /commerce/catalogs/:id/products ──────────────────────
// Manually adds or upserts a product into a catalog.
// Body: { metaProductId, name, description?, price?, currency?, imageUrl? }
router.post('/catalogs/:id/products', catchAsync(async (req, res) => {
  const { metaProductId, name, description, price, currency, imageUrl } = req.body;

  // Verify catalog ownership
  const { rows: catalogRows } = await query(
    `SELECT id FROM commerce_catalogs WHERE id = $1 AND tenant_id = $2`,
    [req.params.id, req.user.tenantId]
  );
  if (!catalogRows.length) {
    throw new AppError('Catalog not found.', 404, 'ERR_VDAJ_COM_003');
  }

  if (!metaProductId?.trim() || !name?.trim()) {
    throw new AppError('metaProductId and name are required.', 400, 'ERR_VDAJ_COM_004');
  }

  // No UNIQUE constraint on meta_product_id in current schema —
  // use explicit SELECT → UPDATE or INSERT pattern.
  const { rows: [existing] } = await query(
    `SELECT id FROM commerce_products
     WHERE catalog_id = $1 AND meta_product_id = $2`,
    [req.params.id, metaProductId.trim()]
  );

  let product;
  if (existing) {
    const { rows: [updated] } = await query(
      `UPDATE commerce_products
       SET name        = $1,
           description = COALESCE($2, description),
           price       = COALESCE($3, price),
           currency    = COALESCE($4, currency),
           image_url   = COALESCE($5, image_url),
           is_active   = TRUE
       WHERE id = $6
       RETURNING *`,
      [name.trim(), description || null, price ? parseFloat(price) : null,
       currency || null, imageUrl || null, existing.id]
    );
    product = updated;
  } else {
    const { rows: [inserted] } = await query(
      `INSERT INTO commerce_products
         (catalog_id, tenant_id, meta_product_id, name, description, price, currency, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.params.id, req.user.tenantId, metaProductId.trim(), name.trim(),
       description || null, price ? parseFloat(price) : null, currency || 'INR', imageUrl || null]
    );
    product = inserted;
  }

  // Keep product_count in sync on the catalog row
  await query(
    `UPDATE commerce_catalogs
     SET product_count = (
           SELECT COUNT(*) FROM commerce_products
           WHERE catalog_id = $1 AND is_active = TRUE
         ),
         updated_at = NOW()
     WHERE id = $1`,
    [req.params.id]
  );

  return sendCreated(res, product, 'Product saved.');
}));

module.exports = router;
