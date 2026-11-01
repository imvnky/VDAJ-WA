'use strict';

const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  PageNumber,
  NumberFormat,
  ImageRun
} = require('docx');

async function buildDocx() {
  const logoPath = path.resolve(__dirname, '../../vdaj_logo.png');
  const logoBuffer = fs.readFileSync(logoPath);

  // Common styling constants
  const PRIMARY_COLOR = '1E293B'; // Slate 800
  const BRAND_PURPLE  = '534AB7'; // VDAJ Purple
  const TEAL_ACCENT   = '0D9488'; // Teal 600
  const GRAY_LIGHT    = 'F1F5F9'; // Slate 100
  const GRAY_BORDER   = 'CBD5E1'; // Slate 300
  const TEXT_MUTED    = '64748B'; // Slate 500
  const CODE_BG       = 'F8FAFC'; // Slate 50

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: GRAY_BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: GRAY_BORDER },
    left: { style: BorderStyle.SINGLE, size: 1, color: GRAY_BORDER },
    right: { style: BorderStyle.SINGLE, size: 1, color: GRAY_BORDER },
  };

  const noBorder = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
  };

  const createHeading = (text, level = HeadingLevel.HEADING_1) => {
    return new Paragraph({
      heading: level,
      spacing: { before: 280, after: 140 },
      children: [
        new TextRun({
          text,
          bold: true,
          font: 'Arial',
          size: level === HeadingLevel.HEADING_1 ? 28 : level === HeadingLevel.HEADING_2 ? 24 : 20,
          color: BRAND_PURPLE,
        }),
      ],
    });
  };

  const createParagraph = (text, options = {}) => {
    return new Paragraph({
      spacing: { before: 80, after: 100 },
      alignment: options.alignment || AlignmentType.LEFT,
      children: [
        new TextRun({
          text,
          font: 'Arial',
          size: options.size || 20,
          bold: options.bold || false,
          color: options.color || PRIMARY_COLOR,
          italics: options.italics || false,
        }),
      ],
    });
  };

  const createCodeBlock = (codeLines) => {
    return codeLines.map((line, idx) => {
      return new Paragraph({
        spacing: { before: idx === 0 ? 100 : 0, after: idx === codeLines.length - 1 ? 120 : 0 },
        shading: { type: ShadingType.CLEAR, fill: CODE_BG },
        indent: { left: 200, right: 200 },
        children: [
          new TextRun({
            text: line,
            font: 'Consolas',
            size: 18,
            color: '0F172A',
          }),
        ],
      });
    });
  };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1000,
              right: 1000,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: BRAND_PURPLE },
                  top: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: noBorder,
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            children: [
                              new ImageRun({
                                data: logoBuffer,
                                transformation: { width: 140, height: 42 },
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        borders: noBorder,
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: 'VDAJ SERVICES LLP — API INTEGRATION GUIDE',
                                bold: true,
                                font: 'Arial',
                                size: 16,
                                color: BRAND_PURPLE,
                              }),
                              new TextRun({
                                text: '\nConfidential & Dedicated Client Specification',
                                font: 'Arial',
                                size: 14,
                                color: TEXT_MUTED,
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: GRAY_BORDER },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: noBorder,
                        width: { size: 70, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: 'VDAJ Services LLP | Enterprise WhatsApp Cloud Solution | info@vdajservices.com',
                                font: 'Arial',
                                size: 14,
                                color: TEXT_MUTED,
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        borders: noBorder,
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: 'Page ',
                                font: 'Arial',
                                size: 14,
                                color: TEXT_MUTED,
                              }),
                              new TextRun({
                                children: [PageNumber.CURRENT],
                                font: 'Arial',
                                size: 14,
                                color: TEXT_MUTED,
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ── TITLE BLOCK ───────────────────────────────────────
          new Paragraph({
            spacing: { before: 200, after: 100 },
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: 'WHATSAPP API INTEGRATION SPECIFICATION',
                bold: true,
                font: 'Arial',
                size: 36,
                color: PRIMARY_COLOR,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 240 },
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: 'Automated Booking Confirmations, Real-Time Guest Directory & 2-Way Live Reception Inbox',
                font: 'Arial',
                size: 22,
                color: BRAND_PURPLE,
                bold: true,
              }),
            ],
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    children: [createParagraph('Client Workspace:', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    children: [createParagraph('SMR Swimming Pool & Health Club (Latur)')],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    children: [createParagraph('Integration Method:', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    children: [createParagraph('VDAJ Portal API Gateway (Secure & Managed)')],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    children: [createParagraph('API Version & Format:', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    children: [createParagraph('v1.0 (REST JSON, HTTPS Bearer Auth)')],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    children: [createParagraph('Target Systems:', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    children: [createParagraph('SMR Web Booking System, Mobile App & POS System')],
                  }),
                ],
              }),
            ],
          }),

          // ── SECTION 1: ARCHITECTURE OVERVIEW ──────────────────
          createHeading('1. Executive Summary & Why Portal API Gateway?'),
          createParagraph(
            'Instead of connecting your booking software directly to Meta Cloud API, the integration communicates through the dedicated VDAJ Services Portal API. This architecture provides four major strategic advantages for SMR Swimming Pool & Health Club:'
          ),
          createParagraph('• Automatic Contact Directory: Every booking guest is automatically recorded and maintained in SMR’s customer directory with their name, phone number, and "Booking" tag.'),
          createParagraph('• Shared Live Reception Inbox: Every booking confirmation initiates an active conversation thread in SMR’s portal inbox. If a guest texts back ("Can I reschedule?" or "Location?"), reception sees the alert live and can chat back directly.'),
          createParagraph('• Real-Time Delivery Tracking: Tracks exact message delivery stages (Sent, Delivered, Read with double blue ticks) on SMR’s operational dashboard.'),
          createParagraph('• 100% Security & Isolation: Your system communicates over an isolated channel strictly tied to SMR’s account. Master Meta credentials and billing methods remain safely shielded.'),

          // ── SECTION 2: AUTHENTICATION & SECURITY ──────────────
          createHeading('2. Authentication & Tenant Security'),
          createParagraph(
            'All requests must include a Bearer Token in the HTTP Authorization header. This token is cryptographically signed and locked solely to SMR Swimming Pool & Health Club (Tenant ID: a7120be1-a140-45fe-9772-4ed69e7d778e).'
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [createParagraph('Header Key', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [createParagraph('Header Value', { bold: true })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorder,
                    children: [createParagraph('Authorization', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    children: [createParagraph('Bearer <SMR_PORTAL_TOKEN>')],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorder,
                    children: [createParagraph('Content-Type', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    children: [createParagraph('application/json')],
                  }),
                ],
              }),
            ],
          }),

          createParagraph('\n🔑 SMR Dedicated Bearer Token (Pre-Generated, Valid for 1 Year):', { bold: true, color: BRAND_PURPLE }),
          ...createCodeBlock([
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYTNkZjI0MC1mYjUzLTRiODItODBiMS00MzVhM2ViNmRmYWQiLCJlbWFpbCI6ImFkbWluQHNtcnN3aW1taW5nLmNvbSIsInJvbGUiOiJ0ZW5hbnRfYWRtaW4iLCJ0ZW5hbnRJZCI6ImE3MTIwYmUxLWExNDAtNDVmZS05NzcyLTRlZDY5ZTdkNzc4ZSIsImlhdCI6MTc5MzUzNjkwMywiZXhwIjoxODI1MDcyOTAzfQ.sa5Ie52Ee86ZLPaf5OxojEBcop8A8S7VK9zgBr_UqF4'
          ]),

          // ── SECTION 3: ENDPOINT SPECIFICATION ─────────────────
          createHeading('3. API Endpoint Specification'),
          createParagraph('To trigger a WhatsApp template confirmation, send a POST request to:'),
          ...createCodeBlock([
            'POST https://api.vdajservices.com/api/v1/inbox/send-template'
          ]),
          createParagraph('\nRequest Parameters (JSON Body):', { bold: true }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    children: [createParagraph('Field', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    children: [createParagraph('Type', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    children: [createParagraph('Required', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [createParagraph('Description & Notes', { bold: true })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [createParagraph('to', { bold: true })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('string')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Yes', { bold: true, color: 'DC2626' })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Recipient phone with country code (e.g. 919876543210 for India). No + or spaces.')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [createParagraph('customerName', { bold: true })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('string')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Yes', { bold: true, color: 'DC2626' })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Full guest name. Automatically adds/updates contact in SMR directory.')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [createParagraph('templateName', { bold: true })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('string')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Yes', { bold: true, color: 'DC2626' })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('The Meta approved template name (e.g. smr_booking_confirmed).')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [createParagraph('languageCode', { bold: true })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('string')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Yes', { bold: true, color: 'DC2626' })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Template language code (e.g. en_US or en).')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [createParagraph('parameters', { bold: true })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('object / array')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Yes', { bold: true, color: 'DC2626' })] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Variables mapping to {{1}}, {{2}}, {{3}}, etc. in template body.')] }),
                ],
              }),
            ],
          }),

          createParagraph('\nSample JSON Payload:', { bold: true }),
          ...createCodeBlock([
            '{',
            '  "to": "919876543210",',
            '  "customerName": "Rahul Sharma",',
            '  "templateName": "smr_booking_confirmed",',
            '  "languageCode": "en_US",',
            '  "parameters": {',
            '    "1": "Rahul Sharma",',
            '    "2": "Pool Pass (Morning Slot)",',
            '    "3": "02-Nov-2026",',
            '    "4": "BK-8921"',
            '  }',
            '}'
          ]),

          // ── SECTION 4: RESPONSE & STATUS CODES ────────────────
          createHeading('4. Response Schema & Status Codes'),
          createParagraph('Success Response (HTTP 200 OK):', { bold: true }),
          ...createCodeBlock([
            '{',
            '  "success": true,',
            '  "message": "Template message sent and recorded successfully.",',
            '  "data": {',
            '    "messageId": "wamid.HBgNNzk5OTg5Mzg0NlU...",',
            '    "conversationId": "7f8b91a2-3e4b-4c5d-6e7f-8a9b0c1d2e3f",',
            '    "contactId": "c4983021-3e4b-4f81-a981-bcde12345678",',
            '    "status": "sent"',
            '  }',
            '}'
          ]),

          createParagraph('\nError Status Codes & Handling:', { bold: true }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    children: [createParagraph('HTTP Status', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [createParagraph('Error Code', { bold: true })],
                  }),
                  new TableCell({
                    borders: cellBorder,
                    shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [createParagraph('Remedy / Meaning', { bold: true })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [createParagraph('400 Bad Request')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('ERR_VDAJ_VAL_001')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Missing required field (e.g. "to" or "templateName").')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [createParagraph('401 Unauthorized')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('ERR_VDAJ_AUTH_003')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Invalid or expired Bearer Token.')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [createParagraph('404 Not Found')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('ERR_VDAJ_AUTH_005')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('Workspace account could not be found.')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [createParagraph('409 Conflict')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('ERR_META_NOT_CONNECTED')] }),
                  new TableCell({ borders: cellBorder, children: [createParagraph('WhatsApp number is not configured in portal settings.')] }),
                ],
              }),
            ],
          }),

          // ── SECTION 5: IMPLEMENTATION CODE SAMPLES ────────────
          createHeading('5. Developer Integration Code Samples'),

          createParagraph('PHP (Core PHP, Laravel, WordPress):', { bold: true }),
          ...createCodeBlock([
            '<?php',
            '$payload = [',
            '    "to"           => "919876543210",',
            '    "customerName" => "Rahul Sharma",',
            '    "templateName" => "smr_booking_confirmed",',
            '    "languageCode" => "en_US",',
            '    "parameters"   => [',
            '        "1" => "Rahul Sharma",',
            '        "2" => "Swimming Slot",',
            '        "3" => "02-Nov-2026",',
            '        "4" => "BK-8921"',
            '    ]',
            '];',
            '',
            '$ch = curl_init("https://api.vdajservices.com/api/v1/inbox/send-template");',
            'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
            'curl_setopt($ch, CURLOPT_POST, true);',
            'curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));',
            'curl_setopt($ch, CURLOPT_HTTPHEADER, [',
            '    "Authorization: Bearer <SMR_PORTAL_TOKEN>",',
            '    "Content-Type: application/json"',
            ']);',
            '',
            '$response = curl_exec($ch);',
            'curl_close($ch);',
            '?>'
          ]),

          createParagraph('\nJavaScript / Node.js (Fetch / Axios):', { bold: true }),
          ...createCodeBlock([
            'const response = await fetch("https://api.vdajservices.com/api/v1/inbox/send-template", {',
            '  method: "POST",',
            '  headers: {',
            '    "Authorization": "Bearer <SMR_PORTAL_TOKEN>",',
            '    "Content-Type": "application/json"',
            '  },',
            '  body: JSON.stringify({',
            '    to: "919876543210",',
            '    customerName: "Rahul Sharma",',
            '    templateName: "smr_booking_confirmed",',
            '    languageCode: "en_US",',
            '    parameters: {',
            '      "1": "Rahul Sharma",',
            '      "2": "Swimming Slot",',
            '      "3": "02-Nov-2026",',
            '      "4": "BK-8921"',
            '    }',
            '  })',
            '});',
            'const result = await response.json();',
            'console.log(result);'
          ]),

          createParagraph('\nPython (Requests):', { bold: true }),
          ...createCodeBlock([
            'import requests',
            '',
            'url = "https://api.vdajservices.com/api/v1/inbox/send-template"',
            'headers = {',
            '    "Authorization": "Bearer <SMR_PORTAL_TOKEN>",',
            '    "Content-Type": "application/json"',
            '}',
            'payload = {',
            '    "to": "919876543210",',
            '    "customerName": "Rahul Sharma",',
            '    "templateName": "smr_booking_confirmed",',
            '    "languageCode": "en_US",',
            '    "parameters": {',
            '        "1": "Rahul Sharma",',
            '        "2": "Swimming Slot",',
            '        "3": "02-Nov-2026",',
            '        "4": "BK-8921"',
            '    }',
            '}',
            'response = requests.post(url, json=payload, headers=headers)',
            'print(response.json())'
          ]),

          // ── SECTION 6: TECHNICAL SUPPORT ─────────────────────
          createHeading('6. Technical Support & SLA'),
          createParagraph(
            'For integration queries, test payload verification, or adding new approved templates to SMR’s portal account, please contact our technical integration team:'
          ),
          createParagraph('• Integration Lead: Venkatesh Joshi (VDAJ Services LLP)'),
          createParagraph('• Corporate Email: info@vdajservices.com / support@vdajservices.com'),
          createParagraph('• Live Portal URL: https://wa.vdajservices.com'),
        ],
      },
    ],
  });

  const outputPath = path.resolve(__dirname, '../../VDAJ_Services_SMR_WhatsApp_API_Documentation.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`\n🎉 SUCCESS! Professional Word document generated at:\n${outputPath}\n`);
}

buildDocx().catch((err) => {
  console.error('Error generating docx:', err);
  process.exit(1);
});
