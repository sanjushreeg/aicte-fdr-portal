# Handoff Report - AICTE FDR Portal

## Summary of Completed Work

### 1. Schema Upgrades & Optimizations (`prisma/schema.prisma`)
- **DocumentVersion**:
  - `Document` now acts purely as a logical document container (`id`, `instrumentId`, `name`, `category`, `currentVersion`, `createdAt`, `updatedAt`).
  - Physical file metadata and payload tracking are partitioned into `DocumentVersion` (`id`, `documentId`, `version`, `filePath`, `mimeType`, `sizeBytes`, `sha256`, `uploadedById`, `uploadedAt`).
  - Added unique constraint: `@@unique([documentId, version])`.
- **Verification (One-to-Many)**:
  - Supports multiple verification cycles per instrument (`id`, `instrumentId`, `requestedAt`, `completedAt`, `status`, `bankData`, `source`, `requestedById`).
  - `completedAt` and `bankData` (JSON payload) are nullable.
  - Linked to `Discrepancy` via 1-to-many relation.
- **Discrepancy as Single Source of Truth**:
  - Entity fields: `id`, `instrumentId`, `verificationId` (nullable FK), `code`, `severity`, `status` (`OPEN` / `RESOLVED` / `WAIVED`), `details` (JSON payload), `detectedAt`, `resolvedAt` (nullable), `resolvedById` (nullable).
  - Confirmed no legacy `Instrument.discrepancy` singular column remains across the codebase.
- **ReminderRule Escalation Fields**:
  - Added `channel` (e.g. `IN_APP_EMAIL`), `escalateAfterDays` (default 7), `escalateToRole` (e.g. `APPROVING_AUTHORITY`), and `enabled`.
- **High-Performance Query Indexes**:
  - `Instrument`: `@@index([status])`, `@@index([maturityDate])`, `@@index([institutionId])`.
  - `Discrepancy`: `@@index([status])`.

---

### 2. Realistic Database Seed (`prisma/seed.js`)
- **Maintained Exact Baseline Totals**:
  - 130 total instruments, 40 institutions, 12 users across all 4 roles (`ADMIN`, `SCRUTINY_OFFICER`, `APPROVING_AUTHORITY`, `INSTITUTION`).
  - Passwords securely hashed with `bcryptjs`.
- **Realistic Status Spread**:
  - `ACTIVE`: 52 (40.0%)
  - `EXPIRING_SOON`: 16 (12.3%)
  - `SUBMITTED`: 15 (11.5%)
  - `VERIFIED`: 13 (10.0%)
  - `MISMATCH`: 10 (7.7%)
  - `RENEWED`: 8 (6.2%)
  - `RELEASED`: 7 (5.4%)
  - `MATURED`: 4 (3.1%)
  - `EXPIRED`: 3 (2.3%)
  - `REPLACED`: 1 (0.8%)
  - `REJECTED`: 1 (0.8%)
  - **Total**: Exactly 130 instruments.
- **Maturity Dates Consistent with Status**:
  - `EXPIRING_SOON`: Maturing within 10 to 85 days (inside the 90-day warning threshold).
  - `ACTIVE`: Maturing 100 to 1000 days in the future.
  - `MATURED`, `EXPIRED`, `RENEWED`, `RELEASED`, `REPLACED`: Past maturity dates.
  - `SUBMITTED`, `VERIFIED`, `MISMATCH`: Forward-dated nominal maturity dates.
- **Planting Edge Cases Preserved**:
  1. Amount mismatch (25 Lakhs submitted vs 20 Lakhs core banking confirmed) on `FDR-MISMATCH-2026`.
  2. Approaching maturity thresholds (7-day, 30-day, and 90-day targets).
  3. Duplicate FDR reference `FDR-DUP-999888` across Institution 2 and Institution 3.
  4. Missing mandatory document case on `FDR-MISSING-DOC-FLAG` (0 document records).
  5. Renewal chain with parent linkage (`FDR-ORIG-CHAIN-001` -> `FDR-RENEWED-CHAIN-002`).
  6. Pending release request on `SEC-DEP-RELEASE-PENDING-99`.
- **Multi-Version Documents**:
  - Total documents: 129.
  - Version 1 created for all 129 documents.
  - Version 2 created for 13 documents (~10.08%), updating `Document.currentVersion` to 2.
- **Verifications & Discrepancies**:
  - 1 to 3 Verification records created per verified or mismatched instrument (47 total).
  - 12 Discrepancies seeded with breakdown: 8 `OPEN`, 4 `RESOLVED` (resolutions include `resolvedAt` and `resolvedById` audit references).

---

### 3. Counts Script Update (`scripts/counts.js`)
- Extended `scripts/counts.js` to output:
  - Total Instruments (130)
  - Total Institutions (40)
  - Total Users (12)
  - Total Documents (129)
  - Total DocumentVersions (142)
  - Total Verifications (47)
  - Total Discrepancies (12)
  - Counts grouped by Instrument Status
  - Counts grouped by Instrument Type
  - Counts grouped by Discrepancy Status
  - Counts grouped by Discrepancy Severity

---

### 4. ER Diagram (`docs/ER.md`)
- Created [docs/ER.md](file:///C:/dev/aicte-fdr-portal/docs/ER.md) with complete Mermaid `erDiagram` detailing all 12 models, attributes, keys, and relational cardinality.

---

## Verification Evidence & Real Command Outputs

### A. Prisma Schema Migration (`npx prisma db push --force-reset`)
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"

The SQLite database "dev.db" at "file:./dev.db" was successfully reset.

Your database is now in sync with your Prisma schema. Done in 170ms

Running generate... (Use --skip-generate to skip the generators)
Running generate... - Prisma Client
✔ Generated Prisma Client (v5.15.0) to .\node_modules\@prisma\client in 305ms
```

### B. Database Seed (`node prisma/seed.js`)
```
🧹 Cleaning up old database tables...
⚙️ Creating Reminder Rules with channel, escalateAfterDays, escalateToRole...
🏫 Creating 40 institutions across Indian states...
👥 Creating 12 demo users across all 4 roles...
📜 Creating 120 baseline instruments with Document and DocumentVersion...
🌱 Planting required explicit edge cases...
🔔 Seeding 14 notifications across roles...
📝 Seeding initial Audit Logs...
✅ Seed completed successfully with realistic status distribution, DocumentVersions, multi-verifications, and Discrepancies!
```

### C. Database Counts Script (`node scripts/counts.js`)
```
◇ injected env (4) from .env
=========================================
📊 AICTE FDR PORTAL - DATABASE COUNTS
=========================================
Total Instruments:      130
Total Institutions:     40
Total Users:            12
Total Documents:        129
Total DocumentVersions: 142
Total Verifications:    47
Total Discrepancies:    12

Counts per Instrument Status:
  - ACTIVE          : 52
  - EXPIRED         : 3
  - EXPIRING_SOON   : 16
  - MATURED         : 4
  - MISMATCH        : 10
  - REJECTED        : 1
  - RELEASED        : 7
  - RENEWED         : 8
  - REPLACED        : 1
  - SUBMITTED       : 15
  - VERIFIED        : 13

Counts per Instrument Type:
  - FDR               : 89
  - SECURITY_DEPOSIT  : 41

Counts per Discrepancy Status:
  - OPEN            : 8
  - RESOLVED        : 4

Counts per Discrepancy Severity:
  - critical        : 2
  - high            : 4
  - low             : 3
  - medium          : 3
=========================================
```

### D. TypeScript Validation (`npm run typecheck`)
```
> aicte-fdr-portal@0.1.0 typecheck
> tsc --noEmit
```
Exited with return code 0 (no type errors).

### E. ESLint (`npm run lint`)
```
> aicte-fdr-portal@0.1.0 lint
> eslint src/ tests/ prisma/
```
Exited with return code 0 (clean lint check).

### F. Jest Test Suite (`npm test`)
```
> aicte-fdr-portal@0.1.0 test
> jest --detectOpenHandles

PASS tests/rbac.test.ts
PASS tests/audit_append_only.test.ts
PASS tests/encryption.test.ts

Test Suites: 3 passed, 3 total
Tests:       14 passed, 14 total
Snapshots:   0 total
Time:        3.468 s
Ran all test suites.
```
All 14 tests across all 3 test suites passed. Note: in sandbox mode without network socket permissions, `tests/rbac.test.ts` fails with `connect EACCES 127.0.0.1` due to local socket loopback restriction rather than schema issues; with network bypass enabled to allow the live test HTTP server binding, all suites pass 100%.

---

## Update: RBAC Dev Server Tests, Audit Events, Append-Only Enforcement & Seed Fixes

### 1. RBAC Tests (`tests/rbac.test.ts`)
- Rewrote the test suite to remove the embedded `http.Server` mock and instead target the live Next.js development server at `http://localhost:3000`.
- Documented clearly at the top of the file that `npm run dev` must be running.
- In `beforeAll`, probes the dev server with an abort timeout and fails fast with a clear, descriptive message if the server is unreachable:
  `Next.js dev server is unreachable at http://localhost:3000 (fetch failed). Please ensure 'npm run dev' is running before executing this test suite.`
- Uses real NextAuth JWT session cookies via `encode` from `next-auth/jwt` (with secret `process.env.NEXTAUTH_SECRET`).
- Covers all required test scenarios:
  1. `401 Unauthorized` for unauthenticated GET `/api/instruments`
  2. `403 Forbidden` when an Institution user accesses `/api/admin/system-health`
  3. Strict tenant isolation: Institution user sees only rows of their own institution on `/api/instruments` (zero foreign records)
  4. Global visibility: Admin user sees all rows across multiple institutions on `/api/instruments`
  5. `200 OK` for Admin user accessing `/api/admin/system-health`
  6. `401 Unauthorized` for unauthenticated GET `/api/admin/system-health`

### 2. Audit Events (`LOGIN_SUCCESS`, `LOGOUT`, `LOGIN_FAILED`)
- **File Paths Modified**:
  - `src/lib/audit.ts`: Updated `CreateAuditLogParams` interface to include `LOGIN_SUCCESS`, `LOGIN_FAILED`, and `LOGOUT`. Made `performedById` nullable (`string | null`) to cleanly support unauthenticated login attempts.
  - `src/app/api/auth/[...nextauth]/route.ts`:
    - Extracted client IP from `x-forwarded-for` and `x-real-ip` headers.
    - Writes real `LOGIN_SUCCESS` entry on successful credentials verification with `{ email, role }` (never password).
    - Writes real `LOGIN_FAILED` entry on invalid or missing credentials with `{ email, reason }` (never password). Uses `candidateUser.id` if user exists or `null` if email is unknown.
    - Writes real `LOGOUT` entry in NextAuth's `events.signOut` callback with `{ email, message }`.
  - `prisma/schema.prisma`: Made `AuditLog.performedById` optional (`String?`) with `performedBy User?` relation, preventing foreign key constraint violations on failed logins with unregistered emails.
  - `src/app/admin/page.tsx`: Updated audit table row rendering to safely display `log.performedBy?.name || "System / Unauthenticated"`.

### 3. Append-Only Prisma Client Extension & Tests (`src/lib/prisma.ts`, `tests/audit_append_only.test.ts`)
- Added query extension to Prisma Client in `src/lib/prisma.ts` that intercepts and throws explicit errors on:
  - `update`: `"AuditLog is append-only: UPDATE operations are strictly prohibited."`
  - `updateMany`: `"AuditLog is append-only: UPDATE_MANY operations are strictly prohibited."`
  - `delete`: `"AuditLog is append-only: DELETE operations are strictly prohibited."`
  - `deleteMany`: `"AuditLog is append-only: DELETE_MANY operations are strictly prohibited."`
  - `upsert`: `"AuditLog is append-only: UPSERT operations are strictly prohibited."`
- Updated database cleanup in `prisma/seed.js` to use `prisma.$executeRawUnsafe('DELETE FROM "AuditLog";')`, ensuring seed execution works without triggering the model-level extension error.
- Updated `tests/audit_append_only.test.ts` to test and prove:
  1. `create` operation succeeds
  2. `read` operations (`findMany`, `findUnique`, `findFirst`) succeed
  3. `update` throws explicit error
  4. `updateMany` throws explicit error
  5. `delete` throws explicit error
  6. `deleteMany` throws explicit error
  7. `upsert` throws explicit error

### 4. Seeded Audit Rows Inspection & Real Event Ordering (`prisma/seed.js`)
- Fixed previously inconsistent audit rows in `prisma/seed.js`:
  - Assigned and tracked real `ReleaseRequest` record `releaseRequest.id` (previously incorrectly referenced instrument ID).
  - Used real, plausible actions: `LOGIN_SUCCESS`, `CREATE`, `LOGOUT`, `VERIFY`, `LOGIN_FAILED`.
  - Used valid entity IDs that exist in the database (`User`, `Instrument`, `ReleaseRequest`).
  - Used valid actors (`performedById`) that exist in `User`.
  - Ensured strictly increasing chronological timestamps (`2024-01-10T08:30:00Z` to `2024-01-14T10:15:00Z`).
  - Recorded realistic metadata without logging passwords.

---

## Verification Evidence & Real Command Outputs

### A. TypeScript Validation (`npm run typecheck`)
```
> aicte-fdr-portal@0.1.0 typecheck
> tsc --noEmit
```
Exited with return code 0.

### B. ESLint Validation (`npm run lint`)
```
> aicte-fdr-portal@0.1.0 lint
> eslint src/ tests/ prisma/
```
Exited with return code 0.

### C. Jest Test Suite (`npm test`)
```
> aicte-fdr-portal@0.1.0 test
> jest --detectOpenHandles

FAIL tests/rbac.test.ts
  ● RBAC Enforcement via Live Next.js Dev Server (http://localhost:3000) › should return HTTP 401 for unauthenticated request to /api/instruments

    Next.js dev server is unreachable at http://localhost:3000 (fetch failed). Please ensure 'npm run dev' is running before executing this test suite.

      29 |     }
      30 |   } catch (err: any) {
    > 31 |     throw new Error(
         |           ^
      32 |       `Next.js dev server is unreachable at ${baseUrl} (${err?.message || err}). ` +
      33 |       `Please ensure 'npm run dev' is running before executing this test suite.`
      34 |     );

      at Object.<anonymous> (tests/rbac.test.ts:31:11)

  ● RBAC Enforcement via Live Next.js Dev Server (http://localhost:3000) › should return HTTP 401 for unauthenticated request to /api/admin/system-health

    Next.js dev server is unreachable at http://localhost:3000 (fetch failed). Please ensure 'npm run dev' is running before executing this test suite.

      29 |     }
      30 |   } catch (err: any) {
    > 31 |     throw new Error(
         |           ^
      32 |       `Next.js dev server is unreachable at ${baseUrl} (${err?.message || err}). ` +
      33 |       `Please ensure 'npm run dev' is running before executing this test suite.`
      34 |     );

      at Object.<anonymous> (tests/rbac.test.ts:31:11)

  ● RBAC Enforcement via Live Next.js Dev Server (http://localhost:3000) › should return HTTP 403 when an Institution User calls /api/admin/system-health

    Next.js dev server is unreachable at http://localhost:3000 (fetch failed). Please ensure 'npm run dev' is running before executing this test suite.

      29 |     }
      30 |   } catch (err: any) {
    > 31 |     throw new Error(
         |           ^
      32 |       `Next.js dev server is unreachable at ${baseUrl} (${err?.message || err}). ` +
      33 |       `Please ensure 'npm run dev' is running before executing this test suite.`
      34 |     );

      at Object.<anonymous> (tests/rbac.test.ts:31:11)

  ● RBAC Enforcement via Live Next.js Dev Server (http://localhost:3000) › should return HTTP 200 and only institution-scoped instruments for Institution User

    Next.js dev server is unreachable at http://localhost:3000 (fetch failed). Please ensure 'npm run dev' is running before executing this test suite.

      29 |     }
      30 |   } catch (err: any) {
    > 31 |     throw new Error(
         |           ^
      32 |       `Next.js dev server is unreachable at ${baseUrl} (${err?.message || err}). ` +
      33 |       `Please ensure 'npm run dev' is running before executing this test suite.`
      34 |     );

      at Object.<anonymous> (tests/rbac.test.ts:31:11)

  ● RBAC Enforcement via Live Next.js Dev Server (http://localhost:3000) › should return HTTP 200 and all rows across institutions for Admin User

    Next.js dev server is unreachable at http://localhost:3000 (fetch failed). Please ensure 'npm run dev' is running before executing this test suite.

      29 |     }
      30 |   } catch (err: any) {
    > 31 |     throw new Error(
         |           ^
      32 |       `Next.js dev server is unreachable at ${baseUrl} (${err?.message || err}). ` +
      33 |       `Please ensure 'npm run dev' is running before executing this test suite.`
      34 |     );

      at Object.<anonymous> (tests/rbac.test.ts:31:11)

  ● RBAC Enforcement via Live Next.js Dev Server (http://localhost:3000) › should return HTTP 200 and bureau-wide stats for Admin User on /api/admin/system-health

    Next.js dev server is unreachable at http://localhost:3000 (fetch failed). Please ensure 'npm run dev' is running before executing this test suite.

      29 |     }
      30 |   } catch (err: any) {
    > 31 |     throw new Error(
         |           ^
      32 |       `Next.js dev server is unreachable at ${baseUrl} (${err?.message || err}). ` +
      33 |       `Please ensure 'npm run dev' is running before executing this test suite.`
      34 |     );

      at Object.<anonymous> (tests/rbac.test.ts:31:11)

PASS tests/audit_append_only.test.ts
PASS tests/encryption.test.ts

Test Suites: 1 failed, 2 passed, 3 total
Tests:       6 failed, 10 passed, 16 total
Snapshots:   0 total
Time:        1.782 s, estimated 2 s
Ran all test suites.
```
**Sandbox Note**: As expected and instructed, in standard sandbox mode on Windows, localhost loopback networking is blocked (`connect EACCES 127.0.0.1:3000`), so `tests/rbac.test.ts` fails with the clear designated error message informing the developer that the dev server is unreachable. `tests/audit_append_only.test.ts` (all 7 tests) and `tests/encryption.test.ts` (all 3 tests) passed 100%.

### D. Targeted Append-Only Test Execution (`npx jest tests/audit_append_only.test.ts`)
```
PASS tests/audit_append_only.test.ts
  Append-Only AuditLog Enforcement
    √ should permit create operations on AuditLog (15 ms)
    √ should permit read operations (findMany, findUnique, findFirst) on AuditLog (10 ms)
    √ should throw error when attempting to update an AuditLog row (27 ms)
    √ should throw error when attempting to updateMany on AuditLog (2 ms)
    √ should throw error when attempting to delete an AuditLog row (2 ms)
    √ should throw error when attempting to deleteMany on AuditLog (1 ms)
    √ should throw error when attempting to upsert an AuditLog row (3 ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
Snapshots:   0 total
Time:        1.319 s, estimated 2 s
Ran all test suites matching tests/audit_append_only.test.ts.
```

### E. Database Seed Execution (`node prisma/seed.js`)
```
🧹 Cleaning up old database tables...
⚙️ Creating Reminder Rules with channel, escalateAfterDays, escalateToRole...
🏫 Creating 40 institutions across Indian states...
👥 Creating 12 demo users across all 4 roles...
📜 Creating 120 baseline instruments with Document and DocumentVersion...
🌱 Planting required explicit edge cases...
🔔 Seeding 14 notifications across roles...
📝 Seeding initial Audit Logs...
✅ Seed completed successfully with realistic status distribution, DocumentVersions, multi-verifications, and Discrepancies!
```
