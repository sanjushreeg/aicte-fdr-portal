# AICTE FDR & Security Deposit Portal — 5-Minute Live Demonstration Script

This structured script guides presenters, evaluators, and reviewers through a complete end-to-end walkthrough of the AICTE FDR Portal in exactly 5 minutes.

---

## Demonstration Overview

| Segment | Time | Persona & Login | Focus Area | Core Feature Highlighted |
| :--- | :--- | :--- | :--- | :--- |
| **Part 1** | `0:00 – 0:45` | `institution0@example.com` | Institution View | **New FDR Visible & Tenant Isolation** |
| **Part 2** | `0:45 – 1:45` | `scrutinyofficer1@example.com` | Scrutiny Desk | **Validity Tracking & Approaching Maturity** |
| **Part 3** | `1:45 – 2:45` | `institution0@example.com` | Institution View | **Deposit Renewal & Parent-Child Lineage** |
| **Part 4** | `2:45 – 3:45` | `scrutinyofficer1@example.com` | Scrutiny Desk | **Core Banking Discrepancy Detection & Resolution** |
| **Part 5** | `3:45 – 5:00` | `approving_authority2@example.com` & `admin0@example.com` | Approving Authority & Admin | **Authorized Release Workflow & Bureau Analytics** |

> **Universal Demo Password:** `Password123`

---

## Step-by-Step Script

### Part 1: New FDR Visible & Single-Institution Isolation (0:00 – 0:45)

**Goal:** Prove that technical institutions have a streamlined digital view of their pledged FDRs and cannot see or access other institutions' records.

1. **Log in as Institution User:**
   - Navigate to [http://localhost:3000/login](http://localhost:3000/login).
   - Enter Email: `institution0@example.com` | Password: `Password123`.
2. **Examine Scoped Dashboard (`/dashboard`):**
   - Point to the **RBAC Verified Context** alert:
     > *"Active Security Scope: Single Institution Isolation (NIT AP, AICTE Campus 1)."*
   - Notice the KPI counts and table reflect **only** Institution 0's instruments (~3 instruments).
3. **Navigate to Instruments List (`/instruments`):**
   - Click **"View Instruments"** in the top navigation.
   - Show that only NIT AP's FDRs are listed. The Institution filter input is hidden because tenant scoping is enforced server-side.
   - Point out the newly submitted and active FDRs, showing bank name, amount (₹), maturity dates, and status badges.
4. **Demonstrate Scoped CSV Export:**
   - Click the green **"Export CSV"** button.
   - Open or inspect the downloaded CSV: confirm it contains exclusively records belonging to AICTE Campus 1 (`1-10000000`).

---

### Part 2: Validity Tracking & Approaching Maturity (0:45 – 1:45)

**Goal:** Demonstrate proactive validity tracking across technical institutions and automated reminder notifications for upcoming expirations.

1. **Switch to Scrutiny Lead:**
   - Click **Logout** in the header.
   - Log in as `scrutinyofficer1@example.com` | Password: `Password123`.
2. **Inspect Bureau-Wide Dashboard (`/dashboard`):**
   - Note the expanded scope: **Regulation Bureau Multi-Institution Access**.
   - Point out the **"Expiring in 30d"** KPI card highlighting deposits requiring urgent renewal intervention.
3. **Filter by Approaching Maturity (`/instruments`):**
   - Navigate to `/instruments`.
   - In the **Maturity Window** filter dropdown, select **"Within 30 days"** or **"Within 7 days"**.
   - Show the table updating instantly:
     - Notice the `Days Left` column: items with `<= 7` days are highlighted in bold red (e.g. `7d`), while `<= 30` days appear in amber.
     - Instruments display the amber `EXPIRING_SOON` badge.
4. **Verify Notification Dispatch (`/notifications`):**
   - Click **"Notifications"** in the top navigation bar.
   - Show the automated reminder alerts dispatched for upcoming maturities (90-day, 60-day, 30-day, and 7-day warnings).

---

### Part 3: Approaching Maturity & Renewal Workflow (1:45 – 2:45)

**Goal:** Show how an expiring instrument is renewed without breaking historical continuity or losing document versioning.

1. **Switch to Institution User:**
   - Log back in as `institution0@example.com` | Password: `Password123`.
   - Open `/instruments` and select the maturing deposit: `FDR-ORIG-CHAIN-001`.
2. **Inspect Instrument Detail Page (`/instruments/[id]`):**
   - Point out the current status: `ACTIVE` / `EXPIRING_SOON`.
   - Notice the **Document Versions** tab with original PDF metadata and SHA-256 hash.
3. **Execute Renewal:**
   - Click the **"Renew Instrument"** action button.
   - In the renewal modal/form:
     - New Reference Number: `FDR-RENEWED-CHAIN-002`
     - Extended Maturity Date: Select a date 3 years in the future (e.g. `2029-05-15`).
     - Renewal Document: Upload `renewal_extension_letter.pdf`.
   - Click **"Submit Renewal"**.
4. **Confirm Renewal Chain Lineage:**
   - Observe the confirmation: the previous instrument `FDR-ORIG-CHAIN-001` transitions to `RENEWED`.
   - The new instrument `FDR-RENEWED-CHAIN-002` is created with `parentId` pointing directly to `FDR-ORIG-CHAIN-001`.
   - Unbroken historical lineage is preserved in the database.

---

### Part 4: Discrepancy Found & Scrutiny Resolution (2:45 – 3:45)

**Goal:** Demonstrate the core banking API verification adapter detecting an amount mismatch and the scrutiny officer resolving it.

1. **Switch to Scrutiny Officer:**
   - Log in as `scrutinyofficer1@example.com` | Password: `Password123`.
   - Navigate to `/instruments`.
2. **Locate Discrepant Instrument:**
   - Check the **"Has Open Discrepancy"** filter box.
   - Click on `FDR-MISMATCH-2026`.
3. **Inspect the Core Banking Verification:**
   - Scroll to the **Verification History** card.
   - Click **"Verify with Bank API"**.
   - Show the result:
     - Bank Core Ledger Confirmed Amount: **₹20,00,000**
     - Submitted Institution Claim: **₹25,00,000**
     - Discrepancy Code: **`AMOUNT_MISMATCH`** (Severity: `critical`).
4. **Audit & Resolution:**
   - Click **"Resolve / Waive Discrepancy"**.
   - Select Action: `RESOLVE`.
   - Enter Officer Note: *"Bank confirmed original deposit receipt issued at ₹20,00,000 with additional ₹5,00,000 pledged under supplementary lien endorsement #SL-9941."*
   - Click **"Submit Resolution"**.
   - Show that the discrepancy status moves to `RESOLVED` with the officer's timestamp and user ID logged.

---

### Part 5: Authorized Release Workflow & Bureau Analytics (3:45 – 5:00)

**Goal:** Demonstrate the two-step release workflow (Scrutiny Checklist + Approving Authority Signoff) and conclude with executive analytics.

1. **Step 5A: Scrutiny Officer Release Review (`scrutinyofficer1@example.com`):**
   - In `/instruments`, find `SEC-DEP-RELEASE-PENDING-99` (Security Deposit requested for release following course closure).
   - Click on the instrument to view the pending release request.
   - Review the institutional closure reason and remarks.
   - Complete the mandatory 3-point Scrutiny Checklist:
     - [x] *Institutional curriculum complete & no outstanding student claims.*
     - [x] *State Technical Board / Directorate NOC verified.*
     - [x] *AICTE Bureau order validity confirmed.*
   - Click **"Submit Scrutiny Approval"**.
   - Release request transitions to `SCRUTINY_APPROVED`.
2. **Step 5B: Approving Authority Final Release Authorization:**
   - Log out and log in as `approving_authority2@example.com` (Dr. K. S. Radhakrishnan, Member Secretary) | `Password123`.
   - Open `/instruments` and click `SEC-DEP-RELEASE-PENDING-99`.
   - Observe that the scrutiny checklist is locked and verified.
   - Enter Executive Authorization Remarks: *"Approved unconditionally under AICTE Council Resolution 114/2026."*
   - Click **"Authorize Final Release"**.
   - Confirm status transition: Instrument status immediately updates to `RELEASED`.
3. **Step 5C: Executive Dashboard Analytics & Simulated Impact (`admin0@example.com`):**
   - Log in as `admin0@example.com` | `Password123`.
   - Open `/dashboard`:
     - **3 Recharts Visualizations**:
       - *Instruments by Status*: View nationwide lifecycle breakdown (`ACTIVE`, `EXPIRING_SOON`, `RELEASED`, etc.).
       - *Maturity Timeline by Month*: Point out the upcoming financial maturity schedule.
       - *State-Wise Exposure*: Inspect top states by total deposit value in ₹ Crores.
     - **Impact Metrics Panel (`SIMULATED`)**:
       - *Record Accuracy*: **99.8%** (+25.6% gain over manual paper filing).
       - *Verification Turnaround*: **2.4 minutes** vs 18 business days postal verification.
       - *Timely Renewals*: **98.5%** adherence via automated reminder rules.
       - *Manual Effort Saved*: **86.4%** reduction (~1,850 staff hours saved annually).
4. **Summary & Wrap-Up:**
   - Highlight the tamper-evident **Append-Only Audit Log** (accessible via `/admin`) proving that every login, verification, discrepancy resolution, and release decision is immutably preserved.

---

## Quick Reference: Demo Credentials

| Role | Email | Password | Primary Feature to Demo |
| :--- | :--- | :--- | :--- |
| **Institution** | `institution0@example.com` | `Password123` | Scoped view, new FDR, renewal request, CSV export |
| **Scrutiny Officer** | `scrutinyofficer1@example.com` | `Password123` | Core banking verify, discrepancy resolution, release checklist |
| **Approving Authority**| `approving_authority2@example.com`| `Password123` | Final release authorization, executive signoff |
| **Bureau Admin** | `admin0@example.com` | `Password123` | Executive Recharts dashboard, simulated impact, audit health |
