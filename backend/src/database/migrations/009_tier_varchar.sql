-- ============================================================
-- Migration 009: Support exact Meta Messaging Limit Tiers in tenants table
-- ============================================================
ALTER TABLE tenants ALTER COLUMN messaging_tier TYPE VARCHAR(32) USING messaging_tier::varchar;

