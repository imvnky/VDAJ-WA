/**
 * VDAJ Services — CampaignsPage
 * Campaign list + Composer Modal with live WhatsApp chat preview.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';
import { campaignApi, contactApi, templateApi, mediaApi } from '../lib/api';
import useAuthStore from '../store/authStore';
import { showSuccess, showError, showWarning } from '../components/atoms/Toast/Toast.jsx';
import Button, { PrimaryButton, DangerButton, GhostButton, SecondaryButton } from '../components/atoms/Button/Button.jsx';
import Input, { Select, Textarea } from '../components/atoms/Input/Input.jsx';
import CampaignDetailView from '../components/organisms/CampaignDetailView.jsx';
import { ErrorState, parseApiError } from '../components/atoms/ErrorState/ErrorState.jsx';

// ---- Status Badge ----
const STATUS = {
  draft:     { label: 'Draft',     cls: 'bg-[#F8F7FF] text-[#5A5A6E] border-[#E6E4F5]' },
  scheduled: { label: 'Scheduled', cls: 'bg-[#F3F2FD] text-[#534AB7] border-[#E6E4F5]' },
  running:   { label: 'Running',   cls: 'bg-[#F3F2FD] text-[#534AB7] border-[#AFA9EC]' },
  paused:    { label: 'Paused',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Done',      cls: 'bg-[#E8F9F4] text-[#148059] border-[#A3E4D0]' },
  failed:    { label: 'Failed',    cls: 'bg-red-50 text-red-700 border-red-200' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span className={clsx('inline-flex px-2.5 py-0.5 rounded-full text-2xs font-bold border', s.cls)}>
      {s.label}
    </span>
  );
}

// ---- WhatsApp Message Preview ----
function WhatsAppPreview({ template, variables = {}, headerMediaUrl = '' }) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const { tenant, impersonatedTenant } = useAuthStore();
  const activeTenant = impersonatedTenant || tenant;
  const tenantDisplayName = activeTenant?.name || 'SMR Swimming Pool & Health Club';
  const tenantInitial = (tenantDisplayName[0] || 'S').toUpperCase();

  // Interpolate variables into template body
  const getInterpolatedBody = () => {
    if (!template) {
      return 'Please select a template to preview the message…';
    }
    let body = template.body_text || template.body || '';
    Object.entries(variables).forEach(([key, val]) => {
      if (key.endsWith('_fallback')) return;
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      let displayVal = val != null ? String(val).trim() : '';
      if (displayVal === '{{name}}' || displayVal === '{{contact_name}}' || displayVal === '{{first_name}}') {
        displayVal = 'John Doe';
      } else if (displayVal === '{{phone}}') {
        displayVal = '+91 80077 73138';
      }
      body = body.replace(regex, displayVal ? `*${displayVal}*` : `{{${key}}}`);
    });
    return body;
  };

  const renderText = (raw) => {
    if (!raw) return <span className="text-gray-400 text-xs italic">Select a template to preview…</span>;
    const tokens = raw.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|```[^`]+```)/g);
    return tokens.map((t, idx) => {
      if (t.startsWith('*') && t.endsWith('*')) return <strong key={idx} className="font-semibold text-white">{t.slice(1, -1)}</strong>;
      if (t.startsWith('_') && t.endsWith('_')) return <em key={idx}>{t.slice(1, -1)}</em>;
      if (t.startsWith('~') && t.endsWith('~')) return <s key={idx}>{t.slice(1, -1)}</s>;
      if (t.startsWith('```') && t.endsWith('```')) return <code key={idx} className="font-mono bg-black/20 rounded px-1">{t.slice(3, -3)}</code>;
      return <span key={idx}>{t}</span>;
    });
  };

  const activeMediaUrl = headerMediaUrl || (template?.header_type === 'IMAGE' && template?.header_sample_url ? template.header_sample_url : '');

  return (
    <div className="flex flex-col h-full bg-[#0B141A] rounded-2xl overflow-hidden border border-white/10 shadow-lg">
      {/* WA Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1F2C34] border-b border-white/5">
        <div className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center text-xs font-bold text-white shrink-0">
          {tenantInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">{tenantDisplayName}</p>
          <p className="text-[10px] text-[#00A884]">Official Business Account</p>
        </div>
      </div>

      {/* Chat Area */}
      <div
        className="flex-1 p-3.5 overflow-y-auto min-h-[320px] flex flex-col justify-end"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
      >
        <div className="flex justify-end">
          <div className="max-w-[92%] bg-[#005C4B] rounded-2xl rounded-tr-sm p-3 shadow-md">
            {/* Header Media (Image / Banner / Video / Document) */}
            {activeMediaUrl && (
              <div className="mb-2 rounded-xl overflow-hidden bg-black/30 border border-white/10 max-h-48 flex items-center justify-center">
                <img
                  src={activeMediaUrl}
                  alt="Campaign Header Media"
                  className="w-full h-auto object-cover max-h-48"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
            {!activeMediaUrl && template?.header_type && template?.header_type !== 'NONE' && template?.header_type !== 'TEXT' && (
              <div className="mb-2 p-2.5 bg-[#1F2C34] rounded-xl border border-white/10 flex items-center gap-2 text-white/90">
                <span className="text-xl">
                  {template.header_type === 'IMAGE' ? '🖼️' : template.header_type === 'VIDEO' ? '🎥' : '📄'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase">{template.header_type} Header</p>
                  <p className="text-[9px] text-white/50">Upload your image flyer in the composer</p>
                </div>
              </div>
            )}

            {/* Header Text if any */}
            {template?.header_text && (
              <p className="text-xs font-bold text-white mb-1.5 border-b border-white/10 pb-1">
                {template.header_text}
              </p>
            )}

            {/* Body */}
            <div className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap break-words">
              {renderText(getInterpolatedBody())}
            </div>

            {/* Footer */}
            {template?.footer_text && (
              <p className="text-[10px] text-white/50 mt-2 italic border-t border-white/10 pt-1">
                {template.footer_text}
              </p>
            )}

            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[9px] text-white/40">{time}</span>
              <svg className="w-3 h-3 text-[#53BDEB]" viewBox="0 0 16 11" fill="currentColor">
                <path d="M11.071.653a.45.45 0 0 0-.63 0L4.995 6.099l-2.1-2.1a.45.45 0 0 0-.63.63l2.415 2.414a.45.45 0 0 0 .63 0L11.07 1.29a.45.45 0 0 0 0-.637zM15.05.653a.45.45 0 0 0-.63 0L8.974 6.099l-.6-.6a.45.45 0 0 0-.63.63l.914.914a.45.45 0 0 0 .63 0L15.05 1.29a.45.45 0 0 0 0-.637z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Composer Modal ----
function ComposerModal({ onClose, onCreated, contactLists = [], templates = [] }) {
  const [form, setForm] = useState({
    name: '',
    templateId: '',
    variables: {},
    sendTiming: 'now', // 'now' | 'schedule'
    scheduledAt: '',
    interactive: false,
  });

  // Audience Configuration
  // 'lists': Select 1 or more contact groups (with automatic deduplication)
  // 'tags': Select 1 or more tags (e.g. VIP, Member, Inquiry)
  // 'all': Broadcast to all active tenant contacts
  // 'adhoc_excel': Direct blast from uploaded Excel/CSV (zero contact directory pollution)
  const [audienceType, setAudienceType] = useState('lists');
  const [selectedListIds, setSelectedListIds] = useState(
    contactLists && contactLists.length > 0 ? [contactLists[0].id] : []
  );
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [filterTagsInGroups, setFilterTagsInGroups] = useState([]);
  const [showGroupTagFilter, setShowGroupTagFilter] = useState(false);
  const [audienceCount, setAudienceCount] = useState({ totalContacts: 0, uniqueContacts: 0, duplicates: 0 });
  const [loadingAudienceCount, setLoadingAudienceCount] = useState(false);

  // Fetch available workspace tags on mount
  useEffect(() => {
    let isMounted = true;
    contactApi.tagsStats({ silent: true })
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setAvailableTags(res.data);
          // Default first tag if none selected
          if (res.data.length > 0 && selectedTags.length === 0) {
            setSelectedTags([res.data[0].tag]);
          }
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Adhoc Excel / CSV Direct Blast state
  const [adhocRecipients, setAdhocRecipients] = useState([]);
  const [adhocFileName, setAdhocFileName] = useState('');
  const [parsingAdhoc, setParsingAdhoc] = useState(false);
  const [adhocStats, setAdhocStats] = useState({ total: 0, valid: 0, invalid: 0 });

  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'excel_guide'
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Find currently selected template
  const selectedTemplate = templates.find((t) => t.id === form.templateId);

  // Auto-fill header sample URL if available on template selection
  useEffect(() => {
    if (selectedTemplate?.header_sample_url && !headerMediaUrl) {
      setHeaderMediaUrl(selectedTemplate.header_sample_url);
    }
  }, [selectedTemplate]);

  // Extract variables like {{1}}, {{2}} from template body
  const detectedVariables = React.useMemo(() => {
    if (!selectedTemplate?.body_text) return [];
    const matches = [...selectedTemplate.body_text.matchAll(/\{\{(\w+)\}\}/g)];
    const unique = Array.from(new Set(matches.map((m) => m[1])));
    return unique;
  }, [selectedTemplate]);

  const [varSources, setVarSources] = useState({});
  const [fallbacks, setFallbacks] = useState({});

  // Real-time Audience Count Query with Deduplication & Tag Filtering
  useEffect(() => {
    let isMounted = true;
    if (audienceType === 'adhoc_excel') {
      setAudienceCount({
        totalContacts: adhocRecipients.length,
        uniqueContacts: adhocRecipients.length,
        duplicates: 0,
      });
      return;
    }

    if (audienceType === 'tags') {
      if (!selectedTags || selectedTags.length === 0) {
        setAudienceCount({ totalContacts: 0, uniqueContacts: 0, duplicates: 0 });
        return;
      }
      setLoadingAudienceCount(true);
      campaignApi.getAudienceCount({
        audienceType: 'tags',
        tags: selectedTags,
      })
        .then((res) => {
          if (isMounted && res.data) setAudienceCount(res.data);
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingAudienceCount(false);
        });
      return;
    }

    if (audienceType === 'lists') {
      if (!selectedListIds || selectedListIds.length === 0) {
        setAudienceCount({ totalContacts: 0, uniqueContacts: 0, duplicates: 0 });
        return;
      }
      setLoadingAudienceCount(true);
      campaignApi.getAudienceCount({
        audienceType: 'lists',
        listIds: selectedListIds,
        filterTags: filterTagsInGroups,
      })
        .then((res) => {
          if (isMounted && res.data) setAudienceCount(res.data);
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingAudienceCount(false);
        });
      return;
    }

    // Mode: 'all'
    setLoadingAudienceCount(true);
    campaignApi.getAudienceCount({ audienceType: 'all' })
      .then((res) => {
        if (isMounted && res.data) setAudienceCount(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingAudienceCount(false);
      });

    return () => { isMounted = false; };
  }, [audienceType, selectedListIds, selectedTags, filterTagsInGroups, adhocRecipients.length]);

  const toggleListId = (id) => {
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllLists = () => {
    if (selectedListIds.length === contactLists.length) {
      setSelectedListIds([]);
    } else {
      setSelectedListIds(contactLists.map((l) => l.id));
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleSelectAllTags = () => {
    if (selectedTags.length === availableTags.length) {
      setSelectedTags([]);
    } else {
      setSelectedTags(availableTags.map((t) => t.tag));
    }
  };

  const toggleGroupFilterTag = (tag) => {
    setFilterTagsInGroups((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Direct Blast: Parse Excel (.xlsx, .xls) or CSV (.csv) completely client-side
  // NO contacts table insertion or pollution!
  const handleAdhocFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingAdhoc(true);
    setAdhocFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawJson || rawJson.length < 2) {
          showError('Uploaded file appears to be empty or has no data rows.');
          setParsingAdhoc(false);
          return;
        }

        const headers = rawJson[0].map((h) => String(h || '').trim().toLowerCase());
        const phoneIdx = headers.findIndex((h) => /phone|mobile|cell|contact|number/i.test(h));
        const nameIdx = headers.findIndex((h) => /name|firstname|fullname|customer/i.test(h));

        if (phoneIdx === -1) {
          showError('Could not find a "phone" or "mobile" column header in the file.');
          setParsingAdhoc(false);
          return;
        }

        const validList = [];
        let invalidCount = 0;
        const seenPhones = new Set();

        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || !row.length) continue;
          const rawPhone = String(row[phoneIdx] || '').trim();
          if (!rawPhone) continue;

          // Normalize digits
          const digits = rawPhone.replace(/\D/g, '');
          let cleanPhone = '';
          if (digits.length === 10) {
            cleanPhone = `+91${digits}`;
          } else if (digits.length === 12 && digits.startsWith('91')) {
            cleanPhone = `+${digits}`;
          } else if (rawPhone.startsWith('+') && digits.length >= 7) {
            cleanPhone = `+${digits}`;
          } else if (digits.length >= 7) {
            cleanPhone = `+${digits}`;
          }

          if (!cleanPhone || seenPhones.has(cleanPhone)) {
            if (!cleanPhone) invalidCount++;
            continue;
          }
          seenPhones.add(cleanPhone);

          const recipientName = nameIdx >= 0 && row[nameIdx] ? String(row[nameIdx]).trim() : '';
          const rowVars = {};
          if (recipientName) {
            rowVars['1'] = recipientName;
            rowVars.name = recipientName;
            rowVars.contact_name = recipientName;
          }

          // Map additional variable columns
          headers.forEach((h, colIdx) => {
            if (colIdx !== phoneIdx && colIdx !== nameIdx && row[colIdx] != null) {
              const val = String(row[colIdx]).trim();
              if (val) {
                const varMatch = h.match(/^var(\d+)$/i) || h.match(/^(\d+)$/);
                if (varMatch) {
                  rowVars[varMatch[1]] = val;
                } else {
                  rowVars[h] = val;
                }
              }
            }
          });

          validList.push({
            phone: cleanPhone,
            name: recipientName,
            vars: rowVars,
          });
        }

        setAdhocRecipients(validList);
        setAdhocStats({
          total: rawJson.length - 1,
          valid: validList.length,
          invalid: invalidCount,
        });

        if (validList.length > 0) {
          showSuccess(`Parsed ${validList.length} valid unique recipients! (Will not touch Contacts directory)`);
        } else {
          showError('No valid phone numbers found in file.');
        }
      } catch (err) {
        showError(`Failed to parse file: ${err.message}`);
      } finally {
        setParsingAdhoc(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Download Sample Excel Template
  const handleDownloadSampleTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['phone', 'name', 'var1', 'var2'],
      ['919876543210', 'Rajesh Sharma', 'Rajesh', '15% Discount'],
      ['919864008174', 'Priya Patel', 'Priya', 'Free Consultation'],
      ['919970364001', 'Vikram Joshi', 'Vikram', 'Special VIP Pass'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Direct Blast Sample');
    XLSX.writeFile(wb, 'VDAJ_Direct_Blast_Sample.xlsx');
    showSuccess('Sample Excel template downloaded.');
  };

  // Auto-initialize variable sources and defaults whenever a template with variables is chosen
  useEffect(() => {
    if (detectedVariables.length > 0) {
      setVarSources((prevSources) => {
        const nextSources = { ...prevSources };
        const nextFallbacks = { ...fallbacks };
        const nextVars = { ...form.variables };

        detectedVariables.forEach((vKey, idx) => {
          if (!nextSources[vKey]) {
            nextSources[vKey] = idx === 0 ? 'contact_name' : 'custom';
          }
          if (!nextFallbacks[vKey]) {
            nextFallbacks[vKey] = idx === 0 ? 'Customer' : '-';
          }
          if (!nextVars[vKey]) {
            nextVars[vKey] = nextSources[vKey] === 'contact_name' ? '{{name}}' : '';
          }
        });

        setFallbacks(nextFallbacks);
        setForm((f) => ({ ...f, variables: nextVars }));
        return nextSources;
      });
    }
  }, [detectedVariables]);

  const handleSourceChange = (vKey, source) => {
    setVarSources((prev) => ({ ...prev, [vKey]: source }));
    if (source === 'contact_name') {
      handleVariableChange(vKey, '{{name}}');
      if (!fallbacks[vKey]) setFallbacks((prev) => ({ ...prev, [vKey]: 'Customer' }));
    } else if (source === 'contact_phone') {
      handleVariableChange(vKey, '{{phone}}');
    } else {
      handleVariableChange(vKey, '');
    }
  };

  const handleFallbackChange = (vKey, val) => {
    setFallbacks((prev) => ({ ...prev, [vKey]: val }));
  };

  const handleVariableChange = (varKey, val) => {
    setForm((f) => ({
      ...f,
      variables: { ...f.variables, [varKey]: val },
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showError('Campaign name is required.', 'ERR_VDAJ_VAL_005');
      return;
    }
    if (!form.templateId) {
      showError('Please select an approved WhatsApp template for this campaign.', 'ERR_VDAJ_VAL_006');
      return;
    }

    if (audienceType === 'lists') {
      if (!selectedListIds || selectedListIds.length === 0) {
        showError('Please select at least one contact group for this campaign.', 'ERR_VDAJ_VAL_007');
        return;
      }
    } else if (audienceType === 'tags') {
      if (!selectedTags || selectedTags.length === 0) {
        showError('Please select at least one tag for this campaign.', 'ERR_VDAJ_VAL_007');
        return;
      }
    } else if (audienceType === 'adhoc_excel') {
      if (!adhocRecipients || adhocRecipients.length === 0) {
        showError('Please upload an Excel or CSV file with at least one valid recipient.', 'ERR_VDAJ_VAL_007');
        return;
      }
    }

    setLoading(true);
    try {
      const campaignVariables = { ...form.variables };
      // Ensure every detected template variable has a valid mapping, source, and fallback
      detectedVariables.forEach((vKey, idx) => {
        const source = varSources[vKey] || (idx === 0 ? 'contact_name' : 'custom');
        const fallback = (fallbacks[vKey] || (idx === 0 ? 'Customer' : '-')).trim();

        campaignVariables[`${vKey}_source`] = source;
        campaignVariables[`${vKey}_fallback`] = fallback;

        if (source === 'contact_name') {
          campaignVariables[vKey] = '{{contact_name}}';
        } else if (source === 'contact_phone') {
          campaignVariables[vKey] = '{{contact_phone}}';
        } else {
          campaignVariables[vKey] = (form.variables[vKey] || fallback).trim();
        }
      });

      if (headerMediaUrl) {
        campaignVariables.headerUrl = headerMediaUrl;
        campaignVariables.imageUrl = headerMediaUrl;
        campaignVariables.headerType = selectedTemplate?.header_type || 'IMAGE';
      }

      const payload = {
        name: form.name,
        templateId: form.templateId,
        audienceType,
        contactListId: audienceType === 'lists' ? selectedListIds[0] : undefined,
        contactListIds: audienceType === 'lists' ? selectedListIds : undefined,
        tags: audienceType === 'tags' ? selectedTags : undefined,
        filterTags: audienceType === 'lists' && filterTagsInGroups.length > 0 ? filterTagsInGroups : undefined,
        adhocRecipients: audienceType === 'adhoc_excel' ? adhocRecipients : undefined,
        templateVariables: campaignVariables,
        headerUrl: headerMediaUrl || undefined,
        headerType: selectedTemplate?.header_type || (headerMediaUrl ? 'IMAGE' : undefined),
        scheduledAt: form.sendTiming === 'schedule' && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      };

      const res = await campaignApi.create(payload);

      // If user selected "Send Immediately", launch the campaign directly!
      if (form.sendTiming === 'now' && res.data?.id) {
        try {
          await campaignApi.launch(res.data.id);
          showSuccess('Campaign created and launched successfully!');
        } catch (launchErr) {
          showWarning('Campaign created, but launch could not proceed automatically. You can launch it from the campaign details.');
        }
      } else {
        showSuccess('Campaign created and scheduled successfully!');
      }

      onCreated(res.data);
      onClose();
    } catch {
      // Toast fired by API interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
        {/* ── MODAL HEADER (High Contrast MNC Grade) ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">New WhatsApp Campaign</h2>
            <p className="text-xs text-[#64748B]">Broadcast Meta-approved template messages to your contacts.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Left: Form Controls */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 border-r border-[#E2E8F0]">
            {/* 1. Campaign Details */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                Campaign Details
              </label>
              <Input
                placeholder="e.g. May Enquiry Blast"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>

            {/* 2. Template Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                Message Template *
              </label>
              <Select
                placeholder="— choose an approved template —"
                value={form.templateId}
                onChange={(e) => set('templateId', e.target.value)}
                options={templates.map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.language || 'en'}) — ${t.category || 'marketing'}`,
                }))}
              />

              {/* Template Preview Box if selected */}
              {selectedTemplate ? (
                <div className="mt-3 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#534AB7]">
                      Template Preview
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F7F1] text-[#065F46] border border-[#A7F3D0]">
                      {selectedTemplate.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-[#334155] leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedTemplate.body_text}
                  </p>
                  {selectedTemplate.footer_text && (
                    <p className="text-[11px] text-[#64748B] italic pt-1 border-t border-[#E2E8F0]">
                      Footer: {selectedTemplate.footer_text}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#64748B]">
                  Per WhatsApp Business policies, outbound campaigns must use an approved Meta template.
                </p>
              )}

              {/* Media Header / Banner / Flyer Upload Section */}
              {selectedTemplate && (selectedTemplate.header_type === 'IMAGE' || selectedTemplate.header_type === 'VIDEO' || selectedTemplate.header_type === 'DOCUMENT' || headerMediaUrl) && (
                <div className="mt-3 p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {selectedTemplate.header_type === 'VIDEO' ? '🎥' : selectedTemplate.header_type === 'DOCUMENT' ? '📄' : '🖼️'}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-[#0F172A]">
                          Campaign Header Media ({selectedTemplate.header_type || 'IMAGE'})
                        </h4>
                        <p className="text-[11px] text-[#64748B]">
                          Attach the promotional banner, flyer, or document to be delivered with this broadcast.
                        </p>
                      </div>
                    </div>
                    {headerMediaUrl && (
                      <button
                        type="button"
                        onClick={() => setHeaderMediaUrl('')}
                        className="text-[11px] text-red-600 hover:underline font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <label className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#534AB7] hover:bg-[#433A9D] text-white text-xs font-bold cursor-pointer transition-colors text-center inline-flex items-center justify-center gap-2 shadow-sm shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>{uploadingMedia ? 'Uploading Image...' : 'Choose Flyer / Image'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
                        className="sr-only"
                        disabled={uploadingMedia}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingMedia(true);
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await mediaApi.upload(fd);
                            const url = res.data?.url || res.data?.directUrl;
                            setHeaderMediaUrl(url);
                            showSuccess('Campaign media uploaded successfully!');
                          } catch {
                            // Handled by toast interceptor
                          } finally {
                            setUploadingMedia(false);
                          }
                        }}
                      />
                    </label>

                    <div className="w-full sm:flex-1">
                      <input
                        type="url"
                        placeholder="Or enter public media URL (https://...)"
                        value={headerMediaUrl}
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Thumbnail & Confirmation */}
                  {headerMediaUrl && (
                    <div className="flex items-center gap-3 p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs">
                      <img
                        src={headerMediaUrl}
                        alt="Banner Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-[#E2E8F0] shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] text-[#0F172A] truncate">
                          {headerMediaUrl}
                        </p>
                        <p className="text-[10px] text-[#148059] font-semibold mt-0.5">
                          ✓ Media attached — visible in Live WhatsApp Preview
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Template Variables & Personalization Section (Always Visible) */}
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Variable Mapping & Personalization</span>
                    {selectedTemplate && (
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold',
                          detectedVariables.length > 0
                            ? 'bg-[#EDE9FE] text-[#534AB7]'
                            : 'bg-[#DCFCE7] text-[#166534]'
                        )}
                      >
                        {detectedVariables.length > 0
                          ? `${detectedVariables.length} variable${detectedVariables.length > 1 ? 's' : ''} detected`
                          : 'Static (0 variables)'}
                      </span>
                    )}
                  </h4>
                </div>

                {!selectedTemplate ? (
                  <div className="p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#64748B] flex items-center gap-3">
                    <span className="text-xl shrink-0">✨</span>
                    <div>
                      <p className="font-semibold text-[#1E293B]">No template selected yet</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Choose an approved template above to map dynamic parameters like <code className="text-[#534AB7] bg-white px-1 py-0.5 rounded border border-[#CBD5E1] font-mono">{"{{1}}"}</code>, <code className="text-[#534AB7] bg-white px-1 py-0.5 rounded border border-[#CBD5E1] font-mono">{"{{2}}"}</code> to Contact Name, Phone, or Custom Text with automatic fallbacks.
                      </p>
                    </div>
                  </div>
                ) : detectedVariables.length === 0 ? (
                  <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-xs text-[#166534] flex items-center gap-2">
                    <span className="text-base shrink-0">✓</span>
                    <span><strong>Static Template:</strong> This template message has no variable placeholders. It will be sent exactly as approved by Meta.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] text-[#64748B]">
                      Map each Meta variable to a contact field or enter custom text. If a contact has empty data, the fallback is delivered automatically.
                    </p>

                    <div className="space-y-3">
                      {detectedVariables.map((vKey, idx) => {
                        const source = varSources[vKey] || (idx === 0 ? 'contact_name' : 'custom');
                        const fallback = fallbacks[vKey] || (idx === 0 ? 'Customer' : '-');
                        return (
                          <div key={vKey} className="p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold font-mono text-[#534AB7] bg-white px-2 py-0.5 rounded border border-[#CBD5E1]">
                                {`{{${vKey}}}`}
                              </span>
                              <span className="text-[10px] text-[#64748B] font-semibold">
                                Meta Parameter #{idx + 1}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {/* Source Selection */}
                              <div>
                                <label className="block text-[11px] font-medium text-[#475569] mb-1">
                                  Value Source:
                                </label>
                                <select
                                  value={source}
                                  onChange={(e) => handleSourceChange(vKey, e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:border-[#534AB7] focus:outline-none"
                                >
                                  <option value="contact_name">👤 Contact Name (Personalized)</option>
                                  <option value="contact_phone">📱 Recipient Phone Number</option>
                                  <option value="custom">✍️ Static Custom Text</option>
                                </select>
                              </div>

                              {/* Fallback / Custom Value Input */}
                              <div>
                                {source === 'contact_name' ? (
                                  <>
                                    <label className="block text-[11px] font-medium text-[#475569] mb-1">
                                      Default Fallback <span className="text-gray-400 font-normal">(if name is blank)</span>:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Customer"
                                      value={fallback}
                                      onChange={(e) => handleFallbackChange(vKey, e.target.value)}
                                      className="w-full px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                                    />
                                  </>
                                ) : source === 'contact_phone' ? (
                                  <>
                                    <label className="block text-[11px] font-medium text-[#475569] mb-1">
                                      Recipient Value:
                                    </label>
                                    <div className="px-2.5 py-1.5 text-xs bg-[#F1F5F9] border border-[#CBD5E1] rounded-lg text-[#475569] font-mono truncate">
                                      +91XXXXXXXXXX (From Contact)
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <label className="block text-[11px] font-medium text-[#475569] mb-1">
                                      Custom Text to Send:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder={`Enter text for {{${vKey}}}`}
                                      value={form.variables[vKey] || ''}
                                      onChange={(e) => handleVariableChange(vKey, e.target.value)}
                                      className="w-full px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#E6F7F1] border border-[#A7F3D0] text-[11px] text-[#065F46] flex items-center gap-2">
                      <span>✓</span>
                      <span><strong>Meta Cloud API Protection:</strong> If a contact has empty data, the fallback is delivered automatically to guarantee 0% message drops.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Recipients (Audience Configuration) */}
            <div className="space-y-3 pt-3 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                  Target Audience *
                </label>
                {audienceType === 'lists' && contactLists.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllLists}
                    className="text-[11px] font-bold text-[#534AB7] hover:underline"
                  >
                    {selectedListIds.length === contactLists.length ? 'Deselect All' : 'Select All Groups'}
                  </button>
                )}
                {audienceType === 'tags' && availableTags.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllTags}
                    className="text-[11px] font-bold text-[#534AB7] hover:underline"
                  >
                    {selectedTags.length === availableTags.length ? 'Deselect All' : 'Select All Tags'}
                  </button>
                )}
              </div>

              {/* Audience Mode Segmented Selector (4 Options) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[#F1F5F9] p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAudienceType('lists')}
                  className={clsx(
                    'py-2 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5',
                    audienceType === 'lists'
                      ? 'bg-white text-[#0F172A] shadow-sm font-bold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  )}
                >
                  <span>👥</span>
                  <span className="truncate">Contact Groups</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceType('tags')}
                  className={clsx(
                    'py-2 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5',
                    audienceType === 'tags'
                      ? 'bg-white text-[#0F172A] shadow-sm font-bold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  )}
                >
                  <span>🏷️</span>
                  <span className="truncate">By Tags</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceType('all')}
                  className={clsx(
                    'py-2 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5',
                    audienceType === 'all'
                      ? 'bg-white text-[#0F172A] shadow-sm font-bold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  )}
                >
                  <span>🌐</span>
                  <span className="truncate">All Contacts</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceType('adhoc_excel')}
                  className={clsx(
                    'py-2 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5',
                    audienceType === 'adhoc_excel'
                      ? 'bg-white text-[#0F172A] shadow-sm font-bold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  )}
                >
                  <span>⚡</span>
                  <span className="truncate">Direct Blast (Excel)</span>
                </button>
              </div>

              {/* Mode A: Contact Groups (Multi-Select with deduplication + optional tag filter) */}
              {audienceType === 'lists' && (
                <div className="space-y-3">
                  {contactLists.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      No contact groups found. You can create groups in the Contacts directory or use <strong>Direct Blast</strong> to send from an Excel file immediately.
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 border border-[#E2E8F0] rounded-xl p-2.5 bg-[#F8FAFC]">
                      {contactLists.map((list) => {
                        const isChecked = selectedListIds.includes(list.id);
                        return (
                          <label
                            key={list.id}
                            className={clsx(
                              'flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border',
                              isChecked
                                ? 'bg-white border-[#534AB7]/40 shadow-xs'
                                : 'bg-transparent border-transparent hover:bg-white/60'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleListId(list.id)}
                                className="w-4 h-4 rounded text-[#534AB7] focus:ring-[#534AB7] border-[#CBD5E1]"
                              />
                              <span className="text-xs font-semibold text-[#0F172A] truncate">
                                {list.name}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E2E8F0] text-[#475569] shrink-0">
                              {list.contact_count || 0} contacts
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Optional Filter by Tag within groups */}
                  {availableTags.length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowGroupTagFilter(!showGroupTagFilter)}
                        className="text-[11px] font-semibold text-[#534AB7] hover:underline flex items-center gap-1"
                      >
                        <span>{showGroupTagFilter ? '▾ Hide tag filter' : '▸ Filter selected groups by Tag (optional)'}</span>
                        {filterTagsInGroups.length > 0 && (
                          <span className="px-1.5 py-0.2 bg-[#EDE9FE] text-[#534AB7] rounded-full text-[10px] font-bold">
                            {filterTagsInGroups.length} active
                          </span>
                        )}
                      </button>

                      {showGroupTagFilter && (
                        <div className="mt-2 p-2.5 bg-white border border-[#E2E8F0] rounded-xl space-y-2">
                          <p className="text-[11px] text-[#64748B]">
                            Only include contacts from selected groups who have at least one of these tags:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {availableTags.map((t) => {
                              const active = filterTagsInGroups.includes(t.tag);
                              return (
                                <button
                                  key={t.tag}
                                  type="button"
                                  onClick={() => toggleGroupFilterTag(t.tag)}
                                  className={clsx(
                                    'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5',
                                    active
                                      ? 'bg-[#534AB7] text-white border-[#534AB7]'
                                      : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1] hover:bg-[#F1F5F9]'
                                  )}
                                >
                                  <span>🏷️ {t.tag}</span>
                                  <span className={clsx('text-[10px] px-1 py-0.2 rounded font-bold', active ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475569]')}>
                                    {t.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Real-time Audience Summary Badge */}
                  <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      <div>
                        <div className="font-bold text-[#166534]">
                          {loadingAudienceCount
                            ? 'Calculating deduplicated audience…'
                            : `Total Audience: ${audienceCount.uniqueContacts} unique contacts`}
                        </div>
                        {audienceCount.duplicates > 0 && (
                          <p className="text-[11px] text-[#15803D] mt-0.5">
                            Auto-deduplicated: <strong>{audienceCount.duplicates}</strong> overlapping contact(s) across selected groups removed automatically.
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC] shrink-0">
                      ✓ No Double Messages
                    </span>
                  </div>
                </div>
              )}

              {/* Mode B: Target By Tags */}
              {audienceType === 'tags' && (
                <div className="space-y-3">
                  {availableTags.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                      <p className="font-bold">No Contact Tags Found</p>
                      <p className="text-[11px] leading-relaxed">
                        No tags have been assigned to contacts yet. You can assign tags (such as <em>VIP, Member, Lead, Inquiry</em>) in the <strong>Contacts</strong> directory to target them directly here.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 border border-[#E2E8F0] rounded-xl p-2.5 bg-[#F8FAFC]">
                      {availableTags.map((t) => {
                        const isChecked = selectedTags.includes(t.tag);
                        return (
                          <label
                            key={t.tag}
                            className={clsx(
                              'flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border',
                              isChecked
                                ? 'bg-white border-[#534AB7]/40 shadow-xs'
                                : 'bg-transparent border-transparent hover:bg-white/60'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleTag(t.tag)}
                                className="w-4 h-4 rounded text-[#534AB7] focus:ring-[#534AB7] border-[#CBD5E1]"
                              />
                              <span className="text-xs font-semibold text-[#0F172A] truncate flex items-center gap-1.5">
                                <span className="text-[#534AB7]">🏷️</span>
                                <span>{t.tag}</span>
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#534AB7] shrink-0 border border-[#DDD6FE]">
                              {t.count} contacts
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Real-time Audience Summary Badge for Tags */}
                  <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      <div>
                        <div className="font-bold text-[#166534]">
                          {loadingAudienceCount
                            ? 'Calculating deduplicated tag audience…'
                            : `Total Audience: ${audienceCount.uniqueContacts} unique contacts`}
                        </div>
                        {selectedTags.length > 1 && audienceCount.duplicates > 0 && (
                          <p className="text-[11px] text-[#15803D] mt-0.5">
                            Auto-deduplicated: <strong>{audienceCount.duplicates}</strong> overlapping contact(s) with multiple tags will only receive 1 message.
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC] shrink-0">
                      ✓ No Double Messages
                    </span>
                  </div>
                </div>
              )}

              {/* Mode B: All Workspace Contacts */}
              {audienceType === 'all' && (
                <div className="p-3.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1E40AF] flex items-center gap-1.5">
                      <span>🌐</span> Workspace Broadcast
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] border border-[#93C5FD]">
                      {loadingAudienceCount ? '...' : `${audienceCount.uniqueContacts} Active Contacts`}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#1E3A8A] leading-relaxed">
                    Broadcasts this template to every active phone number currently registered in your workspace without needing separate groups.
                  </p>
                </div>
              )}

              {/* Mode C: Direct Blast from Excel / CSV (Zero Pollution) */}
              {audienceType === 'adhoc_excel' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs flex items-start gap-2.5">
                    <span className="text-base shrink-0">🛡️</span>
                    <div>
                      <p className="font-bold text-[#065F46]">Direct Blast: Zero Contacts Directory Pollution</p>
                      <p className="text-[11px] text-[#047857] leading-relaxed mt-0.5">
                        These numbers are processed directly from your file for this campaign only. They will <strong>NOT</strong> be saved or added to your permanent Contacts directory.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#F8FAFC] border-2 border-dashed border-[#CBD5E1] rounded-xl hover:border-[#534AB7] transition-colors text-center">
                    <label className="cursor-pointer block">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <span className="text-2xl">📊</span>
                        <span className="text-xs font-bold text-[#0F172A]">
                          {adhocFileName ? adhocFileName : 'Choose Excel (.xlsx, .xls) or CSV (.csv)'}
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          {parsingAdhoc ? 'Parsing recipients and variables...' : 'Click to select file or drag here'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleAdhocFileUpload}
                        disabled={parsingAdhoc}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {adhocRecipients.length > 0 && (
                    <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl space-y-2 text-xs shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                          <span className="text-green-600">✓</span> {adhocRecipients.length} Valid Recipients Ready
                        </span>
                        {adhocStats.invalid > 0 && (
                          <span className="text-[10px] text-amber-600 font-semibold">
                            ({adhocStats.invalid} invalid/duplicate skipped)
                          </span>
                        )}
                      </div>
                      <div className="max-h-28 overflow-y-auto border border-[#E2E8F0] rounded-lg">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold sticky top-0">
                            <tr>
                              <th className="p-1.5">Phone</th>
                              <th className="p-1.5">Name</th>
                              <th className="p-1.5">Variables</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            {adhocRecipients.slice(0, 4).map((r, i) => (
                              <tr key={i}>
                                <td className="p-1.5 font-mono text-[10px]">{r.phone}</td>
                                <td className="p-1.5">{r.name || '-'}</td>
                                <td className="p-1.5 font-mono text-[10px] text-[#534AB7]">
                                  {Object.keys(r.vars || {}).length ? JSON.stringify(r.vars) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {adhocRecipients.length > 4 && (
                        <p className="text-[10px] text-[#64748B] text-center italic">
                          + {adhocRecipients.length - 4} more recipients in file
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Interactive Campaign Toggle */}
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#0F172A]">Interactive Campaign</p>
                <p className="text-[11px] text-[#64748B] leading-tight mt-0.5">
                  When enabled, customers who click template buttons trigger an automated bot reply flow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => set('interactive', !form.interactive)}
                className={clsx(
                  'w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5',
                  form.interactive ? 'bg-[#534AB7]' : 'bg-[#CBD5E1]'
                )}
              >
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full bg-white transition-transform shadow-sm',
                    form.interactive ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* 5. When to Send */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                When to Send
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#0F172A]">
                  <input
                    type="radio"
                    name="sendTiming"
                    checked={form.sendTiming === 'now'}
                    onChange={() => set('sendTiming', 'now')}
                    className="text-[#534AB7] focus:ring-[#534AB7]"
                  />
                  <span>Send Immediately</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#0F172A]">
                  <input
                    type="radio"
                    name="sendTiming"
                    checked={form.sendTiming === 'schedule'}
                    onChange={() => set('sendTiming', 'schedule')}
                    className="text-[#534AB7] focus:ring-[#534AB7]"
                  />
                  <span>Schedule for Later</span>
                </label>
              </div>

              {form.sendTiming === 'schedule' && (
                <div className="mt-2">
                  <Input
                    label="Scheduled Date & Time"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => set('scheduledAt', e.target.value)}
                    helperText="Stored in UTC, shown in your local time."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Preview & Excel Format */}
          <div className="w-full lg:w-80 shrink-0 p-5 bg-[#F8FAFC] flex flex-col gap-3">
            {/* Tab switch */}
            <div className="flex items-center bg-[#E2E8F0] p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={clsx(
                  'flex-1 py-1 rounded-md transition-all',
                  activeTab === 'preview' ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                )}
              >
                Live Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('excel_guide')}
                className={clsx(
                  'flex-1 py-1 rounded-md transition-all',
                  activeTab === 'excel_guide' ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                )}
              >
                Excel Format
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'preview' ? (
              <div className="flex-1 flex flex-col">
                <WhatsAppPreview
                  template={selectedTemplate}
                  variables={form.variables}
                  headerMediaUrl={headerMediaUrl}
                />
              </div>
            ) : (
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-3.5 shadow-sm">
                <div>
                  <h4 className="font-bold text-[#0F172A] mb-1">Excel & CSV File Format</h4>
                  <p className="text-[11px] text-[#64748B]">
                    Row 1 must be headers. <code className="text-[#534AB7] font-mono font-bold">phone</code> is required. All other columns are mapped to template variables.
                  </p>
                </div>

                <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-[#F8FAFC] text-[#475569] font-bold border-b border-[#E2E8F0]">
                      <tr>
                        <th className="p-1.5 font-mono">PHONE</th>
                        <th className="p-1.5 font-mono">NAME</th>
                        <th className="p-1.5 font-mono">VAR1</th>
                        <th className="p-1.5 font-mono">VAR2</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
                      <tr>
                        <td className="p-1.5 font-mono text-[10px]">919876543210</td>
                        <td className="p-1.5">Rajesh</td>
                        <td className="p-1.5">Rajesh</td>
                        <td className="p-1.5">15% Off</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-mono text-[10px]">919864008174</td>
                        <td className="p-1.5">Priya</td>
                        <td className="p-1.5">Priya</td>
                        <td className="p-1.5">Free Pass</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[11px] text-[#475569] space-y-1">
                  <p><strong>• Phone formats:</strong> 10-digit Indian (9876543210), with country code (919876543210), or E.164 (+919876543210).</p>
                  <p><strong>• Direct Blast:</strong> Files uploaded in Direct Blast mode are never added to your Contacts Directory.</p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="w-full py-2 px-3 rounded-xl bg-[#534AB7] hover:bg-[#433A9D] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Sample Template (.xlsx)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={handleCreate} loading={loading}>
            {form.sendTiming === 'now' ? 'Launch Campaign' : 'Schedule Campaign'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ---- Main CampaignsPage ----
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || null;
  });

  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, listRes, tmplRes] = await Promise.allSettled([
        campaignApi.list({ limit: 50 }, { silent: true }),
        contactApi.lists({ silent: true }),
        templateApi.list({ silent: true }),
      ]);
      if (campRes.status === 'fulfilled') {
        setCampaigns(campRes.value?.data || []);
        setError(null);
      } else {
        setError(parseApiError(campRes.reason));
      }
      if (listRes.status === 'fulfilled') setContactLists(listRes.value?.data || []);
      if (tmplRes.status === 'fulfilled') setTemplates(tmplRes.value?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setAction = (id, val) => setActionLoading((p) => ({ ...p, [id]: val }));

  const handleLaunch = async (id) => {
    setAction(id, 'launch');
    try {
      await campaignApi.launch(id);
      showSuccess('Campaign launched! Messages are queued.');
      setCampaigns((cs) => cs.map((c) => c.id === id ? { ...c, status: 'running' } : c));
    } catch { } finally {
      setAction(id, null);
    }
  };

  const handlePause = async (id) => {
    setAction(id, 'pause');
    try {
      await campaignApi.pause(id);
      showSuccess('Campaign paused.');
      setCampaigns((cs) => cs.map((c) => c.id === id ? { ...c, status: 'paused' } : c));
    } catch { } finally {
      setAction(id, null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    setAction(id, 'delete');
    try {
      await campaignApi.delete(id);
      showSuccess('Campaign deleted.');
      setCampaigns((cs) => cs.filter((c) => c.id !== id));
    } catch { } finally {
      setAction(id, null);
    }
  };

  const handleRetryFailed = async (id) => {
    setAction(id, 'retry');
    try {
      const res = await campaignApi.retryFailed(id);
      showSuccess(res?.message || 'Retrying failed messages.');
      loadData(true);
    } catch (err) {
      showError(err?.message || 'Failed to retry campaign.');
    } finally {
      setAction(id, null);
    }
  };

  const handleResend = async (id) => {
    if (!confirm('Are you sure you want to resend this campaign to all audience contacts?')) return;
    setAction(id, 'resend');
    try {
      const res = await campaignApi.resend(id);
      showSuccess(res?.message || 'Campaign queued for resend.');
      loadData(true);
    } catch (err) {
      showError(err?.message || 'Failed to resend campaign.');
    } finally {
      setAction(id, null);
    }
  };

  // If a campaign is selected, render the MNC CampaignDetailView
  if (selectedCampaignId) {
    return (
      <div className="w-full animate-fade-in">
        <CampaignDetailView
          campaignId={selectedCampaignId}
          onBack={() => {
            setSelectedCampaignId(null);
            const url = new URL(window.location);
            url.searchParams.delete('id');
            window.history.pushState({}, '', url);
          }}
          onNewCampaign={() => {
            setSelectedCampaignId(null);
            setComposerOpen(true);
          }}
        />
        {/* Composer Modal */}
        {composerOpen && (
          <ComposerModal
            onClose={() => setComposerOpen(false)}
            onCreated={(c) => {
              setCampaigns((cs) => [c, ...cs]);
              setSelectedCampaignId(c.id);
            }}
            contactLists={contactLists}
            templates={templates}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F]">Campaigns</h1>
          <p className="text-sm text-[#5A5A6E] mt-1">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total</p>
        </div>
        <PrimaryButton onClick={() => setComposerOpen(true)} leftIcon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        }>
          New Campaign
        </PrimaryButton>
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-[#E6E4F5]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load campaigns"
          message={error.message}
          httpCode={error.httpCode}
          errorCode={error.errorCode}
          onRetry={load}
        />
      ) : campaigns.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center bg-white border border-[#E6E4F5]">
          <svg className="w-14 h-14 text-[#9494A8]/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-[#5A5A6E] text-sm">No campaigns yet.</p>
          <PrimaryButton className="mt-5" onClick={() => setComposerOpen(true)}>Create your first campaign</PrimaryButton>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => {
            const sentPct  = c.total_count  ? Math.round((c.sent_count       / c.total_count)  * 100) : 0;
            const delPct   = c.sent_count   ? Math.round(((c.delivered_count || 0) / c.sent_count)  * 100) : 0;
            const readPct  = c.sent_count   ? Math.round(((c.read_count      || 0) / c.sent_count)  * 100) : 0;
            const isRunning = c.status === 'running';
            const isDraft   = c.status === 'draft' || c.status === 'scheduled';
            const al = actionLoading[c.id];
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 space-y-4"
              >
                {/* Top Header: Title, Status, Audience & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <button
                      onClick={() => setSelectedCampaignId(c.id)}
                      className="text-base font-bold text-slate-900 hover:text-[#534AB7] transition-colors truncate text-left cursor-pointer flex items-center gap-2"
                    >
                      <span>{c.name}</span>
                    </button>

                    <StatusBadge status={c.status} />

                    {c.contact_list_name && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {c.contact_list_name}
                      </span>
                    )}

                    {c.template_name && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50/70 text-[#534AB7] border border-indigo-100">
                        <svg className="w-3.5 h-3.5 text-[#534AB7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {c.template_name}
                      </span>
                    )}
                  </div>

                  {/* Actions Group */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {isDraft && (
                      <button
                        type="button"
                        disabled={al === 'launch'}
                        onClick={() => handleLaunch(c.id)}
                        className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {al === 'launch' ? 'Launching…' : 'Launch'}
                      </button>
                    )}
                    {isRunning && (
                      <button
                        type="button"
                        disabled={al === 'pause'}
                        onClick={() => handlePause(c.id)}
                        className="h-8 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all inline-flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                      >
                        {al === 'pause' ? 'Pausing…' : 'Pause'}
                      </button>
                    )}
                    {(c.failed_count || 0) > 0 && (
                      <button
                        type="button"
                        disabled={al === 'retry'}
                        onClick={() => handleRetryFailed(c.id)}
                        className="h-8 px-3 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Retry only failed recipients"
                      >
                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {al === 'retry' ? 'Retrying…' : `Retry Failed (${c.failed_count})`}
                      </button>
                    )}
                    {(c.status === 'completed' || c.status === 'failed' || c.status === 'paused') && (
                      <button
                        type="button"
                        disabled={al === 'resend'}
                        onClick={() => handleResend(c.id)}
                        className="h-8 px-3 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Resend to all audience contacts"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {al === 'resend' ? 'Sending…' : 'Resend'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={al === 'delete'}
                      onClick={() => handleDelete(c.id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                      title="Delete Campaign"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Unified Cohesive 5-Metric Enterprise Strip */}
                <div className="bg-[#F8FAFC] border border-slate-200/70 rounded-xl p-3 sm:p-3.5 grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-0 sm:divide-x sm:divide-slate-200/70">
                  {/* Total */}
                  <div className="sm:px-3 sm:first:pl-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Audience</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-bold text-slate-900 tabular-nums">{(c.total_count || 0).toLocaleString()}</span>
                      <span className="text-2xs text-slate-400 font-medium">total</span>
                    </div>
                  </div>

                  {/* Sent */}
                  <div className="sm:px-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Dispatched</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-bold text-slate-900 tabular-nums">{(c.sent_count || 0).toLocaleString()}</span>
                      <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-[#534AB7] border border-indigo-100/70">
                        {sentPct}%
                      </span>
                    </div>
                  </div>

                  {/* Delivered */}
                  <div className="sm:px-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Delivered</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-bold text-emerald-700 tabular-nums">{(c.delivered_count || 0).toLocaleString()}</span>
                      <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-100/70">
                        {delPct}%
                      </span>
                    </div>
                  </div>

                  {/* Read */}
                  <div className="sm:px-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Read</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-bold text-sky-700 tabular-nums">{(c.read_count || 0).toLocaleString()}</span>
                      <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-100/70">
                        {readPct}%
                      </span>
                    </div>
                  </div>

                  {/* Failed */}
                  <div className="sm:px-3">
                    <span className={clsx("text-[10px] font-bold uppercase tracking-wider block", (c.failed_count || 0) > 0 ? "text-rose-600" : "text-slate-500")}>
                      Failed
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className={clsx("text-xl font-bold tabular-nums", (c.failed_count || 0) > 0 ? "text-rose-700" : "text-slate-400")}>
                        {(c.failed_count || 0).toLocaleString()}
                      </span>
                      {(c.failed_count || 0) > 0 && (
                        <span className="text-2xs font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          Action Req
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar + Delivery Dashboard link */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <div className="flex-1 relative h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#534AB7] to-[#3B3499] transition-all"
                        style={{ width: `${Math.min(sentPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                      {sentPct}% dispatched
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedCampaignId(c.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#534AB7] hover:text-[#4338CA] bg-[#F5F3FF] hover:bg-[#ECE8FD] px-3.5 py-1.5 rounded-lg border border-[#DDD9F8] transition-all cursor-pointer shadow-2xs"
                  >
                    <span>View Delivery Dashboard & Recipients</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Composer Modal */}
      {composerOpen && (
        <ComposerModal
          onClose={() => setComposerOpen(false)}
          onCreated={(c) => setCampaigns((cs) => [c, ...cs])}
          contactLists={contactLists}
          templates={templates}
        />
      )}
    </div>
  );
}
