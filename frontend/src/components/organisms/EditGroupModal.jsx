/**
 * VDAJ Services — EditGroupModal
 * ────────────────────────────────────────────────────────────
 * Edit an existing Audience Group (Rename, change description, or delete group)
 */

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { contactApi } from '../../lib/api';
import { showSuccess, showError } from '../atoms/Toast/Toast.jsx';

export default function EditGroupModal({ isOpen, group, onClose, onUpdated, onDeleted }) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteContacts, setDeleteContacts] = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  useEffect(() => {
    if (group && isOpen) {
      setName(group.name || '');
      setDescription(group.description || '');
      setShowDeleteConfirm(false);
      setDeleteContacts(false);
      setErrorMsg('');
    }
  }, [group, isOpen]);

  if (!isOpen || !group) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a group name.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await contactApi.updateList(group.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      showSuccess(`Group updated to "${name.trim()}".`);
      if (onUpdated) onUpdated(res.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update group.';
      setErrorMsg(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    setDeleting(true);
    try {
      await contactApi.deleteList(group.id, { deleteContacts });
      showSuccess(`Group "${group.name}" deleted successfully.`);
      if (onDeleted) onDeleted(group.id);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete group.';
      showError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget && !loading && !deleting) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl shadow-2xl animate-scale-in overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF]">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <span>⚙️</span> Edit Audience Group
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Rename group, update details, or remove this group
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading || deleting}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Delete Confirmation View */}
        {showDeleteConfirm ? (
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-xl font-bold">
              🗑️
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Delete "{group.name}"?</h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                By default, deleting this group only removes the group tag. All contacts will remain safe in <strong>All Contacts</strong>.
              </p>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50/50 border border-red-100 cursor-pointer text-xs text-red-900">
              <input
                type="checkbox"
                checked={deleteContacts}
                onChange={(e) => setDeleteContacts(e.target.checked)}
                className="mt-0.5 rounded text-red-600 focus:ring-red-500"
              />
              <span>Also permanently delete all contacts that belong to this group</span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="h-9 px-4 rounded-xl text-xs font-bold text-[#64748B] hover:bg-[#F1F5F9] transition-all"
              >
                Back
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteGroup}
                className="h-9 px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-sm"
              >
                {deleting ? 'Deleting Group...' : 'Confirm Delete Group'}
              </button>
            </div>
          </div>
        ) : (
          /* Normal Edit Form */
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
                placeholder="Group name"
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
                placeholder="Description of this audience group"
                className="w-full p-2.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                🗑️ Delete Group
              </button>

              <div className="flex items-center gap-2">
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
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
