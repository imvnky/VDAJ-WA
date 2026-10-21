/**
 * VDAJ Services — Enterprise Excel & CSV Contact Uploader
 * ────────────────────────────────────────────────────────────
 * High-performance contact importer supporting Microsoft Excel (.xlsx, .xls)
 * and CSV (.csv) formats with:
 *  - Two-sheet Excel template generator (Sheet 1: Instructions & Portal Sync, Sheet 2: Samples)
 *  - Dynamic portal synchronization (embeds active portal groups & tags into template)
 *  - Clear phone number guidelines (10-digit Indian auto-prefix vs. international + format)
 *  - Group & tag mapping with portal auto-resolution
 *  - Automatic multi-sheet detection & sheet selector
 *  - Meta BSP compliance consent logging
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';
import { contactApi } from '../../lib/api';
import { showSuccess, showError, showWarning } from '../atoms/Toast/Toast.jsx';

// ── E.164 Sanitiser ───────────────────────────────────────────
function sanitizeE164(raw) {
  if (raw === undefined || raw === null) return null;
  let p = String(raw).trim();

  // Strip leading/trailing single quotes, double quotes, and tabs
  p = p.replace(/^['"\t]+|['"\t]+$/g, '');

  // Handle Excel scientific notation if exported as number (e.g. 9.19876E+11)
  if (/^[0-9.]+[eE]\+[0-9]+$/.test(p)) {
    try {
      p = BigInt(Math.round(Number(p))).toString();
    } catch {}
  }

  // Strip spaces, dashes, parentheses, dots
  p = p.replace(/[\s\-().]/g, '');

  // Auto-prefix Indian 10-digit mobile numbers (6xxx, 7xxx, 8xxx, 9xxx) with +91
  if (/^[6-9]\d{9}$/.test(p)) {
    p = '+91' + p;
  } else if (!p.startsWith('+')) {
    p = '+' + p;
  }

  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}

// ── Column auto-mapper ────────────────────────────────────────
function detectColumns(headers) {
  const find = (keywords) =>
    headers.findIndex((h) => keywords.some((kw) => h.includes(kw)));

  return {
    phoneIdx:     find(['phone', 'mobile', 'number', 'tel', 'whatsapp', 'contact']),
    firstNameIdx: find(['first', 'fname', 'first_name']),
    lastNameIdx:  find(['last', 'lname', 'last_name', 'surname']),
    nameIdx:      find(['name', 'full_name', 'fullname']),
    groupIdx:     find(['group', 'list', 'group_name', 'list_name', 'audience', 'category']),
    tagsIdx:      find(['tag', 'tags', 'segment', 'label']),
    emailIdx:     find(['email', 'mail']),
  };
}

// ── Shared Row Processor ──────────────────────────────────────
function processRows(rawHeaders, rawRows) {
  const headers = rawHeaders.map((h) =>
    String(h || '').toLowerCase().trim().replace(/[^a-z0-9_]/g, '')
  );
  const col = detectColumns(headers);

  const valid = [];
  const invalid = [];

  rawRows.forEach((rowCols, rowIdx) => {
    if (!rowCols || !Array.isArray(rowCols) || rowCols.every((c) => String(c || '').trim() === '')) {
      return;
    }

    const rawPhone =
      col.phoneIdx >= 0 ? rowCols[col.phoneIdx] :
      col.nameIdx >= 0 ? rowCols[0] : '';

    const phone = sanitizeE164(rawPhone);

    let firstName = col.firstNameIdx >= 0 ? String(rowCols[col.firstNameIdx] || '') : '';
    let lastName  = col.lastNameIdx  >= 0 ? String(rowCols[col.lastNameIdx]  || '') : '';

    if (!firstName && col.nameIdx >= 0) {
      const parts = String(rowCols[col.nameIdx] || '').trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    const email = col.emailIdx >= 0 ? String(rowCols[col.emailIdx] || '') : '';

    // Extract row-level Group if present in sheet
    let rowGroup = '';
    if (col.groupIdx >= 0 && rowCols[col.groupIdx]) {
      rowGroup = String(rowCols[col.groupIdx]).trim();
    }

    // Extract row-level tags if present (comma-separated)
    let rowTags = [];
    if (col.tagsIdx >= 0 && rowCols[col.tagsIdx]) {
      rowTags = String(rowCols[col.tagsIdx])
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const reservedIdx = new Set([
      col.phoneIdx, col.firstNameIdx, col.lastNameIdx, col.nameIdx, col.groupIdx, col.tagsIdx, col.emailIdx,
    ].filter((i) => i >= 0));

    const customVars = {};
    headers.forEach((h, idx) => {
      if (!reservedIdx.has(idx) && rowCols[idx] !== undefined && String(rowCols[idx]).trim() !== '') {
        customVars[h] = String(rowCols[idx]).trim();
      }
    });

    const entry = {
      phoneE164:  phone,
      rawPhone:   String(rawPhone || ''),
      firstName:  firstName.trim(),
      lastName:   lastName.trim(),
      email:      email.trim() || null,
      rowGroup,
      rowTags,
      customVars: Object.keys(customVars).length ? customVars : undefined,
      lineNumber: rowIdx + 2,
    };

    if (phone) {
      valid.push(entry);
    } else {
      invalid.push({ ...entry, reason: 'invalid_e164' });
    }
  });

  return { valid, invalid, headers };
}

// ── PapaParse-style CSV parser ────────────────────────────────
function parseCSVText(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const rawHeaders = parseRow(lines[0]);
  const rawRows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    rawRows.push(parseRow(lines[i]));
  }

  return { headers: rawHeaders, rows: rawRows };
}

function processCSV(text) {
  const { headers, rows } = parseCSVText(text);
  return processRows(headers, rows);
}

// ── Excel Workbook Processor ──────────────────────────────────
function parseExcelWorkbook(workbook, targetSheetName = null) {
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('Workbook contains no sheets.');
  }

  let activeSheet = targetSheetName;
  if (!activeSheet || !sheetNames.includes(activeSheet)) {
    // If a sheet is named contact, data, sample, member, list
    const candidate = sheetNames.find((s) => /contact|data|sample|member|list/i.test(s));
    if (candidate) {
      activeSheet = candidate;
    } else if (
      sheetNames.length > 1 &&
      /instruction|guide|readme|help|info/i.test(sheetNames[0])
    ) {
      // Default to second sheet if Sheet 1 is instructions
      activeSheet = sheetNames[1];
    } else {
      activeSheet = sheetNames[0];
    }
  }

  const worksheet = workbook.Sheets[activeSheet];
  if (!worksheet) {
    throw new Error(`Sheet "${activeSheet}" could not be opened.`);
  }

  const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
  if (!aoa || aoa.length === 0) {
    return { valid: [], invalid: [], headers: [], sheetNames, activeSheet };
  }

  // Scan first 10 rows for header row containing phone/contact/name/mobile
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(10, aoa.length); r++) {
    const rowStr = (aoa[r] || []).map((c) => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('phone') || rowStr.includes('mobile') || rowStr.includes('contact') || rowStr.includes('number')) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = aoa[headerRowIndex] || [];
  const rawRows = aoa.slice(headerRowIndex + 1);

  const { valid, invalid, headers } = processRows(rawHeaders, rawRows);

  return {
    valid,
    invalid,
    headers,
    sheetNames,
    activeSheet,
  };
}

function Pill({ ok, children }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full',
      ok
        ? 'bg-[#E8F9F4] text-[#148059] border border-[#A3E4D0]'
        : 'bg-red-50 text-red-700 border border-red-200'
    )}>
      {ok ? '✓' : '✗'} {children}
    </span>
  );
}

function UploadIcon({ active }) {
  return (
    <div
      className={clsx(
        'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-all duration-200',
        active ? 'bg-[#534AB7] text-white scale-110' : 'bg-[#F3F2FD] text-[#534AB7]'
      )}
    >
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    </div>
  );
}

const OPT_IN_SOURCES = [
  { value: 'manual',          label: 'Offline / verbal consent (store visit, in-person, call)' },
  { value: 'web_form',        label: 'Website opt-in / contact form / portal' },
  { value: 'transactional',   label: 'Purchased product/service (transactional order)' },
  { value: 'inbound_message', label: 'Inbound WhatsApp message from customer' },
  { value: 'import',          label: 'General client database (verified explicit consent)' },
];

export default function CsvContactUploader({ isOpen, onClose, onImported, lists = [], existingTags = [] }) {
  const [step, setStep]                 = useState('drop'); // drop | preview | done
  const [dragging, setDragging]         = useState(false);
  const [filename, setFilename]         = useState('');
  const [valid, setValid]               = useState([]);
  const [invalid, setInvalid]           = useState([]);
  const [detectedHeaders, setDetectedHeaders] = useState([]);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [activeSheet, setActiveSheet]   = useState('');
  const [cachedWorkbook, setCachedWorkbook] = useState(null);
  const [listOption, setListOption]     = useState('existing'); // 'existing' | 'new' | 'none'
  const [selectedList, setSelectedList] = useState('');
  const [newListName, setNewListName]   = useState('');
  const [tagsInput, setTagsInput]       = useState('');
  const [optInSource, setOptInSource]   = useState('manual');
  const [importing, setImporting]       = useState(false);
  const [result, setResult]             = useState(null);
  const inputRef = useRef();

  // Reset state when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setStep('drop');
      setDragging(false);
      setFilename('');
      setValid([]);
      setInvalid([]);
      setDetectedHeaders([]);
      setAvailableSheets([]);
      setActiveSheet('');
      setCachedWorkbook(null);
      setResult(null);
      setImporting(false);
      setListOption(lists.length > 0 ? 'existing' : 'new');
      setSelectedList(lists[0]?.id || '');
      setNewListName('');
      setTagsInput('');
      setOptInSource('manual');
    } else {
      if (lists.length > 0 && !selectedList) {
        setSelectedList(lists[0].id);
      }
    }
  }, [isOpen, lists]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ── Download Two-Sheet Excel Template ───────────────────────
  const handleDownloadExcelTemplate = () => {
    const defaultGroupName = lists[0]?.name || 'SMR Swimming Members';

    // ── Build Section 3 dynamically from actual Portal data ──
    const portalGroupsRows = lists.length > 0
      ? lists.map((l) => [
          "  • Portal Group",
          l.name,
          `${l.contact_count || 0} existing contacts`,
          `Use exact name "${l.name}" in the 'Group' column of Sheet 2`,
        ])
      : [
          [
            "  • Portal Groups",
            "None created yet",
            "Go to Portal → Contacts → Groups",
            "Create groups in the portal first, or type a new group name during upload.",
          ]
        ];

    const portalTagsString = existingTags.length > 0
      ? existingTags.slice(0, 8).join(', ') + (existingTags.length > 8 ? ` (+${existingTags.length - 8} more)` : '')
      : "VIP, Member, Committee, Lead";

    // Sheet 1: Professional, Clear, Easy-to-Understand Instructions
    const instructionsData = [
      ["VDAJ SERVICES — ENTERPRISE WHATSAPP PLATFORM", "", "", ""],
      ["Official Contact Upload & Multi-Sheet Excel Guide (v2.0)", "", "", ""],
      ["Follow these guidelines to prepare your data. Switch to the 'Contacts_Data' tab below to paste your contacts.", "", "", ""],
      ["", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["SECTION 1: PHONE NUMBER RULES (SUPER SIMPLE & CLEAR)", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["Phone Type", "How to Enter in Sheet", "Example to Enter", "What the System Does"],
      [
        "Indian Mobile Numbers (Recommended)",
        "Enter plain 10 digits only",
        "9876543210",
        "Easiest! You DO NOT need to type '+91'. Our platform automatically detects 10-digit Indian numbers and adds '+91' for you.",
      ],
      [
        "International Numbers (Outside India)",
        "Enter full number starting with '+'",
        "+14155552671 (US) or +971501234567 (UAE)",
        "For non-Indian numbers, prefix with '+' followed by the country code and mobile number.",
      ],
      [
        "What to Avoid",
        "Do NOT use spaces, dashes, or brackets",
        "Avoid: 98765-43210, (020) 123456",
        "Always enter digits only. Spaces, dashes, and brackets will be automatically stripped.",
      ],
      ["", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["SECTION 2: GROUPS & TAGS (HOW THEY WORK IN PORTAL & EXCEL)", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["Question / Item", "Recommended Workflow", "How it Works", "Best Practice"],
      [
        "Should Groups be created in Portal first?",
        "YES (Highly Recommended)",
        "Create your Groups in the portal first under 'Contacts → Groups' (e.g. 'SMR Swimming Members').",
        "When you enter that group name in Sheet 2 or select it in the uploader, contacts are organized into that exact group.",
      ],
      [
        "Can I create a New Group during upload?",
        "YES",
        "If you type a new group name in the upload window, the system automatically creates the new group for you.",
        "Use this for one-off campaigns, new member batches, or event participant blasts.",
      ],
      [
        "How do Tags work?",
        "Flexible (Portal or Sheet)",
        "You can enter comma-separated tags in the 'Tags' column (e.g. 'VIP, Morning Batch').",
        "Any new tags entered are automatically saved and registered in your portal for future smart filtering.",
      ],
      ["", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["SECTION 3: YOUR ACTIVE PORTAL GROUPS & TAGS (LIVE SYNCED FROM YOUR ACCOUNT)", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["Item Type", "Name in Your Portal", "Current Status", "How to Use in Sheet 2"],
      ...portalGroupsRows,
      [
        "  • Active Tags",
        portalTagsString,
        "Ready in your portal",
        "Enter any of these tags in the 'Tags' column in Sheet 2 (or enter new tags separated by commas).",
      ],
      ["", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["SECTION 4: COMPLETE FIELD DEFINITIONS (FOR SHEET 2: 'Contacts_Data')", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["Column Name", "Required?", "Sample Value", "Description & WhatsApp Template Mapping"],
      [
        "Phone",
        "YES (Mandatory)",
        "9876543210",
        "Recipient mobile number. Simply enter 10 digits (India) or with '+' (international).",
      ],
      [
        "First Name",
        "Optional",
        "Rajesh",
        "Recipient's first name. Automatically replaces {{1}} in WhatsApp message templates.",
      ],
      [
        "Last Name",
        "Optional",
        "Sharma",
        "Recipient's surname or family name.",
      ],
      [
        "Group",
        "Recommended",
        defaultGroupName,
        "Audience Group name. Enter your portal group name to automatically place contacts into that group.",
      ],
      [
        "Tags",
        "Optional",
        "VIP, Member",
        "Comma-separated tags for segmentation, campaigns, and inbox triage.",
      ],
      [
        "Email",
        "Optional",
        "rajesh.sharma@example.com",
        "Contact email address for omnichannel customer profiles.",
      ],
      [
        "Custom Variables",
        "Optional",
        "City, Membership_No, Due_Date...",
        "Any additional columns in Sheet 2 are automatically stored as custom parameters (e.g. {{2}}, {{3}}).",
      ],
      ["", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["SECTION 5: META WHATSAPP COMPLIANCE (CRITICAL FOR ACCOUNT QUALITY)", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["Compliance Policy", "Status", "Rule Explanation", "Impact of Non-Compliance"],
      [
        "1. Explicit Opt-In Consent",
        "MANDATORY",
        "All contacts must have given explicit consent to receive WhatsApp messages from your business.",
        "Unsolicited messages cause user blocks, resulting in Meta phone number quality score downgrades.",
      ],
      [
        "2. No Purchased / Scraped Lists",
        "STRICTLY PROHIBITED",
        "Never upload cold, scraped, or third-party databases.",
        "Violating Meta WhatsApp Business Platform policies leads to permanent account suspension.",
      ],
      [
        "3. Marketing Opt-Out Statement",
        "MANDATORY",
        "All marketing and promotional templates must contain an opt-out (e.g. 'Reply STOP to unsubscribe').",
        "Meta automatically rejects marketing templates submitted without opt-out instructions.",
      ],
      ["", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["SECTION 6: HOW TO UPLOAD IN 4 EASY STEPS", "", "", ""],
      ["═══════════════════════════════════════════════════════════════════════════════════════════════════════════", "", "", ""],
      ["Step Number", "Action to Take", "Where to Do It", "Notes"],
      ["Step 1", "Switch to the 'Contacts_Data' tab below.", "Bottom sheet tab", "Sheet 2 contains the clean contact table."],
      ["Step 2", "Replace sample rows with your actual contacts.", "Sheet 2 ('Contacts_Data')", "You can paste as many rows as you need (up to 5,000)."],
      ["Step 3", "Save this file (.xlsx) on your computer.", "Excel File → Save", "Keep it in .xlsx or .xls format."],
      ["Step 4", "Upload into VDAJ Portal.", "Portal → Contacts → Import", "Drag & drop this file, select consent, and click Import!"],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    wsInstructions['!cols'] = [
      { wch: 36 },
      { wch: 28 },
      { wch: 38 },
      { wch: 78 },
    ];

    // Sheet 2: Clean Contacts Data with realistic sample values matching user's actual group
    const contactsData = [
      ["Phone", "First Name", "Last Name", "Group", "Tags", "Email", "City", "Membership_No", "Notes"],
      ["9876543210", "Rajesh", "Sharma", defaultGroupName, "VIP, Member", "rajesh.sharma@example.com", "Bengaluru", "MEM-1001", "Life Member"],
      ["9864008174", "Priya", "Patel", defaultGroupName, "Customer, Lead", "priya.patel@example.com", "Mumbai", "MEM-1002", "Annual Member"],
      ["9820012345", "Amit", "Verma", defaultGroupName, "Committee", "amit.v@example.com", "Pune", "MEM-1003", "Governing Body"],
      ["9811098765", "Sunita", "Rao", defaultGroupName, "Member", "sunita.rao@example.com", "Hyderabad", "MEM-1004", "Active Subscriber"],
      ["9741234567", "Vikram", "Joshi", defaultGroupName, "VIP, Executive", "vikram.j@example.com", "Delhi", "MEM-1005", "Delegate"],
    ];

    const wsContacts = XLSX.utils.aoa_to_sheet(contactsData);
    wsContacts['!cols'] = [
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 26 },
      { wch: 22 },
      { wch: 28 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
    XLSX.utils.book_append_sheet(wb, wsContacts, "Contacts_Data");
    XLSX.writeFile(wb, "VDAJ_Contacts_Upload_Template.xlsx");

    showSuccess("Downloaded 2-Sheet Excel template (Sheet 1: Instructions & Portal Sync · Sheet 2: Contacts Data).");
  };

  // ── Download CSV Template (Alternative) ──────────────────────
  const handleDownloadCsvTemplate = () => {
    const defaultGroupName = lists[0]?.name || 'SMR Swimming Members';
    const headers = 'phone,first_name,last_name,group,tags,email,city,membership_no';
    const sample1 = `9876543210,Rajesh,Sharma,"${defaultGroupName}","VIP, Member",rajesh.sharma@example.com,Bengaluru,MEM-1001`;
    const sample2 = `9864008174,Priya,Patel,"${defaultGroupName}","Customer, Lead",priya.patel@example.com,Mumbai,MEM-1002`;
    const csvContent = `${headers}\n${sample1}\n${sample2}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'VDAJ_Contacts_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Sample contacts template downloaded (.csv)');
  };

  // ── File handler for Excel (.xlsx, .xls) and CSV (.csv) ─────
  const handleFile = useCallback((file) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith('.csv');
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

    if (!isCsv && !isExcel) {
      showError('Please upload an Excel file (.xlsx, .xls) or CSV file (.csv).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showError('File size must be under 20 MB.');
      return;
    }

    setFilename(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = new Uint8Array(e.target.result);
          const workbook = XLSX.read(buffer, { type: 'array' });
          setCachedWorkbook(workbook);

          const { valid: v, invalid: inv, headers, sheetNames, activeSheet: sheet } = parseExcelWorkbook(workbook);
          setAvailableSheets(sheetNames);
          setActiveSheet(sheet);
          setDetectedHeaders(headers);
          setValid(v);
          setInvalid(inv);
          setStep('preview');

          // Auto-detect group from sheet if present
          const firstRowGroup = v.find((r) => r.rowGroup)?.rowGroup;
          if (firstRowGroup) {
            const matchingList = lists.find((l) => l.name.toLowerCase() === firstRowGroup.toLowerCase());
            if (matchingList) {
              setListOption('existing');
              setSelectedList(matchingList.id);
            } else {
              setListOption('new');
              setNewListName(firstRowGroup);
            }
          }

          if (inv.length > 0) {
            showWarning(`${inv.length} row${inv.length !== 1 ? 's' : ''} had invalid phone numbers and will be skipped.`);
          }
          if (v.length === 0) {
            showError(`No valid phone numbers found in sheet "${sheet}". Please select another sheet or check phone column.`);
          }
        } catch (err) {
          showError(`Failed to parse Excel file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { valid: v, invalid: inv, headers } = processCSV(e.target.result);
          setAvailableSheets([]);
          setActiveSheet('');
          setCachedWorkbook(null);
          setDetectedHeaders(headers);
          setValid(v);
          setInvalid(inv);
          setStep('preview');

          const firstRowGroup = v.find((r) => r.rowGroup)?.rowGroup;
          if (firstRowGroup) {
            const matchingList = lists.find((l) => l.name.toLowerCase() === firstRowGroup.toLowerCase());
            if (matchingList) {
              setListOption('existing');
              setSelectedList(matchingList.id);
            } else {
              setListOption('new');
              setNewListName(firstRowGroup);
            }
          }

          if (inv.length > 0) {
            showWarning(`${inv.length} row${inv.length !== 1 ? 's' : ''} had invalid phone numbers and will be skipped.`);
          }
          if (v.length === 0) {
            showError('No valid phone numbers found in this CSV file.');
            setStep('drop');
          }
        } catch (err) {
          showError(`Failed to parse CSV file: ${err.message}`);
        }
      };
      reader.readAsText(file);
    }
  }, [lists]);

  // Handle switching active Excel sheet
  const handleSheetChange = (sheetName) => {
    if (!cachedWorkbook) return;
    try {
      const { valid: v, invalid: inv, headers, activeSheet: sheet } = parseExcelWorkbook(cachedWorkbook, sheetName);
      setActiveSheet(sheet);
      setDetectedHeaders(headers);
      setValid(v);
      setInvalid(inv);

      const firstRowGroup = v.find((r) => r.rowGroup)?.rowGroup;
      if (firstRowGroup) {
        const matchingList = lists.find((l) => l.name.toLowerCase() === firstRowGroup.toLowerCase());
        if (matchingList) {
          setListOption('existing');
          setSelectedList(matchingList.id);
        } else {
          setListOption('new');
          setNewListName(firstRowGroup);
        }
      }

      if (v.length === 0) {
        showWarning(`No contacts detected in sheet "${sheetName}".`);
      } else {
        showSuccess(`Loaded ${v.length} contacts from sheet "${sheetName}".`);
      }
    } catch (err) {
      showError(`Error reading sheet: ${err.message}`);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // ── Import Action ───────────────────────────────────────────
  const handleImport = async () => {
    if (!valid.length) return;
    if (!optInSource) {
      showError('Please select how these contacts gave consent.', 'ERR_VDAJ_VAL_001');
      return;
    }

    setImporting(true);
    try {
      const proofText = `Import · source: ${optInSource} · file: ${filename}${activeSheet ? ` [sheet: ${activeSheet}]` : ''}`;
      const targetListId = listOption === 'existing' ? selectedList || undefined : undefined;
      const targetNewList = listOption === 'new' ? newListName.trim() || undefined : undefined;
      const globalTags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

      // Merge global tags with any row-level tags from the Excel/CSV sheet
      const preparedContacts = valid.map((c) => {
        const mergedTags = Array.from(new Set([...globalTags, ...(c.rowTags || [])]));
        return {
          ...c,
          tags: mergedTags.length > 0 ? mergedTags : undefined,
        };
      });

      const res = await contactApi.bulkImport(
        preparedContacts,
        targetListId,
        optInSource,
        proofText,
        globalTags,
        targetNewList
      );

      setResult(res.data);
      setStep('done');
      showSuccess(`Import complete — ${res.data.inserted} new, ${res.data.updated} updated.`);
      onImported?.(res.data);
    } catch {
      // Toast fired by Axios interceptor
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl shadow-2xl animate-scale-in overflow-hidden max-h-[92vh] flex flex-col">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
                Import Contacts from Excel / CSV
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F9F4] text-[#148059] border border-[#A3E4D0]">
                .xlsx · .xls · .csv
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Max 5,000 contacts per upload · 10-digit mobile auto +91 or E.164
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* ── Step 1: Drop & Template ────────────────────────── */}
          {step === 'drop' && (
            <>
              {/* Download Sample Template Banner */}
              <div className="p-4 bg-gradient-to-r from-[#F8FAFC] to-[#F1F5F9] border border-[#CBD5E1] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-lg shrink-0">
                    📊
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-[#0F172A]">Official Excel Template with Instructions</p>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#534AB7] text-white">
                        PORTAL SYNCED
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">
                      <strong>Sheet 1:</strong> Full instructions, plain phone rules, &amp; your portal groups/tags.<br/>
                      <strong>Sheet 2:</strong> Clean sample contacts table ready for your data.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <span>📥</span>
                    <span>Download Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    title="Download plain CSV format"
                    className="px-2.5 py-2 text-xs font-semibold text-[#475569] bg-white hover:bg-slate-100 border border-[#CBD5E1] rounded-xl transition-all"
                  >
                    .CSV
                  </button>
                </div>
              </div>

              {/* Drag and drop area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={clsx(
                  'relative border-2 border-dashed rounded-2xl p-9 text-center cursor-pointer transition-all duration-200',
                  dragging
                    ? 'border-[#534AB7] bg-[#F3F2FD]/50 scale-[1.01]'
                    : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#534AB7]/50 hover:bg-[#F1F5F9]'
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                <UploadIcon active={dragging} />
                <p className="text-sm font-bold text-[#0F172A]">
                  {dragging ? 'Drop your Excel or CSV file here!' : 'Drag & drop your Excel or CSV file here'}
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Supports <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> up to 20 MB
                </p>
              </div>

              {/* Column guide & Phone explanation */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-[#0F172A]">
                    Auto-Detected Columns in Sheet:
                  </p>
                  <span className="text-[10px] text-[#534AB7] font-semibold bg-[#F3F2FD] px-2 py-0.5 rounded-md">
                    Groups &amp; Tags Supported
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['phone *', 'first_name', 'last_name', 'group', 'tags', 'email', 'custom_vars...'].map((c) => (
                    <span
                      key={c}
                      className={clsx(
                        'font-mono text-xs px-2.5 py-1 rounded-lg border',
                        c.endsWith('*')
                          ? 'bg-[#F3F2FD] text-[#534AB7] border-[#E6E4F5] font-bold'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]'
                      )}
                    >
                      {c}
                    </span>
                  ))}
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-[#475569] space-y-1">
                  <p className="font-bold text-[#0F172A]">📱 Phone Number Clarity:</p>
                  <p>
                    • <strong>Indian Numbers:</strong> Simply enter the 10-digit number (e.g. <code className="font-mono font-bold text-[#534AB7]">9876543210</code>). You do <em>not</em> need to type +91.
                  </p>
                  <p>
                    • <strong>International:</strong> Enter with '+' and country code (e.g. <code className="font-mono text-[#534AB7]">+14155552671</code>).
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Preview & Configure ────────────────────── */}
          {step === 'preview' && (
            <>
              {/* Summary Bar */}
              <div className="flex items-center justify-between gap-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex-wrap">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="text-base shrink-0">📄</span>
                  <span className="text-xs font-bold text-[#0F172A] truncate">{filename}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Pill ok>{valid.length} Valid</Pill>
                  {invalid.length > 0 && <Pill ok={false}>{invalid.length} Skipped</Pill>}
                </div>
              </div>

              {/* Multi-Sheet Selector for Excel */}
              {availableSheets.length > 1 && (
                <div className="p-3 bg-[#F3F2FD] border border-[#E6E4F5] rounded-xl flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#534AB7]">📑 Excel Sheet:</span>
                    <span className="text-[11px] text-[#64748B]">Multiple sheets detected in file</span>
                  </div>
                  <select
                    value={activeSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:border-[#534AB7] focus:outline-none"
                  >
                    {availableSheets.map((s) => (
                      <option key={s} value={s}>
                        {s} {s === activeSheet ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Table Preview */}
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[#F1F5F9] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                  <span className="col-span-4">Phone</span>
                  <span className="col-span-3">Name</span>
                  <span className="col-span-3">Group / Tags</span>
                  <span className="col-span-2 text-right">Status</span>
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-[#E2E8F0] text-xs">
                  {valid.slice(0, 5).map((r, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-[#334155]">
                      <span className="col-span-4 font-mono text-[#534AB7] font-semibold truncate">{r.phoneE164}</span>
                      <span className="col-span-3 truncate">{r.firstName || '—'} {r.lastName || ''}</span>
                      <span className="col-span-3 truncate text-[11px] text-[#64748B]">
                        {r.rowGroup ? <span className="font-semibold text-[#534AB7] mr-1">[{r.rowGroup}]</span> : null}
                        {r.rowTags?.length ? r.rowTags.join(', ') : (r.email || '—')}
                      </span>
                      <div className="col-span-2 flex justify-end">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F9F4] text-[#148059]">Valid</span>
                      </div>
                    </div>
                  ))}
                  {invalid.slice(0, 2).map((r, i) => (
                    <div key={`inv-${i}`} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-red-50/50 text-[#64748B]">
                      <span className="col-span-4 font-mono text-red-500 line-through truncate">{r.rawPhone || '(empty)'}</span>
                      <span className="col-span-3 truncate">{r.firstName || '—'}</span>
                      <span className="col-span-3 truncate text-[11px] text-red-600">Invalid phone format</span>
                      <div className="col-span-2 flex justify-end">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Skipped</span>
                      </div>
                    </div>
                  ))}
                </div>

                {valid.length > 5 && (
                  <div className="px-3 py-1.5 bg-[#F8FAFC] border-t border-[#E2E8F0] text-center text-[11px] text-[#64748B]">
                    +{valid.length - 5} more valid contacts in this batch
                  </div>
                )}
              </div>

              {/* ── Groups / Contact Lists (MNC Standard) ────── */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#0F172A]">
                    Audience Group / Contact List
                  </label>
                  <span className="text-[11px] text-[#64748B]">
                    Groups allow targeted campaigns &amp; segmentation
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {lists.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="listOption"
                        checked={listOption === 'existing'}
                        onChange={() => setListOption('existing')}
                        className="text-[#534AB7] focus:ring-[#534AB7]"
                      />
                      <span className="font-semibold text-[#0F172A]">Add to Existing Portal Group</span>
                    </label>
                  )}

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="listOption"
                      checked={listOption === 'new'}
                      onChange={() => setListOption('new')}
                      className="text-[#534AB7] focus:ring-[#534AB7]"
                    />
                    <span className="font-semibold text-[#0F172A]">Create New Group</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="listOption"
                      checked={listOption === 'none'}
                      onChange={() => setListOption('none')}
                      className="text-[#534AB7] focus:ring-[#534AB7]"
                    />
                    <span className="text-[#64748B]">No Group (Save to All Contacts)</span>
                  </label>
                </div>

                {listOption === 'existing' && lists.length > 0 && (
                  <select
                    value={selectedList}
                    onChange={(e) => setSelectedList(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] focus:border-[#534AB7] focus:outline-none font-semibold"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.contact_count || 0} contacts)
                      </option>
                    ))}
                  </select>
                )}

                {listOption === 'new' && (
                  <input
                    type="text"
                    placeholder="e.g. VIP Customer Blast 2026"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                  />
                )}
              </div>

              {/* ── Tags / Segment Assignment ────────────────── */}
              <div className="space-y-1 pt-2 border-t border-[#E2E8F0]">
                <label className="block text-xs font-bold text-[#0F172A]">
                  Assign Extra Tags (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP, Customer, Lead, Store Visit (comma separated)"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                />
                <p className="text-[11px] text-[#64748B]">
                  Tags enable fast audience filtering, smart segment campaigns, and inbox triage. Any row tags from your sheet are preserved automatically.
                </p>
              </div>

              {/* ── Consent / Opt-In Source (Required) ────────── */}
              <div className="space-y-1 pt-2 border-t border-[#E2E8F0]">
                <label className="block text-xs font-bold text-[#0F172A]">
                  How did these contacts give consent? <span className="text-[#E11D48]">*</span>
                </label>
                <select
                  value={optInSource}
                  onChange={(e) => setOptInSource(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] focus:border-[#534AB7] focus:outline-none font-semibold"
                >
                  {OPT_IN_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B]">
                  Required by Meta WhatsApp Business policies to maintain high phone number quality.
                </p>
              </div>
            </>
          )}

          {/* ── Step 3: Done ──────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#E8F9F4] text-[#148059] flex items-center justify-center text-3xl shadow-sm">
                ✓
              </div>
              <div>
                <h3 className="text-lg font-black text-[#0F172A]">Contacts Imported Successfully</h3>
                <p className="text-xs text-[#64748B] mt-1">
                  Your contacts have been processed and saved to your workspace.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full max-w-sm mt-2">
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                  <p className="text-xl font-black text-[#148059]">{result.inserted}</p>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mt-0.5">New Contacts</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                  <p className="text-xl font-black text-[#534AB7]">{result.updated}</p>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mt-0.5">Updated</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                  <p className="text-xl font-black text-red-600">{result.invalidCount}</p>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mt-0.5">Skipped</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          {step === 'drop' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('drop')}
                className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || valid.length === 0}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#534AB7] hover:bg-[#4339A6] rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Import {valid.length.toLocaleString()} Contacts</span>
                )}
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#534AB7] hover:bg-[#4339A6] rounded-xl transition-all shadow-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
