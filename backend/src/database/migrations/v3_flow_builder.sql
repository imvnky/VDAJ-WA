-- ============================================================
-- VDAJ Services — Flow Builder Schema (V3)
-- Safe: IF NOT EXISTS. Additive only. No DROP.
-- ============================================================

-- ── FLOWS (top-level automation flow) ────────────────────────
CREATE TABLE IF NOT EXISTS flows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,

    -- Status: draft | active | paused | archived
    status          VARCHAR(50) NOT NULL DEFAULT 'draft',

    -- Execution stats
    trigger_count   INTEGER NOT NULL DEFAULT 0,
    completion_count INTEGER NOT NULL DEFAULT 0,

    -- Viewport snapshot for React Flow
    viewport        JSONB NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',

    -- Quick-start template used (if any)
    template_key    VARCHAR(100),

    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_flows_tenant ON flows(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_flows_status ON flows(tenant_id, status) WHERE deleted_at IS NULL;

-- ── FLOW NODES (React Flow nodes saved as JSONB) ──────────────
CREATE TABLE IF NOT EXISTS flow_nodes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id         UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- React Flow node fields
    node_id         VARCHAR(100) NOT NULL,          -- React Flow internal ID (e.g. "node_1")
    node_type       VARCHAR(100) NOT NULL,          -- trigger | message | delay | action | condition | wa_flow
    label           VARCHAR(255),

    -- Position on canvas
    position_x      NUMERIC(10,2) NOT NULL DEFAULT 0,
    position_y      NUMERIC(10,2) NOT NULL DEFAULT 0,

    -- All node-specific config stored as JSONB
    -- Examples:
    --   Trigger: {triggerType: 'keyword', keywords: ['price','book']}
    --   Message: {messageType: 'text', body: '...', buttons: [{label:'Yes',value:'yes'}]}
    --   Delay:   {unit: 'hours', value: 2}
    --   Action:  {actionType: 'add_tag', tag: 'hot-lead'}
    --   Condition: {field: 'last_reply', operator: 'equals', value: 'yes', truePath: 'node_3', falsePath: 'node_4'}
    config          JSONB NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (flow_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow ON flow_nodes(flow_id);

-- ── FLOW EDGES (React Flow edges / connections) ───────────────
CREATE TABLE IF NOT EXISTS flow_edges (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id         UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    edge_id         VARCHAR(100) NOT NULL,          -- React Flow edge ID
    source_node_id  VARCHAR(100) NOT NULL,
    target_node_id  VARCHAR(100) NOT NULL,
    source_handle   VARCHAR(100),                   -- 'yes' | 'no' | 'default' | null
    target_handle   VARCHAR(100),

    -- Edge display
    label           VARCHAR(255),
    edge_type       VARCHAR(50) NOT NULL DEFAULT 'smoothstep',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (flow_id, edge_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_edges_flow ON flow_edges(flow_id);

-- ── FLOW EXECUTION STATE (per-contact run tracking) ──────────
CREATE TABLE IF NOT EXISTS flow_executions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id         UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone_e164      VARCHAR(20) NOT NULL,

    -- Current position in flow
    current_node_id VARCHAR(100),

    -- Status: running | completed | failed | waiting_reply | waiting_delay
    status          VARCHAR(50) NOT NULL DEFAULT 'running',

    -- Context / variable bag for this execution
    variables       JSONB NOT NULL DEFAULT '{}',

    -- Timing
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_step_at    TIMESTAMPTZ,                    -- For delay nodes
    completed_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    error_message   TEXT,

    -- Audit trail
    step_history    JSONB NOT NULL DEFAULT '[]'     -- [{nodeId, timestamp, result}, ...]
);

CREATE INDEX IF NOT EXISTS idx_executions_flow ON flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_executions_tenant ON flow_executions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_contact ON flow_executions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_executions_next_step ON flow_executions(next_step_at) WHERE status = 'waiting_delay';
