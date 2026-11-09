-- ============================================================
-- Migration 008: Automation Execution Engine & Run Logs
-- ============================================================

CREATE TABLE IF NOT EXISTS automations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    trigger_type    VARCHAR(100) NOT NULL DEFAULT 'manual',
    trigger_config  JSONB NOT NULL DEFAULT '{}',
    steps           JSONB NOT NULL DEFAULT '[]',
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    run_count       INTEGER NOT NULL DEFAULT 0,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_tenant ON automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automations_active ON automations(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS automation_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    automation_id   UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone_e164      VARCHAR(20) NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'running', -- running | completed | failed
    current_step_id VARCHAR(100),
    trigger_type    VARCHAR(100),
    matched_keyword VARCHAR(255),
    logs            JSONB NOT NULL DEFAULT '[]',
    error_message   TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant ON automation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_auto ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_phone ON automation_runs(tenant_id, phone_e164);

