-- Migration: 005_media_templates.sql
-- Add support for media headers (IMAGE, VIDEO, DOCUMENT) in WhatsApp message templates and campaigns

ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS header_type VARCHAR(50) DEFAULT 'NONE';

ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS header_sample_url TEXT;

CREATE INDEX IF NOT EXISTS idx_templates_header_type ON message_templates(header_type);

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS template_vars JSONB DEFAULT '{}';

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS header_url TEXT;

