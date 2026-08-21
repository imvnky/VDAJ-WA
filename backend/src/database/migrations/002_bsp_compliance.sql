-- ============================================================
-- VDAJ SERVICES — Migration 002: Meta BSP Compliance Foundation
-- Run: psql $DATABASE_URL -f backend/src/database/migrations/002_bsp_compliance.sql
-- Idempotent: all statements use IF NOT EXISTS / IF EXISTS guards.
-- ============================================================

-- ============================================================
-- 1. CONTACTS — Opt-In Consent Columns
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS opted_in_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_in_source VARCHAR(50),
  -- Values: 'import' | 'inbound_message' | 'api' | 'manual' | 'web_form'
  ADD COLUMN IF NOT EXISTS opt_in_proof  TEXT;

-- Partial index: quickly find contacts that still have no opt-in recorded
CREATE INDEX IF NOT EXISTS idx_contacts_no_opt_in
  ON contacts(tenant_id)
  WHERE opted_in_at IS NULL AND status = 'active';

-- ============================================================
-- 2. OPT_IN_EVENTS — New Audit Log Table
-- ============================================================

CREATE TABLE IF NOT EXISTS opt_in_events (
  id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  contact_id  UUID                 REFERENCES contacts(id)  ON DELETE SET NULL,
  phone_e164  VARCHAR(20) NOT NULL,
  source      VARCHAR(50) NOT NULL,          -- mirrors opt_in_source
  proof       TEXT,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_opt_in_events PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_opt_in_events_tenant
  ON opt_in_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_opt_in_events_phone
  ON opt_in_events(phone_e164);

CREATE INDEX IF NOT EXISTS idx_opt_in_events_contact
  ON opt_in_events(contact_id)
  WHERE contact_id IS NOT NULL;

-- ============================================================
-- 3. TENANTS — WABA Health Columns
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS quality_rating        VARCHAR(10)  NOT NULL DEFAULT 'GREEN',
  -- Possible values from Meta: 'GREEN' | 'YELLOW' | 'RED'

  ADD COLUMN IF NOT EXISTS messaging_tier        SMALLINT     NOT NULL DEFAULT 1,
  -- 1 = 1,000/day | 2 = 10,000/day | 3 = 100,000/day | 4 = unlimited

  ADD COLUMN IF NOT EXISTS msgs_sent_today       INTEGER      NOT NULL DEFAULT 0,
  -- Incremented by messageWorker on each successful send; reset daily

  ADD COLUMN IF NOT EXISTS msgs_sent_today_date  DATE,
  -- The UTC date msgs_sent_today corresponds to (used for daily reset)

  ADD COLUMN IF NOT EXISTS waba_health_synced_at TIMESTAMPTZ,
  -- Timestamp of last successful Meta WABA health API call

  ADD COLUMN IF NOT EXISTS display_phone_number  VARCHAR(30),
  -- Human-readable phone number from Meta (e.g. "+91 98765 43210")

  ADD COLUMN IF NOT EXISTS verified_name         VARCHAR(255);
  -- Display name approved by Meta for the WABA

-- ============================================================
-- 4. OPT_OUT_EVENTS — Add wa_message_id Column
-- ============================================================

ALTER TABLE opt_out_events
  ADD COLUMN IF NOT EXISTS wa_message_id VARCHAR(255);

-- ============================================================
-- 5. INBOX_CONVERSATIONS — Add last_inbound_at Column
-- ============================================================

ALTER TABLE inbox_conversations
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

-- Backfill: set last_inbound_at = last_message_at for any existing
-- inbound conversations where the last message was from the customer.
-- This is best-effort; it will be overwritten on the next real inbound event.
UPDATE inbox_conversations
SET last_inbound_at = last_message_at
WHERE last_inbound_at IS NULL
  AND last_message_at IS NOT NULL;

-- Index for fast 24-hour window checks in inboxRoutes
CREATE INDEX IF NOT EXISTS idx_inbox_conv_last_inbound
  ON inbox_conversations(last_inbound_at)
  WHERE last_inbound_at IS NOT NULL;

-- ============================================================
-- Done
-- ============================================================
-- To verify: run the following SELECT to check new columns exist:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('contacts','tenants','opt_out_events','inbox_conversations')
--     AND column_name IN (
--       'opted_in_at','opt_in_source','opt_in_proof',
--       'quality_rating','messaging_tier','msgs_sent_today','msgs_sent_today_date',
--       'waba_health_synced_at','display_phone_number','verified_name',
--       'wa_message_id','last_inbound_at'
--     )
--   ORDER BY table_name, column_name;
