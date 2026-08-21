-- ================================================================
-- VDAJ Services — Migration 003: Multi-Tenancy RBAC & Feature Flags
-- ================================================================
-- Adds: tenants.status, tenants.enabled_features
-- NOTE: Extending the user_role ENUM (adding 'manager', 'agent')
--       requires the DB superuser role and must be done by the DBA
--       out-of-band. This migration only adds safe, non-superuser changes.

BEGIN;

-- ── 1. tenants: add status column ───────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Add CHECK constraint only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'tenants_status_check'
      AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_status_check
      CHECK (status IN ('active', 'suspended', 'trial', 'churned'));
  END IF;
END $$;

-- ── 2. tenants: add enabled_features column ──────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS enabled_features JSONB NOT NULL DEFAULT
    '["inbox","campaigns","contacts","templates","analytics","automation","commerce","logs"]';

-- ── 3. Back-fill status from is_active for existing rows ─────────
UPDATE tenants
  SET status = CASE WHEN is_active THEN 'active' ELSE 'suspended' END
  WHERE TRUE;

-- ── 4. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_status   ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_features ON tenants USING GIN(enabled_features);

-- ── 5. Super Admin bootstrap ─────────────────────────────────────
-- Ensures the root super_admin always exists with the correct role.
-- Password hash is bcrypt of 'VDAJAdmin@2025!' (cost 10).
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_verified)
VALUES (
  'admin@vdajservices.com',
  '$2a$10$YKvHKkHoqN.3rM8XQiQjd.XNu.pQs8f7Qa3qAtZuJ0VNGBWm4rNJi',
  'Venkatesh',
  'Joshi',
  'super_admin',
  TRUE,
  TRUE
) ON CONFLICT (email) DO UPDATE
  SET role       = 'super_admin',
      is_active  = TRUE,
      updated_at = NOW();

COMMIT;
