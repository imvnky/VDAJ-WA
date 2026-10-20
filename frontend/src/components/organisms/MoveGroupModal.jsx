/**
 * VDAJ Services — MoveGroupModal
 * ────────────────────────────────────────────────────────────
 * Move or Assign selected contacts to an Audience Group
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { contactApi } from '../../lib/api';
import { showSuccess, showError } from '../atoms/Toast/Toast.jsx';

export default function MoveGroupModal({
  isOpen,
  selectedCount = 0,
  selectedIds = [],
  lists = [],
  currentGroupId = '',
  onClose,
  onSuccess,
}) {
  const [targetGroupId, setTargetGroupId] = useState('');
  const [mode, setMode]                   = useState(currentGroupId ? 'move' : 'add'); // 'move' or 'add'
  const [loading, setLoading]             = useState(false);
  const [errorMsg, setErrorMsg]           = useState('');

  if (!isOpen || selectedCount === 0) return null;

  const currentGroupObj = lists.find((l) => l.id === currentGroupId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetGroupId) {
      setErrorMsg('Please select a destination group.');
      return;
    }

    if (mode === 'move' && targetGroupId === currentGroupId) {
      setErrorMsg('Target group must be different from current group to move.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const targetGroupObj = lists.find((l) => l.id === targetGroupId);
      await contactApi.moveGroup(
        selectedIds,
        targetGroupId,
        mode === 'move' ? currentGroupId : undefined,
        mode
      );

      const actionText = mode === 'move' ? 'moved to' : 'added to';
      showSuccess(
        `Successfully ${actionText} "${targetGroupObj?.name || 'group'}" for ${selectedCount} contact(s).`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update contacts group.';
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
              <span>📁</span> {mode === 'move' ? 'Move Contacts to Group' : 'Assign Contacts to Group'}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Targeting <strong className="text-[#534AB7]">{selectedCount}</strong> selected contact{selectedCount > 1 ? 's' : ''}
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

          {/* Action Mode Toggle (if filtered inside a specific group) */}
          {currentGroupId && (
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-2">
                Action Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('move')}
                  className={clsx(
                    'p-3 rounded-xl border text-left transition-all text-xs',
                    mode === 'move'
                      ? 'border-[#534AB7] bg-[#F3F2FD] text-[#534AB7] font-bold shadow-sm'
                      : 'border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>➡️</span> Move
                  </div>
                  <div className="text-2xs text-[#64748B] font-normal mt-1">
                    Remove from "{currentGroupObj?.name || 'current'}" and move to target
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('add')}
                  className={clsx(
                    'p-3 rounded-xl border text-left transition-all text-xs',
                    mode === 'add'
                      ? 'border-[#534AB7] bg-[#F3F2FD] text-[#534AB7] font-bold shadow-sm'
                      : 'border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>➕</span> Add (Keep Both)
                  </div>
                  <div className="text-2xs text-[#64748B] font-normal mt-1">
                    Keep in existing group and also add to target
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Destination Group Dropdown */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Select Destination Group <span className="text-red-500">*</span>
            </label>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              required
              className="w-full h-10 px-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
            >
              <option value="">-- Choose a Group --</option>
              {lists.map((l) => (
                <option
                  key={l.id}
                  value={l.id}
                  disabled={mode === 'move' && l.id === currentGroupId}
                >
                  📁 {l.name} {l.id === currentGroupId ? '(Current Group)' : `(${l.contact_count || 0} members)`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
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
              disabled={loading || !targetGroupId}
              className={clsx(
                'h-9 px-5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2',
                loading || !targetGroupId ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'
              )}
              style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}
            >
              {loading
                ? 'Processing...'
                : mode === 'move'
                ? `Move ${selectedCount} Contact${selectedCount > 1 ? 's' : ''}`
                : `Assign ${selectedCount} Contact${selectedCount > 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
