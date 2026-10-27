# AICTE Fixed Deposit Receipt (FDR) & Security Deposit Management Portal

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.15-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Recharts](https://img.shields.io/badge/Recharts-3.x-22c55e?style=flat)](https://recharts.org/)

An enterprise-grade regulatory compliance and financial instrument tracking platform designed for the **Regulation Bureau, All India Council for Technical Education (AICTE), Ministry of Education, Government of India**. 

The portal digitizes the complete lifecycle of mandatory institutional Fixed Deposit Receipts (FDRs) and Security Deposits pledged by affiliated technical campuses across India—eliminating counterfeit instruments, unmonitored maturities, manual postal paper trails, and unauthorized deposit releases.

---

## Table of Contents
1. [Overview](#overview)
2. [Setup & Quickstart](#setup--quickstart)
3. [Demo Accounts & RBAC](#demo-accounts--rbac)
4. [Features Mapped to the Problem Statement](#features-mapped-to-the-problem-statement)
5. [Database Architecture & ER Diagram](#database-architecture--er-diagram)
6. [Interactive Dashboard & CSV Export](#interactive-dashboard--csv-export)
7. [Future Scope](#future-scope)

---

## Overview

Technical institutions applying for AICTE approval or establishing new campuses are mandated to pledge Fixed Deposit Receipts (FDRs) or Security Deposits in joint names with the AICTE. Historically, managing these physical paper instruments across thousands of institutions led to critical challenges:
- Difficulty in detecting counterfeit or altered physical FDR certificates.
- Unmonitored deposit maturity dates resulting in lapsed financial guarantees.
- Delays in postal verification cycles with commercial banks taking weeks.
- Lack of an immutable audit trail during renewal and release operations.

The **AICTE FDR Management Portal** replaces manual counter processes with an automated, role-governed digital ecosystem featuring:
- **Core Banking Verification Adapter**: Automated reconciliation against bank core ledgers to catch amount mismatches, invalid maturity dates, and duplicate deposit references.
- **Strict Multi-Tenant Scoping**: Institutions access strictly their own pledged instruments while bureau officials enjoy full multi-institution visibility.
- **Proactive Expiry & Escalation Engine**: Automated 90, 60, 30, and 7-day maturity reminders with in-app notification routing.
- **Two-Step Controlled Release Workflow**: Scrutiny verification checklist followed by high-level Approving Authority sign-off.
- **Interactive Analytics & Impact Benchmarks**: Recharts visualizations for lifecycle distribution, monthly maturity timelines, and state-wise financial exposure, paired with simulated operational efficiency benchmarks.

---

## Setup & Quickstart

### Prerequisites
- **Node.js**: `v18.0.0` or higher (tested on Node.js `v20+` and `v24+`)
- **npm**: `v9.0.0` or higher

### 1. One-Command Setup
Clone the repository and run the setup script to install dependencies, generate the Prisma ORM client, apply database migrations, and seed realistic demo records:

```bash
npm run setup
```

The setup script executes:
1. `npm install` — Installs required dependencies.
2. `npx prisma generate` — Generates Prisma Client.
3. `npx prisma db push --force-reset --skip-generate` — Initializes the SQLite schema.
4. `npm run seed` — Populates 130 baseline instruments across 40 institutions, 12 demo users, document versions, discrepancies, and audit logs.

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Quality Checks & Tests
Ensure the development server (`npm run dev`) is running at `http://localhost:3000` before running tests, as the integration test suite validates end-to-end HTTP endpoints and live session cookies:

```bash
# Typecheck
npm run typecheck

# Code Linting
npm run lint

# Test Suite (Integration & Unit Tests)
npm test
```

---

## Demo Accounts & RBAC

The portal provides 12 pre-configured demo users across all 4 Role-Based Access Control (RBAC) tiers. All accounts share the password: **`Password123`**.

| Role | Email | Name & Designation | Permissions & Scope |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin0@example.com` | Dr. Rajesh Sharma (Director Bureau) | Full system administration, reminder runner, system health, audit log inspection, all instruments. |
| **ADMIN** | `admin1@example.com` | Smt. Sunita Rao (Bureau Admin) | Administrative oversight and configuration. |
| **SCRUTINY_OFFICER** | `scrutinyofficer1@example.com` | Shri. Arvind Kumar (Scrutiny Lead) | Instrument scrutiny, bank core verification, discrepancy resolution/waiver, release checklist review. |
| **SCRUTINY_OFFICER** | `scrutinyofficer2@example.com` | Dr. Meenakshi Sundaram | Technical verification and document validation. |
| **SCRUTINY_OFFICER** | `scrutinyofficer3@example.com` | Prof. Vikram Malhotra | Regional verification desk. |
| **APPROVING_AUTHORITY** | `approving_authority2@example.com` | Dr. K. S. Radhakrishnan (Member Sec.) | Final release authorization, waiver approvals, executive bureau oversight. |
| **APPROVING_AUTHORITY** | `approving_authority3@example.com` | Dr. Anita Desai (Director Approval) | Final sign-off on release requests and renewals. |
| **INSTITUTION** | `institution0@example.com` | Registrar (NIT AP, AICTE Campus 1) | **Strictly scoped** to Institution 0: Submit FDRs, request renewals, view status, request release, export CSV. |
| **INSTITUTION** | `institution1@example.com` | Registrar (GEC Arunachal, Campus 2) | Strictly scoped to Institution 1. |
| **INSTITUTION** | `institution2@example.com` | Finance Officer (Assam, Campus 3) | Strictly scoped to Institution 2. Contains duplicate FDR edge case. |
| **INSTITUTION** | `institution3@example.com` | Authorized Signatory (Bihar, Campus 4)| Strictly scoped to Institution 3. Contains duplicate FDR edge case. |
| **INSTITUTION** | `institution4@example.com` | Dean Admin (Chhattisgarh, Campus 5) | Strictly scoped to Institution 4. |

---

## Features Mapped to the Problem Statement

| Problem Statement Challenge | Real-World Vulnerability | AICTE FDR Portal Architectural Solution | Implementation Details |
| :--- | :--- | :--- | :--- |
| **1. Fake / Tampered FDR Certificates** | Paper FDRs can be forged or altered without immediate bureau detection. | **Core Banking Verification Adapter & Automated Discrepancy Detection** | Instant verification against bank API (`MOCK_BANK_API`). Flags `AMOUNT_MISMATCH`, `DATE_INCONSISTENCY`, or `MISSING_DOCUMENT` with severity tagging. |
| **2. Duplicate FDR References** | An institution pledges the same physical FDR across multiple campuses or programs. | **Cross-Institution Duplicate Detection** | Scrutiny engine detects reference clashes (e.g. `FDR-DUP-999888` across Institution 2 & 3) and raises `DUPLICATE_FDR` critical discrepancy. |
| **3. Silent Deposit Expiry & Lapsed Guarantee** | Fixed deposits mature unnoticed, leaving AICTE without financial coverage. | **Proactive Multi-Tier Expiry Engine** | Automatic categorization of `EXPIRING_SOON` instruments; scheduled 90, 60, 30, and 7-day notification triggers alerting institutions and officers. |
| **4. Broken Paper Trails on Renewal** | Historical continuity is lost when FDRs are rolled over or extended. | **Parent-Child Renewal Chain Lineage** | Explicit `parentId` linkage preserves unbroken renewal history (`FDR-ORIG-CHAIN-001` -> `FDR-RENEWED-CHAIN-002`) with versioned document attachments. |
| **5. Premature or Unauthorized Release** | Deposits released without verifying curriculum completion or NOC clearance. | **Two-Step Controlled Release Workflow** | Institution initiates request; Scrutiny Officer verifies mandatory 3-point checklist; Approving Authority executes immutable `FINAL_APPROVE`. |
| **6. Institutional Privacy & Data Leakage** | Institutions must never inspect competitors' financial deposits or bank balances. | **Server-Enforced Single-Tenant Scoping** | `requireAuth` middleware isolates queries to `user.institutionId` on all API endpoints and CSV exports; rejects foreign queries with HTTP 403. |
| **7. Manual Bureau Reporting & Blindspots** | Bureau leaders lack real-time visibility into state-level exposure and compliance. | **Interactive Recharts Dashboard & Scoped Export** | Real-time KPI summary, lifecycle distribution bar chart, monthly maturity timeline, state-wise exposure chart, and instant CSV export. |

---

## Database Architecture & ER Diagram

The database uses SQLite via Prisma ORM, engineered with normalized relations, versioned document storage, and append-only audit tracking.

### Entity-Relationship Diagram Link
The full Entity-Relationship Diagram with Mermaid specifications and detailed field dictionaries is available at:
👉 **[docs/ER.md](docs/ER.md)**

### Key Data Models Summary
- **`Institution`**: Holds unique AICTE ID, institutional legal name, and Indian state.
- **`User`**: Secure hashed credentials, assigned role (`ADMIN`, `SCRUTINY_OFFICER`, `APPROVING_AUTHORITY`, `INSTITUTION`), and optional foreign key to `Institution`.
- **`Instrument`**: Core deposit model tracking reference number, bank name, branch, amount, issue date, maturity date, status, renewal parent pointer (`parentId`), and relations.
- **`Document` & `DocumentVersion`**: Partitioned architecture separating logical document identity from immutable physical file metadata, SHA-256 hash, and storage paths.
- **`Verification`**: One-to-many verification records capturing bank response payload, execution timestamp, and source adapter.
- **`Discrepancy`**: Single source of truth for discrepancy tracking (`AMOUNT_MISMATCH`, `DUPLICATE_FDR`, `MISSING_DOCUMENT`) with resolution audit trails.
- **`ReleaseRequest`**: Two-step release request entity tracking scrutiny signoff and final authorization.
- **`AuditLog`**: Tamper-evident append-only journal capturing every create, update, verify, resolve, and login/logout event with user reference, IP address, and JSON diffs.

---

## Interactive Dashboard & CSV Export

### 1. Dashboard (`/dashboard`)
Accessible immediately upon login, the dashboard adapts dynamically to the authenticated user's role:
- **5 KPI Summary Cards**:
  1. *Total Instruments*: Total deposits within user scope.
  2. *Active*: Valid instruments currently active.
  3. *Expiring in 30 Days*: Deposits approaching maturity requiring renewal intervention.
  4. *Open Discrepancies*: Unresolved verification flags requiring scrutiny.
  5. *Pending Releases*: Release requests awaiting scrutiny checklist or director approval.
- **3 Interactive Recharts Visualizations**:
  1. *Instruments by Status*: Vertical bar chart color-coded by lifecycle state.
  2. *Maturity Timeline by Month*: Chronological distribution of maturing deposit values.
  3. *State-Wise Exposure*: Regional distribution of total deposit amounts in ₹ Crores.
- **Simulated Impact Metrics Panel**:
  Prominently labeled with a **`SIMULATED`** badge, benchmarking portal performance against manual paper workflows:
  - **Record Accuracy**: 99.8% simulated record fidelity (+25.6% gain via cryptographic hashing & bank API verification).
  - **Verification Turnaround**: 2.4 minutes vs 18 business days postal verification.
  - **Timely Renewals**: 98.5% adherence driven by automated 90/60/30/7-day alerts.
  - **Manual Effort Saved**: 86.4% overhead reduction (~1,850 staff hours saved annually).

### 2. Scoped CSV Export
Users can export instruments at any time:
- Directly via the **"Export CSV"** button on `/instruments` (respecting active UI filters like status, type, state, and search).
- Directly via the quick download link on `/dashboard`.
- Programmatically via `GET /api/instruments/export`.
- **Institution Security Enforced**: Institution users only receive CSV records belonging to their campus. Bureau officers receive complete nationwide records or filtered subsets.

---

## Future Scope

To scale the AICTE FDR Portal into a national standard across all regulatory bodies, future roadmap phases include:

1. **Direct Core Banking API Integration**:
   - Replace the mock banking adapter with live SFMS (Structured Financial Messaging System), NPCI, or RBI-compliant Open Banking ISO 20022 REST connectors.
   - Support automated lien-marking confirmations and balance hold notifications.
2. **Multi-Channel Email / SMS / WhatsApp Notification Gateway**:
   - Integrate Twilio / AWS SNS / Government CDAC SMS gateway for SMS alerts and official WhatsApp Business notifications.
   - Send automated PDF reminder notices directly to institutional Registrars and Trustees.
3. **Automated Escalation Hierarchy**:
   - Introduce time-based escalation workflows where unacknowledged 7-day maturity warnings automatically escalate to AICTE Regional Directors.
   - Dynamic SLA tracking for scrutiny review turnaround.
4. **AI/OCR-Powered Bulk Upload Wizard**:
   - Ingest scanned FDR certificates via optical character recognition (OCR) and computer vision to auto-fill deposit amounts, FDR numbers, and bank branches.
   - Bulk Excel/CSV onboarding wizard for legacy institutional archives.
5. **Playwright End-to-End Test Automation**:
   - Comprehensive cross-browser regression testing with Playwright covering visual snapshots, multi-role handoffs, and verification flows.
