/**
 * VDAJ Services — EditContactModal
 * ────────────────────────────────────────────────────────────
 * Edit existing contact (Name, Email, Tags, Custom Variables)
 */

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { contactApi } from '../../lib/api';
import { showSuccess, showError } from '../atoms/Toast/Toast.jsx';

export default function EditContactModal({
  isOpen,
  contact,
  onClose,
  onUpdated,
  existingTags = [],
  lists = [],
}) {
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [tags, setTags]             = useState([]);
  const [tagInput, setTagInput]     = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');

  useEffect(() => {
    if (contact && isOpen) {
      setFirstName(contact.first_name || '');
      setLastName(contact.last_name || '');
      setEmail(contact.email || '');
      setTags(Array.isArray(contact.tags) ? [...contact.tags] : []);
      setTagInput('');
      const initialGroups = (contact.groups || []).map((g) => g.id);
      setSelectedGroupIds(initialGroups);
      setErrorMsg('');
    }
  }, [contact, isOpen]);

  if (!isOpen || !contact) return null;

  const handleAddTag = (raw) => {
    const clean = String(raw || tagInput).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    if (!clean || tags.includes(clean)) {
      setTagInput('');
      return;
    }
    setTags([...tags, clean]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        firstName: firstName.trim() || null,
        lastName:  lastName.trim() || null,
        email:     email.trim() || null,
        tags:      tags,
        listIds:   selectedGroupIds,
      };

      const res = await contactApi.update(contact.id, payload);
      showSuccess(`Contact ${contact.phone_e164} updated.`);
      if (onUpdated) onUpdated(res.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update contact.';
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
      <div className="w-full max-w-lg bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl shadow-2xl animate-scale-in overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <span>✏️</span> Edit Contact
            </h2>
            <p className="text-xs font-mono text-[#64748B] mt-0.5">
              {contact.phone_e164}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Tags <span className="text-2xs font-normal text-[#64748B]">(Press Enter to add)</span>
            </label>
            <div className="p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl flex items-center flex-wrap gap-1.5 focus-within:border-[#534AB7]">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-[#534AB7]/10 text-[#534AB7] border border-[#534AB7]/20"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-500 text-xs leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={tags.length === 0 ? "Type tag e.g. 'VIP', 'Lead'..." : "Add tag..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput.trim()) handleAddTag(tagInput); }}
                className="flex-1 min-w-[120px] bg-transparent text-xs text-[#0F172A] focus:outline-none placeholder-[#94A3B8]"
              />
            </div>

            {existingTags.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-2xs text-[#64748B]">Quick add:</span>
                {existingTags.slice(0, 6).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleAddTag(t)}
                    disabled={tags.includes(t)}
                    className={clsx(
                      'text-2xs font-medium px-1.5 py-0.5 rounded-md border transition-all',
                      tags.includes(t)
                        ? 'opacity-40 border-transparent bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#534AB7] hover:text-[#534AB7]'
                    )}
                  >
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Groups / List Memberships */}
          {lists.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1.5">
                Audience Groups
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl">
                {lists.map((list) => {
                  const isChecked = selectedGroupIds.includes(list.id);
                  return (
                    <label
                      key={list.id}
                      className={clsx(
                        'flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-all',
                        isChecked
                          ? 'bg-[#F3F2FD] border border-[#534AB7]/30 text-[#534AB7] font-semibold'
                          : 'hover:bg-white text-[#334155]'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGroupIds([...selectedGroupIds, list.id]);
                            } else {
                              setSelectedGroupIds(selectedGroupIds.filter((id) => id !== list.id));
                            }
                          }}
                          className="rounded text-[#534AB7] focus:ring-[#534AB7]"
                        />
                        <span>📁 {list.name}</span>
                      </div>
                      <span className="text-2xs text-[#64748B]">
                        {list.contact_count || 0} contacts
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-9 px-4 text-xs font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={clsx(
              'h-9 px-5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2',
              loading ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'
            )}
            style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}
          >
            {loading ? 'Saving...' : 'Update Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
