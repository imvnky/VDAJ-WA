-- ============================================================
-- VDAJ SERVICES — POSTGRESQL SCHEMA
-- Multi-tenant SaaS | RBAC | WhatsApp Bulk Messaging Platform
-- Version: 1.0.0
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'tenant_user');
CREATE TYPE tenant_plan AS ENUM ('starter', 'growth', 'enterprise', 'custom');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed');
CREATE TYPE message_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed', 'dead_letter');
CREATE TYPE template_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE template_category AS ENUM ('marketing', 'utility', 'authentication');
CREATE TYPE contact_status AS ENUM ('active', 'opted_out', 'invalid');
CREATE TYPE webhook_event_type AS ENUM ('message_sent', 'message_delivered', 'message_read', 'message_failed', 'status_update');

-- ============================================================
-- TENANTS (Clients / Organizations)
-- ============================================================

CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,         -- URL-safe identifier
    plan            tenant_plan NOT NULL DEFAULT 'starter',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    country_code    CHAR(2) NOT NULL DEFAULT 'IN',        -- ISO 3166-1 alpha-2
    timezone        VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    max_messages_per_day  INTEGER NOT NULL DEFAULT 1000,
    monthly_message_quota INTEGER NOT NULL DEFAULT 30000,

    -- Meta / WhatsApp Business Account
    waba_id         VARCHAR(255),                          -- WhatsApp Business Account ID
    phone_number_id VARCHAR(255),                          -- Meta Phone Number ID
    meta_system_token TEXT,                                -- Encrypted system-user token
    meta_token_expires_at TIMESTAMPTZ,

    -- Billing (client pays Meta directly; we track usage)
    stripe_customer_id VARCHAR(255),

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                            -- Soft delete
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_is_active ON tenants(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL for super_admin
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    role            user_role NOT NULL DEFAULT 'tenant_user',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    refresh_token_hash TEXT,
    password_reset_token TEXT,
    password_reset_expires_at TIMESTAMPTZ,

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- CONTACT LISTS (Phonebook Groups)
-- ============================================================

CREATE TABLE contact_lists (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    contact_count   INTEGER NOT NULL DEFAULT 0,           -- Denormalized counter (updated by trigger)

    -- Audit
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_contact_lists_tenant_id ON contact_lists(tenant_id) WHERE deleted_at IS NULL;

-- ============================================================
-- CONTACTS
-- ============================================================

CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone_e164      VARCHAR(20) NOT NULL,                  -- E.164 format: +919876543210
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    display_name    VARCHAR(255) GENERATED ALWAYS AS (
                        COALESCE(first_name || ' ' || last_name, first_name, last_name, phone_e164)
                    ) STORED,
    email           VARCHAR(255),
    status          contact_status NOT NULL DEFAULT 'active',
    custom_vars     JSONB DEFAULT '{}',                    -- {var1: val, var2: val} for template personalization
    opted_out_at    TIMESTAMPTZ,
    invalid_reason  TEXT,

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, phone_e164)
);

CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_contacts_phone ON contacts(phone_e164);
CREATE INDEX idx_contacts_status ON contacts(tenant_id, status);
CREATE INDEX idx_contacts_custom_vars ON contacts USING GIN(custom_vars);

-- ============================================================
-- CONTACT LIST MEMBERS (Junction Table)
-- ============================================================

CREATE TABLE contact_list_members (
    contact_list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (contact_list_id, contact_id)
);

CREATE INDEX idx_clm_contact_id ON contact_list_members(contact_id);

-- ============================================================
-- MESSAGE TEMPLATES
-- ============================================================

CREATE TABLE message_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(512) NOT NULL,                 -- Meta template name (snake_case)
    meta_template_id VARCHAR(255),                         -- Meta's template ID after approval
    category        template_category NOT NULL DEFAULT 'marketing',
    language        VARCHAR(10) NOT NULL DEFAULT 'en',
    status          template_status NOT NULL DEFAULT 'pending',
    body_text       TEXT NOT NULL,                         -- Raw markdown body (*bold*, _italic_)
    header_text     TEXT,                                  -- Optional header
    footer_text     TEXT,                                  -- Optional footer
    buttons         JSONB DEFAULT '[]',                    -- CTA buttons definition
    variables_schema JSONB DEFAULT '[]',                   -- [{name: "name", type: "text", example: "John"}]
    rejection_reason TEXT,

    -- Audit
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE(tenant_id, name, language)
);

CREATE INDEX idx_templates_tenant_id ON message_templates(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_templates_status ON message_templates(status);

-- ============================================================
-- CAMPAIGNS
-- ============================================================

CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(512) NOT NULL,
    template_id     UUID REFERENCES message_templates(id),
    contact_list_id UUID REFERENCES contact_lists(id),
    status          campaign_status NOT NULL DEFAULT 'draft',

    -- Scheduling (stored in UTC, displayed in tenant timezone)
    scheduled_at_utc TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,

    -- Runtime stats (denormalized for fast dashboard reads)
    total_count     INTEGER NOT NULL DEFAULT 0,
    queued_count    INTEGER NOT NULL DEFAULT 0,
    sent_count      INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    read_count      INTEGER NOT NULL DEFAULT 0,
    failed_count    INTEGER NOT NULL DEFAULT 0,
    dead_letter_count INTEGER NOT NULL DEFAULT 0,

    -- Queue config overrides (optional, falls back to tenant defaults)
    chunk_size      INTEGER,
    delay_ms        INTEGER,

    -- Audit
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_tenant_id ON campaigns(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON campaigns(scheduled_at_utc) WHERE status = 'scheduled';

-- ============================================================
-- CAMPAIGN MESSAGES (Individual send records)
-- ============================================================

CREATE TABLE campaign_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone_e164      VARCHAR(20) NOT NULL,                  -- Snapshot at send time
    template_vars   JSONB DEFAULT '{}',                    -- Personalization values used
    status          message_status NOT NULL DEFAULT 'queued',

    -- Meta response
    meta_message_id VARCHAR(255),                          -- wamid from Meta API
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,

    -- Retry tracking
    retry_count     SMALLINT NOT NULL DEFAULT 0,
    last_error      TEXT,
    error_code      VARCHAR(50),                           -- VDAJ error codes e.g. ERR_META_001

    -- Dead-letter
    is_dead_letter  BOOLEAN NOT NULL DEFAULT FALSE,
    dead_lettered_at TIMESTAMPTZ,

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cm_campaign_id ON campaign_messages(campaign_id);
CREATE INDEX idx_cm_tenant_id ON campaign_messages(tenant_id);
CREATE INDEX idx_cm_status ON campaign_messages(campaign_id, status);
CREATE INDEX idx_cm_meta_message_id ON campaign_messages(meta_message_id) WHERE meta_message_id IS NOT NULL;
CREATE INDEX idx_cm_dead_letter ON campaign_messages(is_dead_letter) WHERE is_dead_letter = TRUE;

-- ============================================================
-- WEBHOOK EVENTS (Meta Status Updates)
-- ============================================================

CREATE TABLE webhook_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type      webhook_event_type NOT NULL,
    meta_message_id VARCHAR(255),
    raw_payload     JSONB NOT NULL,
    processed       BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at    TIMESTAMPTZ,
    error           TEXT,

    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_tenant_id ON webhook_events(tenant_id);
CREATE INDEX idx_webhook_meta_message_id ON webhook_events(meta_message_id);
CREATE INDEX idx_webhook_unprocessed ON webhook_events(processed) WHERE processed = FALSE;

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(255) NOT NULL,                  -- e.g. 'campaign.created', 'user.login'
    resource_type   VARCHAR(100),
    resource_id     UUID,
    meta            JSONB DEFAULT '{}',
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- TRIGGERS — Auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'tenants', 'users', 'contact_lists', 'contacts',
        'message_templates', 'campaigns', 'campaign_messages'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', t
        );
    END LOOP;
END $$;

-- ============================================================
-- TRIGGER — Sync contact_count on contact_list_members
-- ============================================================

CREATE OR REPLACE FUNCTION sync_contact_list_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE contact_lists SET contact_count = contact_count + 1
        WHERE id = NEW.contact_list_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE contact_lists SET contact_count = GREATEST(contact_count - 1, 0)
        WHERE id = OLD.contact_list_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_contact_count
AFTER INSERT OR DELETE ON contact_list_members
FOR EACH ROW EXECUTE FUNCTION sync_contact_list_count();

-- ============================================================
-- SEED — Default SuperAdmin User (CHANGE IN PROD)
-- ============================================================

-- Note: password_hash is bcrypt of 'VDAJSuper@2025!' — CHANGE IMMEDIATELY
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_verified)
VALUES (
    'superadmin@vdajservices.com',
    '$2a$12$placeholder_hash_change_in_prod',
    'VDAJ',
    'SuperAdmin',
    'super_admin',
    TRUE,
    TRUE
) ON CONFLICT (email) DO NOTHING;
