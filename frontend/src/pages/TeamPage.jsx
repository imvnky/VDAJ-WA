/**
 * VDAJ Services — TeamPage
 * Route: /team
 * Dedicated Team Management page: member list, role badges, and invitation modal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { teamApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';
import useAuthStore from '../store/authStore';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function RoleBadge({ role }) {
  const cfg = {
    super_admin:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Super Admin' },
    tenant_admin: { color: '#534AB7', bg: 'rgba(83,74,183,0.12)',   label: 'Admin' },
    manager:      { color: '#0284c7', bg: 'rgba(2,132,199,0.12)',   label: 'Manager' },
    agent:        { color: '#1D9E75', bg: 'rgba(29,158,117,0.12)', label: 'Agent' },
    tenant_user:  { color: '#1D9E75', bg: 'rgba(29,158,117,0.12)', label: 'Agent' },
  };
  const c = cfg[role] || cfg.tenant_user;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function InviteModal({ onClose, onInvited }) {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'agent' });
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null); // { email, tempPassword }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email) { showError('Email is required.'); return; }
    setSending(true);
    try {
      const res = await teamApi.invite(form);
      const data = res?.data || res;
      setResult(data);
      if (onInvited) onInvited(data);
      showSuccess('Member invite generated successfully.');
    } catch (err) {
      showError(err?.response?.data?.message || err?.message || 'Failed to invite member.');
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-white border border-[#E6E4F5]">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-[#E6F7F1] text-[#1D9E75]">
                ✓
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F0F0F]">Team Member Created!</p>
                <p className="text-xs text-[#64748B]">Share these temporary credentials (shown once).</p>
              </div>
            </div>
            <div className="rounded-xl p-4 space-y-2 bg-[#F8F7FF] border border-[#E6E4F5]">
              <div className="flex justify-between items-center">
                <span className="text-2xs text-[#64748B]">Email</span>
                <span className="font-mono text-xs font-semibold text-[#0F0F0F]">{result.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xs text-[#64748B]">Temp Password</span>
                <span className="font-mono text-xs font-bold text-[#534AB7]">{result.tempPassword}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full h-10 rounded-xl text-xs font-bold text-white bg-[#534AB7] hover:bg-[#433B9B] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl bg-white border border-[#E6E4F5]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E4F5] bg-[#F8F7FF]">
          <div>
            <h2 className="text-base font-bold text-[#0F0F0F]">Invite Team Member</h2>
            <p className="text-xs text-[#64748B]">Add a colleague to your workspace</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 text-[#64748B]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#334155]">Email Address *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="colleague@example.com"
              className="h-10 rounded-xl px-3 text-sm outline-none w-full bg-[#F8F7FF] border border-[#E6E4F5] text-[#0F0F0F]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#334155]">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                placeholder="Jane"
                className="h-10 rounded-xl px-3 text-sm outline-none w-full bg-[#F8F7FF] border border-[#E6E4F5] text-[#0F0F0F]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#334155]">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                placeholder="Doe"
                className="h-10 rounded-xl px-3 text-sm outline-none w-full bg-[#F8F7FF] border border-[#E6E4F5] text-[#0F0F0F]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#334155]">Role & Access</label>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              className="h-10 rounded-xl px-3 text-sm outline-none w-full bg-[#F8F7FF] border border-[#E6E4F5] text-[#0F0F0F]"
            >
              <option value="agent">Agent — view and reply in inbox</option>
              <option value="manager">Manager — manage campaigns, contacts, and inbox</option>
              <option value="tenant_admin">Admin — full access to settings and team</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E6E4F5]">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-xs font-bold text-[#64748B] hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="h-10 px-5 rounded-xl text-xs font-bold text-white bg-[#534AB7] hover:bg-[#433B9B] disabled:opacity-50 transition-colors shadow-sm"
            >
              {sending ? 'Creating…' : 'Create Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuthStore();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await teamApi.list();
      setTeam(res?.data || []);
    } catch (err) {
      showError(err?.message || 'Failed to load team members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleRemove = async (member) => {
    const name = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email;
    if (!window.confirm(`Are you sure you want to remove ${name} from this workspace?`)) return;

    try {
      await teamApi.remove(member.id);
      setTeam((prev) => prev.filter((m) => m.id !== member.id));
      showSuccess(`Removed ${name} from team.`);
    } catch (err) {
      showError(err?.message || 'Failed to remove member.');
    }
  };

  const adminCount = team.filter((m) => m.role === 'tenant_admin' || m.role === 'super_admin').length;
  const managerCount = team.filter((m) => m.role === 'manager').length;
  const agentCount = team.filter((m) => m.role === 'agent' || m.role === 'tenant_user').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F] tracking-tight">Team Management</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Manage your workspace colleagues, roles, and messaging access permissions.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#534AB7] to-[#3B3499] hover:brightness-110 shadow-sm transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Invite Member
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E6E4F5] shadow-xs">
          <p className="text-2xs font-bold uppercase tracking-wider text-[#9494A8]">Total Members</p>
          <p className="text-2xl font-black text-[#0F0F0F] mt-1">{loading ? '…' : team.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[#E6E4F5] shadow-xs">
          <p className="text-2xs font-bold uppercase tracking-wider text-[#9494A8]">Admins</p>
          <p className="text-2xl font-black text-[#534AB7] mt-1">{loading ? '…' : adminCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[#E6E4F5] shadow-xs">
          <p className="text-2xs font-bold uppercase tracking-wider text-[#9494A8]">Managers</p>
          <p className="text-2xl font-black text-[#0284c7] mt-1">{loading ? '…' : managerCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[#E6E4F5] shadow-xs">
          <p className="text-2xs font-bold uppercase tracking-wider text-[#9494A8]">Agents</p>
          <p className="text-2xl font-black text-[#1D9E75] mt-1">{loading ? '…' : agentCount}</p>
        </div>
      </div>

      {/* Team Member List */}
      <div className="rounded-2xl bg-white border border-[#E6E4F5] overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-[#E6E4F5] bg-[#F8F7FF]/60 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#0F0F0F]">Workspace Members</h2>
            <p className="text-xs text-[#64748B]">All registered accounts with access to this tenant workspace</p>
          </div>
          <span className="text-xs font-semibold text-[#534AB7] bg-[#F3F2FD] px-2.5 py-1 rounded-lg">
            {team.length} Active Member{team.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : team.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-[#F3F2FD] text-[#534AB7] flex items-center justify-center mx-auto mb-3 text-xl">
                👥
              </div>
              <p className="text-sm font-bold text-[#0F0F0F]">No team members yet</p>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                Invite team members so they can collaborate on WhatsApp inbox conversations and campaigns.
              </p>
              <button
                onClick={() => setInviteOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#534AB7]"
              >
                Invite First Colleague
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {team.map((member) => {
                const fullName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email;
                const initial = (member.first_name?.[0] || member.email?.[0] || '?').toUpperCase();
                const isMe = member.id === user?.id;

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-[#E6E4F5] bg-[#F8F7FF]/40 hover:bg-[#F8F7FF] transition-all"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#534AB7] text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-xs">
                      {initial}
                    </div>

                    {/* Member Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#0F0F0F] truncate">{fullName}</p>
                        {isMe && (
                          <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-[#E6F7F1] text-[#1D9E75]">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] truncate">{member.email}</p>
                    </div>

                    {/* Role */}
                    <RoleBadge role={member.role} />

                    {/* Joined Date */}
                    <div className="hidden md:block text-right">
                      <p className="text-2xs text-[#9494A8] uppercase tracking-wider">Joined</p>
                      <p className="text-xs font-medium text-[#334155]">{fmtDate(member.created_at)}</p>
                    </div>

                    {/* Action */}
                    {!isMe && (user?.role === 'tenant_admin' || user?.role === 'super_admin') && (
                      <button
                        onClick={() => handleRemove(member)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#DC2626] hover:bg-[#FEE2E2] transition-colors shrink-0"
                        title="Remove member"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvited={(newMember) => {
            setTeam((prev) => [...prev, newMember]);
          }}
        />
      )}
    </div>
  );
}
