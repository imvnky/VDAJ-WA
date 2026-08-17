/**
 * VDAJ Services — NodeConfigDrawer
 * Sliding right-side panel for editing selected node properties.
 * Renders different forms based on node type.
 */

import React, { useState, useEffect } from 'react';

// ── Close Button ──────────────────────────────────────────────
function CloseBtn({ onClick }) {
  return (
    <button onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: '8px', border: 'none',
        background: 'rgba(248,247,255,0.1)', color: 'rgba(248,247,255,0.6)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#f87171'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,247,255,0.1)'; e.currentTarget.style.color = 'rgba(248,247,255,0.6)'; }}>
      ✕
    </button>
  );
}

// ── Field Components ──────────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(175,169,236,0.9)', marginBottom: '6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: '10px', color: 'rgba(248,247,255,0.3)', marginTop: '4px' }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '10px', fontSize: '13px',
  background: 'rgba(248,247,255,0.05)', border: '1px solid rgba(175,169,236,0.25)',
  color: '#F8F7FF', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'none' };

function ConfigInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder}
      style={inputStyle}
      onFocus={(e) => { e.target.style.borderColor = '#534AB7'; e.target.style.boxShadow = '0 0 0 3px rgba(83,74,183,0.2)'; }}
      onBlur={(e) => { e.target.style.borderColor = 'rgba(175,169,236,0.25)'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function ConfigSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value || ''} onChange={onChange} style={selectStyle}>
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: '#1A1A2E' }}>{o.label}</option>
        ))}
      </select>
      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(175,169,236,0.5)', fontSize: '11px' }}>▼</span>
    </div>
  );
}

function ConfigTextarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value || ''} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}
      onFocus={(e) => { e.target.style.borderColor = '#534AB7'; e.target.style.boxShadow = '0 0 0 3px rgba(83,74,183,0.2)'; }}
      onBlur={(e) => { e.target.style.borderColor = 'rgba(175,169,236,0.25)'; e.target.style.boxShadow = 'none'; }}
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
        <ConfigSelect value={config.triggerType || 'keyword'} onChange={(e) => onChange({ ...config, triggerType: e.target.value })}
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
        <Field label="Trigger Keywords" hint="Message must contain any of these words">
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <input value={kwInput} onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKw()}
              placeholder="e.g. price, book, help…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addKw} style={{
              padding: '9px 14px', borderRadius: '10px', background: '#534AB7', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            }}>+</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {keywords.map((kw) => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '20px',
                background: 'rgba(83,74,183,0.2)', border: '1px solid rgba(83,74,183,0.4)',
                fontSize: '12px', color: '#AFA9EC',
              }}>
                {kw}
                <button onClick={() => removeKw(kw)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '12px' }}>✕</button>
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
    const newBtns = buttons.map((b, idx) => idx === i ? { ...b, [key]: val } : b);
    onChange({ ...config, buttons: newBtns });
  };

  const addBtn = () => {
    if (buttons.length >= 3) return;
    onChange({ ...config, buttons: [...buttons, { label: `Option ${buttons.length + 1}`, value: `opt_${buttons.length + 1}` }] });
  };

  const removeBtn = (i) => onChange({ ...config, buttons: buttons.filter((_, idx) => idx !== i) });

  return (
    <>
      <Field label="Message Type">
        <ConfigSelect value={config.messageType || 'text'} onChange={(e) => onChange({ ...config, messageType: e.target.value, buttons: [] })}
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
          <ConfigInput value={config.imageUrl} onChange={(e) => onChange({ ...config, imageUrl: e.target.value })} placeholder="https://example.com/image.jpg" />
        </Field>
      )}

      <Field label="Message Body" hint="Supports *bold*, _italic_, {{name}} variables">
        <ConfigTextarea value={config.body} onChange={(e) => onChange({ ...config, body: e.target.value })}
          placeholder="Hi {{name}}, thanks for reaching out! 👋" rows={5} />
      </Field>

      {(config.messageType === 'buttons' || config.messageType === 'list') && (
        <Field label={`Buttons (${buttons.length}/3)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {buttons.map((btn, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input value={btn.label || ''} onChange={(e) => updateBtn(i, 'label', e.target.value)}
                  placeholder={`Option ${i + 1} label`} style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => removeBtn(i)} style={{ width: 32, height: 32, borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)', color: '#f87171', cursor: 'pointer', flexShrink: 0 }}>✕</button>
              </div>
            ))}
            {buttons.length < 3 && (
              <button onClick={addBtn} style={{
                padding: '8px', borderRadius: '10px', border: '1px dashed rgba(83,74,183,0.4)',
                background: 'transparent', color: '#AFA9EC', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              }}>+ Add Button</button>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <ConfigInput type="number" value={config.value || 1} onChange={(e) => onChange({ ...config, value: parseInt(e.target.value) || 1 })} placeholder="1" />
          <ConfigSelect value={config.unit || 'hours'} onChange={(e) => onChange({ ...config, unit: e.target.value })}
            options={[{ value: 'minutes', label: 'Minutes' }, { value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }]}
          />
        </div>
      </Field>
      <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginTop: '4px' }}>
        <p style={{ fontSize: '11px', color: 'rgba(245,158,11,0.8)', lineHeight: 1.6 }}>
          ⏱️ Flow execution will pause for <strong style={{ color: '#F59E0B' }}>{config.value || 1} {config.unit || 'hours'}</strong> before proceeding to the next step.
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
        <ConfigSelect value={config.actionType || 'add_tag'} onChange={(e) => onChange({ ...config, actionType: e.target.value })}
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
          <ConfigInput value={config.tag} onChange={(e) => onChange({ ...config, tag: e.target.value })} placeholder="e.g. hot-lead, vip, interested" />
        </Field>
      )}

      {config.actionType === 'assign' && (
        <Field label="Agent Name / ID">
          <ConfigInput value={config.agentName} onChange={(e) => onChange({ ...config, agentName: e.target.value })} placeholder="e.g. Sales Team, Agent #2" />
        </Field>
      )}

      {config.actionType === 'webhook' && (
        <>
          <Field label="Webhook URL" hint="POST request with contact data will be sent">
            <ConfigInput value={config.webhookUrl} onChange={(e) => onChange({ ...config, webhookUrl: e.target.value })} placeholder="https://your-crm.com/webhook" />
          </Field>
          <Field label="Secret Header (optional)">
            <ConfigInput value={config.webhookSecret} onChange={(e) => onChange({ ...config, webhookSecret: e.target.value })} placeholder="X-VDAJ-Secret value" />
          </Field>
        </>
      )}

      {config.actionType === 'condition' && (
        <>
          <Field label="Evaluate Field">
            <ConfigSelect value={config.field || 'last_reply'} onChange={(e) => onChange({ ...config, field: e.target.value })}
              options={[
                { value: 'last_reply', label: 'Last Reply Text' },
                { value: 'tag',        label: 'Contact Has Tag' },
                { value: 'status',     label: 'Contact Status' },
                { value: 'button',     label: 'Button Response' },
              ]}
            />
          </Field>
          <Field label="Operator">
            <ConfigSelect value={config.operator || 'equals'} onChange={(e) => onChange({ ...config, operator: e.target.value })}
              options={[{ value: 'equals', label: 'Equals' }, { value: 'contains', label: 'Contains' }, { value: 'not_equals', label: 'Not Equals' }]}
            />
          </Field>
          <Field label="Value">
            <ConfigInput value={config.value} onChange={(e) => onChange({ ...config, value: e.target.value })} placeholder="e.g. yes, hot-lead" />
          </Field>
          <div style={{ display: 'flex', gap: '8px', padding: '10px', background: 'rgba(236,72,153,0.08)', borderRadius: '10px', border: '1px solid rgba(236,72,153,0.2)' }}>
            <span style={{ fontSize: '11px', color: 'rgba(248,247,255,0.5)' }}>✅ True path → Yes handle &nbsp; | &nbsp; ❌ False path → No handle</span>
          </div>
        </>
      )}
    </>
  );
}

// ── Main Drawer ───────────────────────────────────────────────
export default function NodeConfigDrawer({ node, onClose, onUpdate }) {
  const [localConfig, setLocalConfig] = useState(node?.data?.config || {});

  useEffect(() => {
    setLocalConfig(node?.data?.config || {});
  }, [node?.id]);

  const handleChange = (newConfig) => {
    setLocalConfig(newConfig);
    onUpdate(node.id, { config: newConfig });
  };

  if (!node) return null;

  const NODE_LABELS = {
    trigger:   { label: 'Trigger Node',  icon: '⚡', color: '#534AB7' },
    message:   { label: 'Message Node',  icon: '💬', color: '#534AB7' },
    delay:     { label: 'Delay Node',    icon: '⏱️', color: '#F59E0B' },
    action:    { label: 'Action Node',   icon: '⚙️', color: '#1D9E75' },
  };
  const meta = NODE_LABELS[node.type] || { label: 'Configure', icon: '⚙️', color: '#534AB7' };

  return (
    <>
      {/* Backdrop on mobile */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'transparent',
        pointerEvents: 'none',
      }} />

      {/* Drawer */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: '320px', zIndex: 50,
        background: 'rgba(13,13,34,0.97)',
        backdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(175,169,236,0.15)',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)',
        overflowY: 'auto',
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Drawer Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(175,169,236,0.12)',
          display: 'flex', alignItems: 'center', gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '10px',
            background: `${meta.color}20`, border: `1px solid ${meta.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
          }}>
            {meta.icon}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '11px', color: 'rgba(175,169,236,0.6)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Configure</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#F8F7FF' }}>{meta.label}</p>
          </div>
          <CloseBtn onClick={onClose} />
        </div>

        {/* Node Label */}
        <div style={{ padding: '16px 20px 0' }}>
          <Field label="Node Label">
            <ConfigInput value={node.data?.label || ''} onChange={(e) => onUpdate(node.id, { label: e.target.value })} placeholder="Give this node a name…" />
          </Field>
        </div>

        {/* Type-Specific Config */}
        <div style={{ padding: '0 20px 24px', flex: 1 }}>
          <div style={{ height: '1px', background: 'rgba(175,169,236,0.08)', margin: '8px 0 16px' }} />
          {node.type === 'trigger'  && <TriggerForm  config={localConfig} onChange={handleChange} />}
          {node.type === 'message'  && <MessageForm  config={localConfig} onChange={handleChange} />}
          {node.type === 'delay'    && <DelayForm    config={localConfig} onChange={handleChange} />}
          {node.type === 'action'   && <ActionForm   config={localConfig} onChange={handleChange} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid rgba(175,169,236,0.1)',
          flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            width: '100%', padding: '10px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #534AB7 0%, #3B3499 100%)',
            border: 'none', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 700, letterSpacing: '0.02em',
            boxShadow: '0 4px 16px rgba(83,74,183,0.4)',
            transition: 'all 0.2s',
          }}>
            ✓ Done
          </button>
        </div>
      </div>
    </>
  );
}
