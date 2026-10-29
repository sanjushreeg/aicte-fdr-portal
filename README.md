# AICTE FDR & Security Deposit Management Portal

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-5.15-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?logo=tailwind-css)

A digital platform for managing and verifying Fixed Deposit Receipts (FDRs) and security deposits submitted by technical institutions to AICTE. It helps reduce fraud, prevent missed maturities, and improve financial transparency.

## Key Features

- **FDR Verification:** Detects duplicate references, amount mismatches, and missing documents.
- **Expiry Alerts:** Notifications for deposits maturing in 90, 60, 30, and 7 days.
- **Secure Access:** Role-based permissions for administrators, scrutiny officers, approving authorities, and institutions.
- **Controlled Release:** Two-step verification and approval workflow.
- **Renewal Tracking:** Maintains deposit history and document versions.
- **Dashboard & Reports:** Interactive charts, financial summaries, and CSV exports.
- **Audit Logs:** Records important system activities.

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **Database & ORM:** SQLite, Prisma
- **Charts:** Recharts

## Setup & Installation

**Prerequisites:** Node.js 18+ and npm 9+.

```bash
git clone <your-repository-url>
cd <project-folder>
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run checks using:

```bash
npm run typecheck
npm run lint
npm test
```

## Demo Login

Demo accounts are available for four roles: `ADMIN`, `SCRUTINY_OFFICER`, `APPROVING_AUTHORITY`, and `INSTITUTION`.

Example accounts:
- Admin: `admin0@example.com`
- Scrutiny Officer: `scrutinyofficer1@example.com`
- Approving Authority: `approving_authority2@example.com`
- Institution: `institution0@example.com`

**Demo password:** `Password123`

*Use these credentials only in the demo environment.*

## Database Architecture

The application uses Prisma with SQLite. Core models include Institution, User, Instrument, Document, Verification, Discrepancy, ReleaseRequest, and AuditLog.

See [docs/ER.md](docs/ER.md) for the Entity-Relationship diagram.

## Future Scope

- Live bank API integration
- Email, SMS, and WhatsApp notifications
- Automated escalation workflows
- AI/OCR-based FDR document processing
- End-to-end testing with Playwright

---

**Note:** Bank verification and performance metrics may be simulated in the current implementation.

