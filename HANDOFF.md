# AICTE FDR Portal — Handoff Document

> Last updated: 2026-10-29 · Commit `7e26505` · Branch `main`

---

## 1. Project Overview

**AICTE Security Deposit / FDR Management Portal** — Smart India Hackathon project.

| Item | Value |
|---|---|
| Live URL | https://aicte-fdr-portal.onrender.com/dashboard |
| GitHub | https://github.com/sanjushreeg/aicte-fdr-portal |
| Stack | Next.js 16 App Router · TypeScript · Tailwind CSS · Prisma 5 · SQLite (local) / PostgreSQL (prod) · NextAuth · Recharts · Jest |

---

## 2. Local Development Setup

### Prerequisites
- Node.js ≥ 18
- Git

### First-time setup

```bash
git clone https://github.com/sanjushreeg/aicte-fdr-portal.git
cd aicte-fdr-portal
npm install
```

### Environment files

Create `.env` (loaded by Prisma):
```
DATABASE_URL="file:./prisma/dev.db"
```

Create `.env.local` (loaded by Next.js):
```
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="<any-long-random-string-for-local>"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="<32-char-hex-key-for-local>"
```

> [!IMPORTANT]
> These files are gitignored. Never commit them. Do not use production values.

### Initialise local SQLite database

```bash
# Push schema to local SQLite (non-destructive)
npx prisma db push --schema=prisma/schema.sqlite.prisma

# Seed demo data (has production safety guard — aborts if DATABASE_URL contains postgres/render/supabase/neon/amazonaws)
node prisma/seed.js
```

### Start dev server

```bash
npm run dev
```

Open http://localhost:3000

---

## 3. Demo Accounts (Local Only)

| Role | Email | Password |
|---|---|---|
| ADMIN | admin@aicte.gov.in | Password123 |
| SCRUTINY_OFFICER | scrutiny@aicte.gov.in | Password123 |
| APPROVING_AUTHORITY | approving@aicte.gov.in | Password123 |
| INSTITUTION | institution@nitap.ac.in | Password123 |

> [!NOTE]
> These accounts exist only in the local `prisma/dev.db`. Production Render has separate accounts.

---

## 4. Database Configuration

| Environment | Provider | URL |
|---|---|---|
| Local dev | SQLite | `file:./prisma/dev.db` (via `.env`) |
| Production (Render) | PostgreSQL | Set in Render dashboard as `DATABASE_URL` |

**Two schema files:**
- `prisma/schema.prisma` — PostgreSQL, used in production CI/CD
- `prisma/schema.sqlite.prisma` — SQLite, used for local dev only

> [!CAUTION]
> Never run `npx prisma db push` or `npx prisma migrate reset` without verifying `DATABASE_URL` is pointing to the local SQLite file. The seed script has a guard but raw Prisma commands do not.

---

## 5. Architecture

### Role-Based Access Control

| Role | Scope |
|---|---|
| `INSTITUTION` | Own institution's instruments only (`institutionId` filter enforced server-side) |
| `SCRUTINY_OFFICER` | All institutions — bureau-wide read + verify |
| `APPROVING_AUTHORITY` | All institutions — bureau-wide read + approve releases |
| `ADMIN` | Full access + audit log + system health |

RBAC is enforced in:
- `src/lib/serverAuth.ts` — `requireAuth(req, allowedRoles?)` called in every API route
- `src/middleware.ts` — redirects unauthenticated users; blocks non-ADMIN from `/admin`
- Client pages — `useSession()` + redirect guard

### Key Files

```
src/
  app/
    api/
      dashboard/stats/route.ts       ← Main dashboard data API
      reports/state-exposure/route.ts ← New: state exposure API
      instruments/route.ts            ← Instrument list + filters
      instruments/export/route.ts     ← CSV export
    dashboard/page.tsx                ← Dashboard shell (client)
    instruments/page.tsx              ← Instruments list (client)
    reports/state-exposure/page.tsx   ← New: full state exposure page
  components/
    AppHeader.tsx                     ← Nav + logout (shows "State Exposure" for non-INSTITUTION)
    DashboardCharts.tsx               ← Three Recharts charts
    ImpactMetricsPanel.tsx            ← Impact metrics display
    StatusBadge.tsx                   ← Status colour badges
  lib/
    auth.ts                           ← NextAuth credentials provider (bcryptjs)
    prisma.ts                         ← Extended PrismaClient (AuditLog append-only guard)
    serverAuth.ts                     ← Server-side RBAC helper
    validations.ts                    ← Zod schemas (Role, InstrumentType, InstrumentStatus)
  middleware.ts                       ← Auth + security headers
prisma/
  schema.prisma                       ← Production schema (PostgreSQL)
  schema.sqlite.prisma                ← Local dev schema (SQLite)
  seed.js                             ← Demo data seeder (production-safe guard)
tests/
  encryption.test.ts                  ← Encryption utility tests
  auth_login.test.ts                  ← Auth credential tests
  state_exposure.test.ts              ← State exposure unit tests
  state_exposure_aggregation.test.ts  ← Aggregation logic unit tests
  state_exposure_api.test.ts          ← API route RBAC + response tests
```

---

## 6. Dashboard Charts (Implemented)

All three charts are in `src/components/DashboardCharts.tsx` and fed by `/api/dashboard/stats`.

### Chart 1 — Instruments by Status (horizontal bar)
- All 11 lifecycle statuses shown, zero-filled for absent statuses
- Sorted by count descending
- Each status has a distinct colour (defined in `ALL_STATUSES` in the API route)
- Tooltip shows label + exact count

### Chart 2 — Maturity Timeline by Month (vertical bar)
- Exactly 12 consecutive calendar months starting from the current month
- All months shown even if count = 0
- Tooltip shows: month, instrument count, total value in ₹ Lakhs
- Only instruments with maturityDate in that specific month bucket are counted

### Chart 3 — State-Wise Exposure (horizontal bar)
- Top 10 states by total deposit value (all instruments, all statuses)
- Navy (`#1e3a5f`) bars, saffron (`#f97316`) highlight on hover
- Tooltip shows: state name, ₹ Crores, ₹ rupees (Indian format), instrument count
- Institution role sees own institution's state data only
- "View full report →" link for non-INSTITUTION roles

---

## 7. State Exposure Full Report Page

**URL:** `/reports/state-exposure`  
**Allowed roles:** `SCRUTINY_OFFICER`, `APPROVING_AUTHORITY`, `ADMIN`  
**Institution users:** Redirected to `/dashboard` (403 from API)

### Features
- Summary cards: total exposure (₹ Cr), states, live instruments, top state
- Full horizontal bar chart with limit selector (Top 10 / Top 15 / All)
- Filters: instrument type, status, bank name (contains)
- Table: state | instruments | institutions | ₹ Crores | share % | expiring ≤30d | mismatches
- Click row or bar → navigates to `/instruments?state=<state>`
- Export CSV button (client-side, from current filtered data)
- Indian number formatting (`en-IN`) throughout

### API
`GET /api/reports/state-exposure`

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 10 | Max states to return (max 200) |
| `type` | `FDR` \| `SECURITY_DEPOSIT` | — | Filter by instrument type |
| `status` | live status enum | — | Filter by single status |
| `bank` | string | — | Bank name substring |

Validated with Zod. Returns 401 (unauthenticated) or 403 (INSTITUTION role).

---

## 8. Running Tests

```bash
# All unit tests
npx jest tests/ --no-coverage

# Specific suites
npx jest tests/encryption.test.ts
npx jest tests/auth_login.test.ts
npx jest tests/state_exposure.test.ts
npx jest tests/state_exposure_aggregation.test.ts
npx jest tests/state_exposure_api.test.ts
```

**Current results: 43/43 passing**

---

## 9. CI/CD Checks Before Pushing

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src/ tests/ prisma/
npx jest --no-coverage
npm run build        # production build
```

All four must pass before pushing to `main`.

---

## 10. Production Deployment (Render)

- Push to `main` → Render auto-deploys
- Render environment variables (set in dashboard, never in code):
  - `DATABASE_URL` — PostgreSQL connection string
  - `NEXTAUTH_SECRET` — Production JWT secret
  - `NEXTAUTH_URL` — `https://aicte-fdr-portal.onrender.com`
  - `ENCRYPTION_KEY` — 32-char hex key

> [!WARNING]
> Do not push `.env` or `.env.local`. Do not change production env vars without team consensus. Do not run seed.js against production.

---

## 11. Known Limitations

- **Maturity Timeline**: counts instruments by their `maturityDate` month regardless of status. An instrument marked RELEASED but with a future maturityDate still contributes a count. This matches the original behaviour and the UX requirement to show "what matures when".
- **SQLite `mode: "insensitive"`**: SQLite does not support Prisma's `mode: "insensitive"` for `contains` queries. The state-exposure API omits this flag, so bank-name filtering is case-sensitive on SQLite locally (works correctly on PostgreSQL in production).
- **No RENEWED double-counting guard on dashboard**: The dashboard state chart aggregates all instruments including RENEWED originals. The dedicated `/api/reports/state-exposure` endpoint correctly excludes RELEASED/REJECTED/REPLACED/RENEWED from live exposure totals.
