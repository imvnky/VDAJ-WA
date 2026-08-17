/**
 * VDAJ Services — Tenant Middleware
 * Ensures authenticated user belongs to an active tenant.
 * SuperAdmins bypass tenant requirement.
 */

const AppError = require('../utils/AppError');
const { query } = require('../config/database');

/**
 * requireTenant middleware
 * Attaches req.tenant from DB. Throws if user has no tenantId and is not super_admin.
 */
const requireTenant = async (req, res, next) => {
  try {
    // Super admins can operate without a tenant context
    if (req.user?.role === 'super_admin') {
      // Try to load tenant if tenantId exists
      if (req.user.tenantId) {
        const { rows } = await query('SELECT * FROM tenants WHERE id = $1 AND deleted_at IS NULL', [req.user.tenantId]);
        req.tenant = rows[0] || null;
      }
      return next();
    }

    if (!req.user?.tenantId) {
      throw new AppError('No tenant associated with this account.', 403, 'ERR_VDAJ_AUTH_003');
    }

    const { rows } = await query(
      'SELECT * FROM tenants WHERE id = $1 AND deleted_at IS NULL',
      [req.user.tenantId]
    );

    if (!rows.length) {
      throw new AppError('Tenant not found or inactive.', 403, 'ERR_VDAJ_AUTH_004');
    }

    req.tenant = rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireTenant };
