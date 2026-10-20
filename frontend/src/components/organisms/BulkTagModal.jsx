/**
 * VDAJ Services — BulkTagModal
 * ─────────────────────────────────────────────────────────────
 * Allows users to bulk assign, replace, or remove tags from multiple
 * selected contacts in a single transactional operation.
 */

import React, { useState, useEffect } from 'react';
import { contactApi } from '../../lib/api';
import { showSuccess, showError } from '../atoms/Toast/Toast.jsx';

export default function BulkTagModal({
  isOpen,
  selectedCount = 0,
  selectedIds = [],
  existingTags = [],
  onClose,
  onSuccess,
}) {
  const [tags, setTags] = useState([]);
  const [inputTag, setInputTag] = useState('');
  const [actionMode, setActionMode] = useState('add'); // 'add' | 'replace' | 'remove'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTags([]);
      setInputTag('');
      setActionMode('add');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddTag = (raw) => {
    const clean = String(raw || inputTag)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 30);
    if (!clean || tags.includes(clean)) {
      setInputTag('');
      return;
    }
    setTags([...tags, clean]);
    setInputTag('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(inputTag);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tags.length === 0) {
      setError('Please add at least one tag to apply.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('No contacts selected.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await contactApi.bulkAssignTags(selectedIds, tags, actionMode);
      showSuccess(res?.message || `Tags updated for ${selectedCount} contacts!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update tags in bulk.';
      setError(msg);
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl shadow-2xl animate-scale-in overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF]">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#534AB7]/10 text-[#534AB7] flex items-center justify-center text-sm">
                🏷️
              </span>
              Bulk Assign Tags
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Applying to <span className="font-bold text-[#534AB7]">{selectedCount}</span> selected {selectedCount === 1 ? 'contact' : 'contacts'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
              {error}
            </div>
          )}

          {/* Action Mode Radio */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-2">
              Action Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  actionMode === 'add'
                    ? 'border-[#534AB7] bg-[#F3F2FD] text-[#534AB7] font-bold shadow-xs'
                    : 'border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                }`}
              >
                <input
                  type="radio"
                  name="actionMode"
                  value="add"
                  checked={actionMode === 'add'}
                  onChange={() => setActionMode('add')}
                  className="text-[#534AB7] focus:ring-[#534AB7]"
                />
                <span>Add to existing</span>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  actionMode === 'replace'
                    ? 'border-[#534AB7] bg-[#F3F2FD] text-[#534AB7] font-bold shadow-xs'
                    : 'border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                }`}
              >
                <input
                  type="radio"
                  name="actionMode"
                  value="replace"
                  checked={actionMode === 'replace'}
                  onChange={() => setActionMode('replace')}
                  className="text-[#534AB7] focus:ring-[#534AB7]"
                />
                <span>Replace tags</span>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  actionMode === 'remove'
                    ? 'border-[#E11D48] bg-rose-50 text-[#E11D48] font-bold shadow-xs'
                    : 'border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                }`}
              >
                <input
                  type="radio"
                  name="actionMode"
                  value="remove"
                  checked={actionMode === 'remove'}
                  onChange={() => setActionMode('remove')}
                  className="text-[#E11D48] focus:ring-[#E11D48]"
                />
                <span>Remove tags</span>
              </label>
            </div>
          </div>

          {/* Tag Input Box */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Tags to {actionMode === 'remove' ? 'Remove' : 'Assign'}
              <span className="text-2xs font-normal text-[#64748B] ml-1">(Press Enter or Comma to add)</span>
            </label>
            <div className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl flex items-center flex-wrap gap-1.5 focus-within:border-[#534AB7] focus-within:bg-white transition-all">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    actionMode === 'remove'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-[#534AB7]/10 text-[#534AB7] border-[#534AB7]/20'
                  }`}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-500 text-xs leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={tags.length === 0 ? "Type tag e.g. 'committee', 'active-member'..." : "Add more..."}
                value={inputTag}
                onChange={(e) => setInputTag(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (inputTag.trim()) handleAddTag(inputTag);
                }}
                className="flex-1 min-w-[140px] bg-transparent text-xs text-[#0F172A] focus:outline-none placeholder-[#94A3B8]"
              />
            </div>
          </div>

          {/* Suggestions from existing tags */}
          {existingTags.length > 0 && (
            <div>
              <span className="text-2xs font-semibold text-[#64748B] block mb-1.5">
                Suggested tags from your workspace:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {existingTags
                  .filter((t) => !tags.includes(t))
                  .slice(0, 10)
                  .map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleAddTag(t)}
                      className="text-2xs font-medium px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-[#534AB7] hover:text-[#534AB7] hover:bg-[#F3F2FD] transition-all cursor-pointer"
                    >
                      + {t}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 px-4 text-xs font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || tags.length === 0}
              className={`h-10 px-5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                submitting || tags.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'
              }`}
              style={{
                background:
                  actionMode === 'remove'
                    ? 'linear-gradient(135deg, #E11D48, #BE123C)'
                    : 'linear-gradient(135deg, #534AB7, #3B3499)',
              }}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Applying Tags…
                </>
              ) : (
                `Apply to ${selectedCount} ${selectedCount === 1 ? 'Contact' : 'Contacts'}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
