-- ================================================================
-- VDAJ Services — Migration 004: Chat Assignment & Pending Status
-- ================================================================
-- The inbox_conversations table already has `assigned_to` and
-- `status` from schema_v2.sql. This migration:
-- 1. Adds 'pending' to the status allowed values (was only open|resolved|snoozed)
-- 2. Adds missing indexes for performance
-- 3. Adds last_inbound_at column to track the 24-hr service window
--    (previously this was computed on the fly, now it's stored)
-- ================================================================

BEGIN;

-- ── 1. Add missing status value & ensure column exists ──────────
-- The column already exists in schema_v2. Just ensure the value
-- range is expanded. Because status is VARCHAR, no ALTER TYPE needed.
-- We just document the new valid values here: open | pending | resolved.

-- ── 2. Add last_inbound_at if not already present ───────────────
ALTER TABLE inbox_conversations
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

-- ── 3. Add soft-delete support (future-proofing) ─────────────────
ALTER TABLE inbox_conversations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── 4. Robust indexes for assignment and status queries ─────────
CREATE INDEX IF NOT EXISTS idx_inbox_assigned
  ON inbox_conversations(assigned_to);

CREATE INDEX IF NOT EXISTS idx_inbox_status_tenant
  ON inbox_conversations(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_inbox_assigned_tenant
  ON inbox_conversations(tenant_id, assigned_to);

-- ── 5. Back-fill last_inbound_at from existing inbox_messages ───
-- Find the most recent inbound message per conversation
UPDATE inbox_conversations c
SET last_inbound_at = (
  SELECT MAX(m.created_at)
  FROM inbox_messages m
  WHERE m.conversation_id = c.id
    AND m.direction = 'inbound'
)
WHERE c.last_inbound_at IS NULL;

COMMIT;
