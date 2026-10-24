-- ============================================================
-- Migration 007: Rich Template Components in Inbox Messages
-- Adds JSONB metadata column to inbox_messages for storing
-- buttons (Quick Replies, CTAs), footers, and header media
-- ============================================================

ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_inbox_messages_metadata ON inbox_messages USING gin(metadata);
