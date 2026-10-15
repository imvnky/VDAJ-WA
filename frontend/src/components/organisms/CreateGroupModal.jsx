/**
 * VDAJ Services — CreateGroupModal
 * ────────────────────────────────────────────────────────────
 * Create a new Contact List / Group for Campaign Audiences
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { contactApi } from '../../lib/api';
import { showSuccess, showError } from '../atoms/Toast/Toast.jsx';

export default function CreateGroupModal({ isOpen, onClose, onCreated }) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a group name.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await contactApi.createList({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      showSuccess(`Group "${name.trim()}" created successfully.`);
      if (onCreated) onCreated(res.data);
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create group.';
      setErrorMsg(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl shadow-2xl animate-scale-in overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF]">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <span>📁</span> Create Audience Group
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Organize contacts into targeted groups for WhatsApp campaigns
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diwali Mega Blast 2026, VIP Corporate"
              className="w-full h-10 px-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Description <span className="text-2xs font-normal text-[#64748B]">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. In-store high value buyers from Q3"
              className="w-full p-2.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-9 px-4 text-xs font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className={clsx(
                'h-9 px-5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2',
                loading || !name.trim() ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'
              )}
              style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
