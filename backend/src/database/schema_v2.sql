-- ============================================================
-- VDAJ Services — Schema V2 Extension
-- Safe: IF NOT EXISTS everywhere. No DROP. Additive only.
-- Run: psql -U vdaj_user -d vdaj_whatsapp_db -f schema_v2.sql
-- ============================================================

-- ============================================================
-- SUBSCRIPTIONS & BILLING
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,           -- e.g. Starter, Growth, Enterprise
    price_monthly   NUMERIC(10,2) NOT NULL DEFAULT 0,
    msg_limit       INTEGER NOT NULL DEFAULT 1000,   -- Messages per month
    contact_limit   INTEGER NOT NULL DEFAULT 500,
    user_limit      INTEGER NOT NULL DEFAULT 2,
    features        JSONB NOT NULL DEFAULT '[]',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tier_id             UUID REFERENCES subscription_tiers(id),

    -- Stripe fields (placeholder — swap real keys in prod)
    stripe_customer_id  VARCHAR(255),
    stripe_sub_id       VARCHAR(255),
    stripe_price_id     VARCHAR(255),

    -- Status: active | past_due | canceled | trialing | expired
    status              VARCHAR(50) NOT NULL DEFAULT 'trialing',

    -- India FIRC compliance metadata
    firc_reference      VARCHAR(255),
    firc_bank           VARCHAR(255),
    firc_amount_usd     NUMERIC(10,2),
    firc_date           DATE,

    -- Billing period
    trial_ends_at       TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end  TIMESTAMPTZ,
    canceled_at         TIMESTAMPTZ,

    -- Usage counters (reset monthly)
    msgs_used_this_period INTEGER NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================
-- TWO-WAY INBOX
-- ============================================================

CREATE TABLE IF NOT EXISTS inbox_conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone_e164      VARCHAR(20) NOT NULL,
    display_name    VARCHAR(255),
    wa_contact_id   VARCHAR(255),            -- WhatsApp contact WAID

    -- Conversation state
    status          VARCHAR(50) NOT NULL DEFAULT 'open',   -- open | resolved | snoozed
    unread_count    INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    last_message_preview VARCHAR(500),
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON inbox_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON inbox_conversations(tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_phone ON inbox_conversations(tenant_id, phone_e164);

CREATE TABLE IF NOT EXISTS inbox_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Message metadata
    wa_message_id   VARCHAR(255) UNIQUE,     -- Meta message ID
    direction       VARCHAR(10) NOT NULL,    -- inbound | outbound
    message_type    VARCHAR(50) NOT NULL DEFAULT 'text', -- text | image | document | template | interactive
    body            TEXT,
    media_url       TEXT,
    media_mime_type VARCHAR(100),

    -- Status tracking
    status          VARCHAR(50) NOT NULL DEFAULT 'sent', -- sent | delivered | read | failed
    error_code      VARCHAR(100),

    -- AI draft (for AI auto-responder)
    ai_draft        TEXT,
    ai_confidence   NUMERIC(4,3),

    -- Sender info (for outbound: staff user)
    sent_by         UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation ON inbox_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_tenant ON inbox_messages(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_wa_id ON inbox_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;

-- ============================================================
-- DRIP AUTOMATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS automations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,

    -- Trigger: keyword | opt_in | campaign_complete | manual
    trigger_type    VARCHAR(100) NOT NULL DEFAULT 'manual',
    trigger_config  JSONB NOT NULL DEFAULT '{}',

    -- Steps: [{type: 'delay', value: 3, unit: 'hours'}, {type: 'send_template', templateId: '...'}, {type: 'condition', ...}]
    steps           JSONB NOT NULL DEFAULT '[]',

    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    run_count       INTEGER NOT NULL DEFAULT 0,

    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_tenant ON automations(tenant_id);

-- AI Responder config per tenant
CREATE TABLE IF NOT EXISTS ai_responder_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,

    -- Knowledge base: URL to PDF or plain-text document
    kb_url          TEXT,
    kb_last_indexed TIMESTAMPTZ,

    -- Prompt tuning
    system_prompt   TEXT,
    confidence_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.75,

    -- Model config
    model           VARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-flash',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- META COMMERCE
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_catalogs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    meta_catalog_id     VARCHAR(255) NOT NULL,
    name                VARCHAR(255) NOT NULL,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    product_count       INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_tenant ON commerce_catalogs(tenant_id, meta_catalog_id);

CREATE TABLE IF NOT EXISTS commerce_products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalog_id          UUID NOT NULL REFERENCES commerce_catalogs(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    meta_product_id     VARCHAR(255) NOT NULL,
    name                VARCHAR(500) NOT NULL,
    description         TEXT,
    price               NUMERIC(12,2),
    currency            VARCHAR(10) NOT NULL DEFAULT 'INR',
    image_url           TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_catalog ON commerce_products(catalog_id);

-- ============================================================
-- OPT-OUT LOG (Audit trail for every STOP event)
-- ============================================================

CREATE TABLE IF NOT EXISTS opt_out_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone_e164      VARCHAR(20) NOT NULL,
    trigger_phrase  VARCHAR(100),    -- The exact message that triggered opt-out (STOP, UNSUBSCRIBE etc.)
    source          VARCHAR(50) NOT NULL DEFAULT 'webhook',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opt_out_events_tenant ON opt_out_events(tenant_id, created_at DESC);

-- ============================================================
-- ANALYTICS SNAPSHOTS (Pre-computed for fast dashboard reads)
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    msgs_sent       INTEGER NOT NULL DEFAULT 0,
    msgs_delivered  INTEGER NOT NULL DEFAULT 0,
    msgs_read       INTEGER NOT NULL DEFAULT 0,
    msgs_failed     INTEGER NOT NULL DEFAULT 0,
    opt_outs        INTEGER NOT NULL DEFAULT 0,
    new_contacts    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_tenant_date ON analytics_snapshots(tenant_id, snapshot_date);

-- ============================================================
-- SEED — Default Subscription Tiers
-- ============================================================

INSERT INTO subscription_tiers (name, price_monthly, msg_limit, contact_limit, user_limit, features)
VALUES
  ('Starter',    999,   5000,   1000,  2,  '["1 WABA Number","5K messages/mo","Basic Templates","Email Support"]'),
  ('Growth',     2999,  25000,  10000, 5,  '["1 WABA Number","25K messages/mo","Rich Templates","Inbox","Automations","Priority Support"]'),
  ('Enterprise', 7999,  100000, 100000,25, '["3 WABA Numbers","100K messages/mo","All Features","AI Responder","Commerce","Dedicated Support"]')
ON CONFLICT DO NOTHING;

-- Assign trialing subscription to existing tenant(s)
INSERT INTO subscriptions (tenant_id, tier_id, status, trial_ends_at)
SELECT
  t.id,
  (SELECT id FROM subscription_tiers WHERE name = 'Growth' LIMIT 1),
  'trialing',
  NOW() + INTERVAL '14 days'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id)
ON CONFLICT DO NOTHING;
