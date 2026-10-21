/**
 * VDAJ Services — ManageTagsModal
 * ────────────────────────────────────────────────────────────
 * Full tag management: list all workspace tags with contact counts,
 * rename tags, merge duplicate case variations (e.g. "internal" into "Internal"),
 * and delete tags across contacts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { contactApi } from '../../lib/api';
import { showSuccess, showError } from '../atoms/Toast/Toast.jsx';

export default function ManageTagsModal({ isOpen, onClose, onUpdated }) {
  const [tagsStats, setTagsStats]       = useState([]);
  const [loading, setLoading]           = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch]             = useState('');
  
  // Inline rename state
  const [editingTag, setEditingTag]     = useState(null); // string (original tag name)
  const [newTagName, setNewTagName]     = useState('');

  // Delete confirm state
  const [deletingTag, setDeletingTag]   = useState(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contactApi.tagsStats({ silent: true });
      setTagsStats(res.data || []);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to load tag statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadStats();
      setEditingTag(null);
      setNewTagName('');
      setDeletingTag(null);
      setSearch('');
    }
  }, [isOpen, loadStats]);

  if (!isOpen) return null;

  // Detect case-variant duplicates (e.g. "internal" and "Internal")
  const caseGroups = {};
  tagsStats.forEach((item) => {
    const lower = item.tag.toLowerCase();
    if (!caseGroups[lower]) caseGroups[lower] = [];
    caseGroups[lower].push(item);
  });

  const duplicateCaseVariants = Object.values(caseGroups).filter((group) => group.length > 1);

  // Handle Quick Merge of case variants
  const handleQuickMerge = async (sourceTag, targetTag) => {
    setActionLoading(true);
    try {
      const res = await contactApi.renameTag(sourceTag, targetTag);
      showSuccess(res.message || `Merged "${sourceTag}" into "${targetTag}".`);
      await loadStats();
      onUpdated?.();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to merge tags.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Rename Submit
  const handleRenameSubmit = async (e) => {
    e?.preventDefault();
    if (!editingTag || !newTagName.trim()) return;
    const cleanNew = newTagName.trim();
    if (cleanNew === editingTag) {
      setEditingTag(null);
      return;
    }

    setActionLoading(true);
    try {
      const res = await contactApi.renameTag(editingTag, cleanNew);
      showSuccess(res.message || `Tag renamed to "${cleanNew}".`);
      setEditingTag(null);
      setNewTagName('');
      await loadStats();
      onUpdated?.();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to rename tag.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Tag
  const handleDeleteSubmit = async (tagToDelete) => {
    setActionLoading(true);
    try {
      const res = await contactApi.deleteTag(tagToDelete);
      showSuccess(res.message || `Tag "${tagToDelete}" deleted.`);
      setDeletingTag(null);
      await loadStats();
      onUpdated?.();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to delete tag.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredStats = tagsStats.filter((t) =>
    t.tag.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !actionLoading) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <span>🏷️</span> Workspace Tags Manager
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Rename, merge case duplicates, or remove tags across all contacts
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={actionLoading}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Quick Merge Banner if duplicate case variants detected */}
          {duplicateCaseVariants.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <h4 className="text-xs font-bold text-amber-900">
                  Case Inconsistency Detected ({duplicateCaseVariants.length})
                </h4>
              </div>
              <p className="text-2xs text-amber-800 leading-relaxed">
                Some tags differ only by uppercase/lowercase letters. Click below to merge them into your preferred casing:
              </p>
              <div className="space-y-1.5 pt-1">
                {duplicateCaseVariants.map((group, idx) => {
                  // Suggest keeping the one with higher count or capitalized
                  const sorted = [...group].sort((a, b) => b.count - a.count);
                  const target = sorted[0];
                  const others = sorted.slice(1);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white/80 border border-amber-200/80 rounded-xl text-xs gap-2"
                    >
                      <div className="truncate">
                        {others.map((o) => (
                          <span key={o.tag} className="font-mono font-bold text-rose-700 mr-1.5 line-through">
                            {o.tag} ({o.count})
                          </span>
                        ))}
                        <span className="text-slate-400">→</span>
                        <span className="font-mono font-bold text-emerald-700 ml-1.5">
                          {target.tag} ({target.count})
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          others.forEach((o) => handleQuickMerge(o.tag, target.tag));
                        }}
                        className="px-2.5 py-1 text-2xs font-bold bg-[#534AB7] hover:bg-[#4339A6] text-white rounded-lg transition-all shrink-0 shadow-xs"
                      >
                        Merge into "{target.tag}"
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search input */}
          {tagsStats.length > 5 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
            </div>
          )}

          {/* Tag List */}
          {loading ? (
            <div className="text-center py-8 text-xs text-[#64748B]">
              <div className="w-5 h-5 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading tags...
            </div>
          ) : filteredStats.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#64748B] bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              {search ? 'No tags match your search query.' : 'No tags found in your workspace.'}
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-2xl overflow-hidden">
              {filteredStats.map((item) => {
                const isEditing = editingTag === item.tag;
                const isDeleting = deletingTag === item.tag;

                return (
                  <div
                    key={item.tag}
                    className="flex items-center justify-between p-3 bg-white hover:bg-[#F8FAFC] transition-colors gap-2"
                  >
                    {/* Tag badge / edit field */}
                    <div className="flex-1 min-w-0 pr-2">
                      {isEditing ? (
                        <form onSubmit={handleRenameSubmit} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            autoFocus
                            placeholder="New tag name..."
                            className="px-2.5 py-1 text-xs border border-[#534AB7] rounded-lg bg-white text-[#0F172A] focus:outline-none font-semibold w-full max-w-[200px]"
                          />
                          <button
                            type="submit"
                            disabled={actionLoading || !newTagName.trim()}
                            className="px-2.5 py-1 text-2xs font-bold bg-[#148059] text-white rounded-lg hover:bg-[#0E6244] transition-colors"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTag(null)}
                            className="px-2 py-1 text-2xs font-bold text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-xs font-bold text-[#534AB7] bg-[#534AB7]/10 px-2.5 py-0.5 rounded-lg border border-[#534AB7]/20 truncate">
                            {item.tag}
                          </span>
                          <span className="text-2xs font-semibold text-[#64748B] shrink-0">
                            {item.count} contact{item.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        {isDeleting ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 px-2 rounded-lg border border-red-200">
                            <span className="text-2xs text-red-700 font-bold">Remove from all contacts?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmit(item.tag)}
                              disabled={actionLoading}
                              className="px-2 py-0.5 text-2xs font-bold bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Yes, Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingTag(null)}
                              className="text-2xs text-slate-500 hover:text-slate-700 px-1 font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Rename / Merge button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTag(item.tag);
                                setNewTagName(item.tag);
                                setDeletingTag(null);
                              }}
                              title="Rename or merge this tag"
                              className="p-1.5 text-xs text-slate-500 hover:text-[#534AB7] hover:bg-[#F3F2FD] rounded-lg transition-colors flex items-center gap-1 font-semibold"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Rename</span>
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingTag(item.tag);
                                setEditingTag(null);
                              }}
                              title="Delete tag from all contacts"
                              className="p-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <span className="text-2xs text-[#64748B]">
            {tagsStats.length} total tag{tagsStats.length !== 1 ? 's' : ''} in workspace
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-[#534AB7] hover:bg-[#4339A6] rounded-xl transition-all shadow-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
