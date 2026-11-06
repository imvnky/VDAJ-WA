/**
 * VDAJ Services — NodeConfigDrawer (Enterprise Light Edition)
 * Sliding right-side panel for editing selected node properties.
 * Clean, high-contrast, professional design.
 */

import React, { useState, useEffect } from 'react';

// ── Close Button ──────────────────────────────────────────────
function CloseBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        background: '#F8FAFC',
        color: '#64748B',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#FEE2E2';
        e.currentTarget.style.color = '#DC2626';
        e.currentTarget.style.borderColor = '#FECACA';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#F8FAFC';
        e.currentTarget.style.color = '#64748B';
        e.currentTarget.style.borderColor = '#E2E8F0';
      }}
    >
      ✕
    </button>
  );
}

// ── Field Components ──────────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label
        style={{
          display: 'block',
          fontSize: '11px',
          fontWeight: 800,
          color: '#334155',
          marginBottom: '6px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', margin: 0 }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  fontSize: '13px',
  background: '#F8FAFC',
  border: '1px solid #CBD5E1',
  color: '#0F172A',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'all 0.15s ease',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: '16px',
  paddingRight: '36px',
};

function ConfigInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      style={inputStyle}
      onFocus={(e) => {
        e.target.style.borderColor = '#534AB7';
        e.target.style.background = '#FFFFFF';
        e.target.style.boxShadow = '0 0 0 3px rgba(83,74,183,0.15)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#CBD5E1';
        e.target.style.background = '#F8FAFC';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

function ConfigSelect({ value, onChange, options }) {
  return (
    <select
      value={value || ''}
      onChange={onChange}
      style={selectStyle}
      onFocus={(e) => {
        e.target.style.borderColor = '#534AB7';
        e.target.style.background = '#FFFFFF';
        e.target.style.boxShadow = '0 0 0 3px rgba(83,74,183,0.15)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#CBD5E1';
        e.target.style.background = '#F8FAFC';
        e.target.style.boxShadow = 'none';
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: '#FFFFFF', color: '#0F172A' }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ConfigTextarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      style={{
        ...inputStyle,
        resize: 'vertical',
        fontFamily: 'Inter, sans-serif',
        lineHeight: 1.5,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = '#534AB7';
        e.target.style.background = '#FFFFFF';
        e.target.style.boxShadow = '0 0 0 3px rgba(83,74,183,0.15)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#CBD5E1';
        e.target.style.background = '#F8FAFC';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

// ── Form: Trigger ─────────────────────────────────────────────
function TriggerForm({ config, onChange }) {
  const [kwInput, setKwInput] = useState('');
  const keywords = config.keywords || [];

  const addKw = () => {
    if (!kwInput.trim()) return;
    const newKws = [...new Set([...keywords, kwInput.trim().toLowerCase()])];
    onChange({ ...config, keywords: newKws });
    setKwInput('');
  };

  const removeKw = (kw) => onChange({ ...config, keywords: keywords.filter((k) => k !== kw) });

  return (
    <>
      <Field label="Trigger Type">
        <ConfigSelect
          value={config.triggerType || 'keyword'}
          onChange={(e) => onChange({ ...config, triggerType: e.target.value })}
          options={[
            { value: 'keyword',  label: '⌨️  Keyword Received' },
            { value: 'new_lead', label: '👤  New Lead Added' },
            { value: 'opt_in',   label: '✅  Contact Opts In' },
            { value: 'campaign', label: '📣  Campaign Complete' },
            { value: 'inbound',  label: '💬  Any Inbound Message' },
          ]}
        />
      </Field>

      {(config.triggerType === 'keyword' || !config.triggerType) && (
        <Field label="Trigger Keywords" hint="Message must contain any of these keywords (Press Enter to add)">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKw()}
              placeholder="e.g. price, book, ticket, help…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={addKw}
              type="button"
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                background: '#534AB7',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              + Add
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {keywords.map((kw) => (
              <span
                key={kw}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: '#F5F3FF',
                  border: '1px solid #DDD6FE',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6D28D9',
                }}
              >
                {kw}
                <button
                  onClick={() => removeKw(kw)}
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#EF4444',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                    fontSize: '12px',
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </Field>
      )}
    </>
  );
}

// ── Form: Message ─────────────────────────────────────────────
function MessageForm({ config, onChange }) {
  const buttons = config.buttons || [];

  const updateBtn = (i, key, val) => {
    const newBtns = buttons.map((b, idx) => (idx === i ? { ...b, [key]: val } : b));
    onChange({ ...config, buttons: newBtns });
  };

  const addBtn = () => {
    if (buttons.length >= 3) return;
    onChange({
      ...config,
      buttons: [...buttons, { label: `Option ${buttons.length + 1}`, value: `opt_${buttons.length + 1}` }],
    });
  };

  const removeBtn = (i) => onChange({ ...config, buttons: buttons.filter((_, idx) => idx !== i) });

  return (
    <>
      <Field label="Message Type">
        <ConfigSelect
          value={config.messageType || 'text'}
          onChange={(e) => onChange({ ...config, messageType: e.target.value, buttons: [] })}
          options={[
            { value: 'text',    label: '💬  Text Message' },
            { value: 'image',   label: '🖼️   Image + Caption' },
            { value: 'buttons', label: '🔘  Interactive Buttons' },
            { value: 'wa_flow', label: '📋  WhatsApp Flow Form' },
            { value: 'list',    label: '📝  List Message' },
          ]}
        />
      </Field>

      {config.messageType === 'image' && (
        <Field label="Image URL">
          <ConfigInput
            value={config.imageUrl}
            onChange={(e) => onChange({ ...config, imageUrl: e.target.value })}
            placeholder="https://example.com/image.jpg"
          />
        </Field>
      )}

      <Field label="Message Body" hint="Supports WhatsApp formatting (*bold*, _italic_, {{name}} variables)">
        <ConfigTextarea
          value={config.body}
          onChange={(e) => onChange({ ...config, body: e.target.value })}
          placeholder="Hi {{name}}, thanks for reaching out to us! 👋"
          rows={5}
        />
      </Field>

      {(config.messageType === 'buttons' || config.messageType === 'list') && (
        <Field label={`Interactive Buttons (${buttons.length}/3)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {buttons.map((btn, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  value={btn.label || ''}
                  onChange={(e) => updateBtn(i, 'label', e.target.value)}
                  placeholder={`Option ${i + 1} label`}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => removeBtn(i)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    border: '1px solid #FECACA',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    cursor: 'pointer',
                    flexShrink: 0,
                    fontWeight: 'bold',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {buttons.length < 3 && (
              <button
                type="button"
                onClick={addBtn}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1.5px dashed #CBD5E1',
                  background: '#F8FAFC',
                  color: '#534AB7',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#534AB7';
                  e.currentTarget.style.background = '#F5F3FF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#CBD5E1';
                  e.currentTarget.style.background = '#F8FAFC';
                }}
              >
                + Add Option Button
              </button>
            )}
          </div>
        </Field>
      )}
    </>
  );
}

// ── Form: Delay ───────────────────────────────────────────────
function DelayForm({ config, onChange }) {
  return (
    <>
      <Field label="Wait Duration">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <ConfigInput
            type="number"
            value={config.value || 1}
            onChange={(e) => onChange({ ...config, value: parseInt(e.target.value) || 1 })}
            placeholder="1"
          />
          <ConfigSelect
            value={config.unit || 'hours'}
            onChange={(e) => onChange({ ...config, unit: e.target.value })}
            options={[
              { value: 'minutes', label: 'Minutes' },
              { value: 'hours',   label: 'Hours' },
              { value: 'days',    label: 'Days' },
            ]}
          />
        </div>
      </Field>
      <div
        style={{
          padding: '14px',
          borderRadius: '12px',
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          marginTop: '6px',
        }}
      >
        <p style={{ fontSize: '12px', color: '#B45309', lineHeight: 1.6, margin: 0 }}>
          ⏱️ Flow execution will hold for{' '}
          <strong style={{ color: '#D97706' }}>
            {config.value || 1} {config.unit || 'hours'}
          </strong>{' '}
          before sending the next message.
        </p>
      </div>
    </>
  );
}

// ── Form: Action ──────────────────────────────────────────────
function ActionForm({ config, onChange }) {
  return (
    <>
      <Field label="Action Type">
        <ConfigSelect
          value={config.actionType || 'add_tag'}
          onChange={(e) => onChange({ ...config, actionType: e.target.value })}
          options={[
            { value: 'add_tag',    label: '🏷️  Add Tag' },
            { value: 'remove_tag', label: '✂️  Remove Tag' },
            { value: 'assign',     label: '👤  Assign to Agent' },
            { value: 'webhook',    label: '🔗  Trigger Webhook' },
            { value: 'opt_out',    label: '🚫  Mark Opted Out' },
            { value: 'condition',  label: '❓  Check Condition' },
          ]}
        />
      </Field>

      {(config.actionType === 'add_tag' || config.actionType === 'remove_tag') && (
        <Field label="Tag Name">
          <ConfigInput
            value={config.tag}
            onChange={(e) => onChange({ ...config, tag: e.target.value })}
            placeholder="e.g. hot-lead, vip, holiday-inquiry"
          />
        </Field>
      )}

      {config.actionType === 'assign' && (
        <Field label="Agent Name / Department">
          <ConfigInput
            value={config.agentName}
            onChange={(e) => onChange({ ...config, agentName: e.target.value })}
            placeholder="e.g. Sales Team, Reservations Desk"
          />
        </Field>
      )}

      {config.actionType === 'webhook' && (
        <Field label="Webhook Endpoint URL">
          <ConfigInput
            value={config.webhookUrl}
            onChange={(e) => onChange({ ...config, webhookUrl: e.target.value })}
            placeholder="https://your-crm.com/api/webhook"
          />
        </Field>
      )}

      {config.actionType === 'condition' && (
        <>
          <Field label="Check Field">
            <ConfigSelect
              value={config.field || 'last_reply'}
              onChange={(e) => onChange({ ...config, field: e.target.value })}
              options={[
                { value: 'last_reply', label: 'User Last Reply' },
                { value: 'tag',        label: 'Contact Tag' },
                { value: 'country',    label: 'Phone Country' },
              ]}
            />
          </Field>
          <Field label="Condition Operator">
            <ConfigSelect
              value={config.operator || 'equals'}
              onChange={(e) => onChange({ ...config, operator: e.target.value })}
              options={[
                { value: 'equals',   label: 'Equals Exactly' },
                { value: 'contains', label: 'Contains Keyword' },
              ]}
            />
          </Field>
          <Field label="Expected Value">
            <ConfigInput
              value={config.value}
              onChange={(e) => onChange({ ...config, value: e.target.value })}
              placeholder="e.g. yes, confirmed, booking"
            />
          </Field>
        </>
      )}
    </>
  );
}

// ── Main Drawer Component ─────────────────────────────────────
export default function NodeConfigDrawer({ node, onClose, onUpdate, onDelete }) {
  const [localConfig, setLocalConfig] = useState(node.data?.config || {});

  useEffect(() => {
    setLocalConfig(node.data?.config || {});
  }, [node.id, node.data?.config]);

  const handleChange = (newConfig) => {
    setLocalConfig(newConfig);
    onUpdate(node.id, { config: newConfig });
  };

  const TYPE_META = {
    trigger: { label: 'Trigger Node',      color: '#7C3AED', icon: '⚡', lightBg: '#FAF5FF', border: '#F3E8FF' },
    message: { label: 'WhatsApp Message',  color: '#2563EB', icon: '💬', lightBg: '#EFF6FF', border: '#DBEAFE' },
    delay:   { label: 'Timer / Delay Step',color: '#D97706', icon: '⏱️', lightBg: '#FFFBEB', border: '#FDE68A' },
    action:  { label: 'Workflow Action',   color: '#059669', icon: '⚙️', lightBg: '#ECFDF5', border: '#A7F3D0' },
  };

  const meta = TYPE_META[node.type] || TYPE_META.action;

  return (
    <>
      {/* Drawer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '360px',
          background: '#FFFFFF',
          borderLeft: '1px solid #E2E8F0',
          boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: meta.lightBg,
            borderBottom: `1px solid ${meta.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '12px',
              background: '#FFFFFF',
              border: `1px solid ${meta.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            {meta.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: '10px',
                color: meta.color,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Configure Step
            </p>
            <p
              style={{
                fontSize: '15px',
                fontWeight: 800,
                color: '#0F172A',
                margin: '2px 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {meta.label}
            </p>
          </div>
          <CloseBtn onClick={onClose} />
        </div>

        {/* Node Label */}
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <Field label="Step Title / Label">
            <ConfigInput
              value={node.data?.label || ''}
              onChange={(e) => onUpdate(node.id, { label: e.target.value })}
              placeholder="e.g. Welcome Message, Qualification..."
            />
          </Field>
        </div>

        {/* Type-Specific Config Body */}
        <div style={{ padding: '0 20px 20px', flex: 1, overflowY: 'auto' }}>
          <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0 16px' }} />
          {node.type === 'trigger' && <TriggerForm config={localConfig} onChange={handleChange} />}
          {node.type === 'message' && <MessageForm config={localConfig} onChange={handleChange} />}
          {node.type === 'delay'   && <DelayForm   config={localConfig} onChange={handleChange} />}
          {node.type === 'action'  && <ActionForm  config={localConfig} onChange={handleChange} />}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #E2E8F0',
            background: '#F8FAFC',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <button
            onClick={onClose}
            type="button"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: '#534AB7',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(83, 74, 183, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            ✓ Save & Close Drawer
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(node.id)}
              type="button"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '10px',
                background: 'transparent',
                border: '1px solid #FECACA',
                color: '#DC2626',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              🗑️ Delete this step
            </button>
          )}
        </div>
      </div>
    </>
  );
}
