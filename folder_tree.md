# VDAJ Services — MNC-Style Folder Tree

> WhatsApp Bulk Messaging SaaS Platform  
> Stack: React.js + Node.js/Express + PostgreSQL + Redis (Bull)

---

## Complete Folder Structure

```
vdajservices/                          ← Monorepo root
│
├── backend/                           ← Node.js API Server
│   ├── .env.example                   ← All stage configs (local/demo/prod)
│   ├── .env                           ← (gitignored)
│   ├── .gitignore
│   ├── package.json
│   ├── logs/                          ← Winston daily rotating logs (gitignored)
│   │
│   └── src/
│       ├── server.js                  ← ★ Express app entry + middleware chain
│       │
│       ├── config/
│       │   ├── database.js            ← ★ PostgreSQL pool + withTransaction helper
│       │   └── redis.js               ← ★ ioredis client with retry/TLS
│       │
│       ├── database/
│       │   ├── schema.sql             ← ★ TASK 2: Full PG schema (RBAC, tenants, campaigns)
│       │   ├── migrate.js             ← Runs schema.sql against DB
│       │   └── seed.js                ← Seeds super admin, plans
│       │
│       ├── middleware/
│       │   ├── authMiddleware.js      ← ★ JWT cookie auth + RBAC guard + tenant isolation
│       │   ├── responseHandler.js     ← ★ TASK 3: sendSuccess/globalErrorHandler/catchAsync
│       │   └── validationMiddleware.js← ★ E.164, UUID, XSS sanitize chains
│       │
│       ├── routes/
│       │   ├── authRoutes.js          ← login, logout, me, meta/callback
│       │   ├── tenantRoutes.js        ← SuperAdmin CRUD + TenantAdmin self-service
│       │   ├── campaignRoutes.js      ← CRUD + /launch (Redis enqueue) + /pause
│       │   ├── contactRoutes.js       ← CRUD + lists + opt-out
│       │   ├── templateRoutes.js      ← Template CRUD
│       │   ├── webhookRoutes.js       ← ★ Meta webhook HMAC + status processing
│       │   └── queueRoutes.js         ← ★ Stats + DLQ list + DLQ replay
│       │
│       ├── services/
│       │   ├── metaApiService.js      ← ★ sendWhatsAppMessage + exchangeEmbeddedSignupToken
│       │   ├── campaignService.js     ← Business logic, quota check
│       │   └── tenantService.js       ← Token encryption for meta_system_token
│       │
│       ├── workers/
│       │   └── messageWorker.js       ← ★ TASK 5: Bull queue (chunk/retry/DLQ/shutdown)
│       │
│       └── utils/
│           ├── logger.js              ← ★ Winston + daily rotation
│           ├── AppError.js            ← ★ Custom error class (statusCode + errorCode)
│           └── errorCodes.js          ← ★ ERR_VDAJ_* + ERR_META_* registry
│
│
└── frontend/                          ← React.js SPA
    ├── .env.example
    ├── .env                           ← (gitignored)
    ├── index.html
    ├── package.json
    ├── tailwind.config.js             ← ★ VDAJ brand kit colors, shadows, animations
    ├── postcss.config.js
    ├── vite.config.js
    │
    └── src/
        ├── main.jsx                   ← React root, Toaster, QueryClientProvider
        ├── App.jsx                    ← Router, protected routes
        │
        ├── styles/
        │   └── globals.css            ← ★ Tailwind base + glass-card + gradient-text
        │
        ├── components/
        │   │
        │   ├── atoms/                 ← ★ TASK 4: Smallest reusable units
        │   │   ├── Button/
        │   │   │   └── Button.jsx     ← ★ 6 variants x 6 sizes, loading, icons, ARIA
        │   │   ├── Input/
        │   │   │   └── Input.jsx      ← ★ Input + Textarea + Select, error, password toggle
        │   │   ├── Badge/
        │   │   │   └── Badge.jsx      ← Status badges
        │   │   └── Toast/
        │   │       └── Toast.jsx      ← ★ Glass toast + errorCode display + showApiError
        │   │
        │   ├── molecules/             ← Composed from atoms
        │   │   ├── SearchBar/
        │   │   ├── StatCard/          ← Dashboard metric cards
        │   │   ├── CampaignStatusBar/ ← sent/delivered/failed/DLQ progress
        │   │   ├── ContactListPicker/
        │   │   └── TemplatePicker/
        │   │
        │   ├── organisms/             ← Full feature sections
        │   │   ├── Sidebar/           ← RBAC-aware nav
        │   │   ├── TopBar/            ← User menu, notifications
        │   │   ├── CampaignTable/     ← Smart cards, no CSS tables
        │   │   ├── ContactUploader/   ← CSV drag-drop import
        │   │   ├── MessageComposer/   ← Markdown + variable injection
        │   │   └── MetaOnboardModal/  ← Embedded Signup SDK wrapper
        │   │
        │   └── templates/             ← Page layout wrappers
        │       ├── DashboardLayout/
        │       └── AuthLayout/
        │
        ├── pages/
        │   ├── auth/
        │   │   ├── LoginPage.jsx
        │   │   └── ForgotPasswordPage.jsx
        │   ├── dashboard/
        │   │   └── DashboardPage.jsx
        │   ├── campaigns/
        │   │   ├── CampaignsPage.jsx
        │   │   ├── NewCampaignPage.jsx
        │   │   └── CampaignDetailPage.jsx ← Per-message status, DLQ viewer
        │   ├── contacts/
        │   │   ├── ContactsPage.jsx
        │   │   └── ContactListsPage.jsx
        │   ├── templates/
        │   │   └── TemplatesPage.jsx
        │   ├── onboarding/
        │   │   └── MetaOnboardPage.jsx
        │   └── admin/
        │       ├── TenantsPage.jsx
        │       └── QueueMonitorPage.jsx
        │
        ├── lib/
        │   ├── apiClient.js           ← ★ Axios withCredentials + interceptors
        │   └── queryKeys.js           ← React Query key constants
        │
        ├── hooks/
        │   ├── useAuth.js
        │   ├── useCampaigns.js
        │   ├── useContacts.js
        │   ├── useTemplates.js
        │   └── useQueueStats.js       ← Polling hook for queue health
        │
        ├── store/
        │   └── authStore.js           ← Zustand: user, tenant, role
        │
        └── utils/
            ├── formatters.js          ← UTC→local, phone display, number formatting
            ├── validators.js          ← E.164 client-side check
            └── constants.js           ← Route paths, app constants
```

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth token storage | HTTP-only secure cookie | Prevents XSS token theft |
| Multi-tenancy | `tenant_id` on every table | Row-level isolation, no cross-tenant leaks |
| Message queue | Bull + Redis | Proven at scale, built-in retry/backoff/DLQ |
| Rate limiting | Chunk delay + Meta trickle | Avoids Meta 130429 rate-limit errors |
| Error system | VDAJ error codes | Users can report exact codes to support |
| Time storage | UTC in DB | Displayed as local via `date-fns` + tenant timezone |
| RBAC | DB role + middleware guard | SuperAdmin > TenantAdmin > TenantUser |
| Atomic design | atoms → molecules → organisms | Maximum component reuse at MNC scale |

---

## RBAC Permission Matrix

| Action | SuperAdmin | TenantAdmin | TenantUser |
|---|:---:|:---:|:---:|
| Manage tenants | ✅ | ❌ | ❌ |
| View queue / DLQ | ✅ | ✅ | ❌ |
| Create campaign | ✅ | ✅ | ✅ |
| Launch campaign | ✅ | ✅ | ❌ |
| Manage contacts | ✅ | ✅ | ✅ |
| Create templates | ✅ | ✅ | ✅ |
| Meta onboarding | ✅ | ✅ | ❌ |
| View own data only | ✅ | ✅ | ✅ |

---

## Queue Flow Diagram

```
Campaign Launch
      │
      ▼
Split contacts into chunks (default: 50/chunk)
      │
      ▼
Bull addBulk() — staggered delays (1000ms/chunk)
      │
      ▼
Worker picks up chunk (concurrency: 5)
      │
      ├── For each message (100ms trickle)
      │         │
      │         ▼
      │    Meta Cloud API POST /messages
      │         │
      │    success        failed
      │       │              │
      │    DB: sent      DB: error log
      │                      │
      │               Retry (exp. backoff)
      │               Max 3 attempts
      │                      │
      │               Dead-Letter Queue
      │               (manual replay API)
      │
      ▼
All chunks done → Campaign status = 'completed'
```

---

## Environment Stages

| Variable | Local (Ngrok) | Demo (Render) | Prod (Hostinger) |
|---|---|---|---|
| `NODE_ENV` | `local` | `demo` | `production` |
| `CORS_ORIGIN` | `http://localhost:3000` | `https://demo.vdajservices.com` | `https://vdajservices.com` |
| `DB_SSL` | `false` | `true` | `true` |
| `REDIS_TLS` | `false` | `false` | `true` |
| Cookie `secure` | `false` | `true` | `true` |
| Cookie `sameSite` | `Lax` | `None` | `None` |
