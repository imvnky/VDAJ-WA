-- ============================================================
-- Migration 006: Advanced Audiences & Multi-Group Broadcasts
-- ============================================================

-- 1. Support multi-list, workspace-wide, and adhoc Excel campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_type VARCHAR(50) DEFAULT 'list';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_config JSONB DEFAULT '{}';

-- 2. Ensure inbox_messages has updated_at column
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Index for querying audience_type
CREATE INDEX IF NOT EXISTS idx_campaigns_audience_type ON campaigns(audience_type);
