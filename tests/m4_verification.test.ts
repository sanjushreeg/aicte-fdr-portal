/**
 * M4 Integration Test Suite — Verification & Discrepancy Engine
 *
 * PREREQUISITE:
 * The Next.js development server must be running at http://localhost:3000 before running this test suite:
 *   npm run dev
 *
 * If the server is unreachable or network loopback is restricted by the sandbox environment,
 * the beforeAll hook fails immediately with a descriptive error message.
 */

import prisma from "../src/lib/prisma";
import { encode } from "next-auth/jwt";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const secret = process.env.NEXTAUTH_SECRET || "aicte_nextauth_jwt_super_secret_key_12345";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createSessionCookie(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  institutionId?: string | null;
}) {
  const token = await encode({
    token: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
      sub: user.id,
    },
    secret,
  });
  return `next-auth.session-token=${token}`;
}

async function getAdminCookie() {
  const adminUser = await prisma.user.findUnique({ where: { email: "admin0@example.com" } });
  if (!adminUser) throw new Error("admin0@example.com not found in DB — run npm run seed");
  return createSessionCookie(adminUser);
}

async function getInstitutionCookie() {
  const instUser = await prisma.user.findUnique({ where: { email: "institution0@example.com" } });
  if (!instUser) throw new Error("institution0@example.com not found in DB — run npm run seed");
  return createSessionCookie(instUser);
}

// ─── Server availability check ───────────────────────────────────────────────

beforeAll(async () => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl}/api/instruments`, { signal: controller.signal });
    if (res.status === undefined) throw new Error("No status received from server");
  } catch (err: any) {
    throw new Error(
      `Next.js dev server is unreachable at ${baseUrl} (${err?.message || err}). ` +
        `Please ensure 'npm run dev' is running before executing this test suite.`
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}, 10000);

afterAll(async () => {
  await (prisma as any).$disconnect();
});

// ─── Verification & Discrepancy Engine Tests ─────────────────────────────────

describe("M4 Verification Engine — Core Banking Verification & Discrepancy Detection", () => {
  it("institution user gets 403 on POST /api/instruments/[id]/verify", async () => {
    const instCookie = await getInstitutionCookie();
    const inst = await prisma.instrument.findFirst();
    expect(inst).toBeTruthy();

    const res = await fetch(`${baseUrl}/api/instruments/${inst!.id}/verify`, {
      method: "POST",
      headers: { Cookie: instCookie },
    });

    expect(res.status).toBe(403);
  });

  it("clean instrument becomes VERIFIED after successful core banking verification", async () => {
    const adminCookie = await getAdminCookie();

    // Create a dedicated clean test instrument with valid document & version
    const institution = await prisma.institution.findFirst();
    const adminUser = await prisma.user.findUnique({ where: { email: "admin0@example.com" } });
    expect(institution).toBeTruthy();

    const cleanRef = `FDR-CLEAN-${Date.now()}`;
    const cleanInst = await prisma.instrument.create({
      data: {
        type: "FDR",
        referenceNumber: cleanRef,
        bankName: "State Bank of India",
        bankBranch: "Main Branch",
        amount: 500000.0,
        issueDate: new Date(),
        maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "SUBMITTED",
        institutionId: institution!.id,
        createdById: adminUser!.id,
        verifiedByBank: false,
      },
    });

    const doc = await prisma.document.create({
      data: {
        instrumentId: cleanInst.id,
        name: "Clean_Deposit_Receipt.pdf",
        category: "FDR_COPY",
        currentVersion: 1,
      },
    });

    await prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        version: 1,
        filePath: `/encrypted/vault/${cleanInst.id}/clean_v1.pdf`,
        uploadedById: adminUser!.id,
      },
    });

    const res = await fetch(`${baseUrl}/api/instruments/${cleanInst.id}/verify`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.verification).toBeDefined();
    expect(json.verification.status).toBe("SUCCESS");
    expect(json.instrumentStatus).toBe("VERIFIED");

    // Verify instrument in DB has status VERIFIED and verifiedByBank true
    const updated = await prisma.instrument.findUnique({ where: { id: cleanInst.id } });
    expect(updated?.status).toBe("VERIFIED");
    expect(updated?.verifiedByBank).toBe(true);
  });

  it("seeded 25L vs 20L case produces AMOUNT_MISMATCH with critical severity", async () => {
    const adminCookie = await getAdminCookie();

    const mismatchInst = await prisma.instrument.findFirst({
      where: { referenceNumber: "FDR-MISMATCH-2026" },
    });
    expect(mismatchInst).toBeTruthy();

    const res = await fetch(`${baseUrl}/api/instruments/${mismatchInst!.id}/verify`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.verification.status).toBe("MISMATCH");
    expect(json.instrumentStatus).toBe("MISMATCH");

    const amountMismatch = json.discrepancies.find((d: any) => d.code === "AMOUNT_MISMATCH");
    expect(amountMismatch).toBeDefined();
    expect(amountMismatch.severity).toBe("critical");
    expect(amountMismatch.status).toBe("OPEN");
  });

  it("duplicate case produces DUPLICATE_FDR with critical severity", async () => {
    const adminCookie = await getAdminCookie();

    // Find the second duplicate instrument (Institution 3)
    const dupInstruments = await prisma.instrument.findMany({
      where: { referenceNumber: "FDR-DUP-999888" },
      orderBy: { createdAt: "desc" },
    });
    expect(dupInstruments.length).toBeGreaterThanOrEqual(2);

    const targetDup = dupInstruments[0]; // Second institution instrument
    const res = await fetch(`${baseUrl}/api/instruments/${targetDup.id}/verify`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.verification.status).toBe("MISMATCH");
    const dupDiscrepancy = json.discrepancies.find((d: any) => d.code === "DUPLICATE_FDR");
    expect(dupDiscrepancy).toBeDefined();
    expect(dupDiscrepancy.severity).toBe("critical");
  });

  it("missing-document case produces MISSING_DOCUMENT with high severity", async () => {
    const adminCookie = await getAdminCookie();

    const missingDocInst = await prisma.instrument.findFirst({
      where: { referenceNumber: "FDR-MISSING-DOC-FLAG" },
    });
    expect(missingDocInst).toBeTruthy();

    const res = await fetch(`${baseUrl}/api/instruments/${missingDocInst!.id}/verify`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.verification.status).toBe("MISMATCH");
    const missingDocDisc = json.discrepancies.find((d: any) => d.code === "MISSING_DOCUMENT");
    expect(missingDocDisc).toBeDefined();
    expect(missingDocDisc.severity).toBe("high");
  });

  it("re-running verification does not duplicate open discrepancies", async () => {
    const adminCookie = await getAdminCookie();

    const mismatchInst = await prisma.instrument.findFirst({
      where: { referenceNumber: "FDR-MISMATCH-2026" },
    });
    expect(mismatchInst).toBeTruthy();

    // Run verification first time
    const res1 = await fetch(`${baseUrl}/api/instruments/${mismatchInst!.id}/verify`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    expect(res1.status).toBe(200);

    // Run verification second time immediately
    const res2 = await fetch(`${baseUrl}/api/instruments/${mismatchInst!.id}/verify`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    expect(res2.status).toBe(200);

    // Count open AMOUNT_MISMATCH discrepancies for this instrument
    const openAmountDiscrepancies = await prisma.discrepancy.findMany({
      where: {
        instrumentId: mismatchInst!.id,
        code: "AMOUNT_MISMATCH",
        status: "OPEN",
      },
    });

    // Exactly 1 open discrepancy record must exist, NOT multiple
    expect(openAmountDiscrepancies.length).toBe(1);
  });
});

// ─── Discrepancy Resolution & Audit Log Tests ────────────────────────────────

describe("M4 Discrepancy Resolution — Resolve, Waive & Status Transitions", () => {
  it("institution user gets 403 on POST /api/discrepancies/[id]/resolve", async () => {
    const instCookie = await getInstitutionCookie();
    const disc = await prisma.discrepancy.findFirst();
    expect(disc).toBeTruthy();

    const res = await fetch(`${baseUrl}/api/discrepancies/${disc!.id}/resolve`, {
      method: "POST",
      headers: {
        Cookie: instCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "RESOLVED", note: "Attempted by institution" }),
    });

    expect(res.status).toBe(403);
  });

  it("rejects resolution without a note (HTTP 400)", async () => {
    const adminCookie = await getAdminCookie();
    const disc = await prisma.discrepancy.findFirst();
    expect(disc).toBeTruthy();

    const res = await fetch(`${baseUrl}/api/discrepancies/${disc!.id}/resolve`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "RESOLVED", note: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("resolves a discrepancy and flips instrument to VERIFIED when all discrepancies are cleared", async () => {
    const adminCookie = await getAdminCookie();
    const institution = await prisma.institution.findFirst();
    const adminUser = await prisma.user.findUnique({ where: { email: "admin0@example.com" } });
    expect(institution).toBeTruthy();

    // Create an instrument with exactly 1 discrepancy
    const inst = await prisma.instrument.create({
      data: {
        type: "FDR",
        referenceNumber: `FDR-RESOLVE-TEST-${Date.now()}`,
        bankName: "HDFC Bank",
        bankBranch: "Fort Branch",
        amount: 1000000.0,
        issueDate: new Date(),
        maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "MISMATCH",
        institutionId: institution!.id,
        createdById: adminUser!.id,
        verifiedByBank: true,
      },
    });

    const disc = await prisma.discrepancy.create({
      data: {
        instrumentId: inst.id,
        code: "AMOUNT_MISMATCH",
        severity: "critical",
        status: "OPEN",
        details: JSON.stringify({ field: "amount", description: "Test variance" }),
        detectedAt: new Date(),
      },
    });

    const resolutionNote = "Core banking statement reconciled and confirmed by branch manager";

    const res = await fetch(`${baseUrl}/api/discrepancies/${disc.id}/resolve`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "RESOLVED",
        note: resolutionNote,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.discrepancy.status).toBe("RESOLVED");
    expect(json.remainingOpenCount).toBe(0);
    expect(json.instrumentStatus).toBe("VERIFIED");

    // Verify DB state
    const updatedDisc = await prisma.discrepancy.findUnique({ where: { id: disc.id } });
    expect(updatedDisc?.status).toBe("RESOLVED");
    expect(updatedDisc?.resolvedAt).toBeTruthy();
    expect(updatedDisc?.resolvedById).toBe(adminUser!.id);

    const updatedInst = await prisma.instrument.findUnique({ where: { id: inst.id } });
    expect(updatedInst?.status).toBe("VERIFIED");

    // Verify AuditLog record written
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: "RESOLVE",
        entity: "Discrepancy",
        entityId: disc.id,
      },
      orderBy: { timestamp: "desc" },
    });
    expect(auditLog).toBeTruthy();
    expect(auditLog?.performedById).toBe(adminUser!.id);
  });

  it("waives a discrepancy and records WAIVE audit entry", async () => {
    const adminCookie = await getAdminCookie();
    const institution = await prisma.institution.findFirst();
    const adminUser = await prisma.user.findUnique({ where: { email: "admin0@example.com" } });

    const inst = await prisma.instrument.create({
      data: {
        type: "FDR",
        referenceNumber: `FDR-WAIVE-TEST-${Date.now()}`,
        bankName: "Axis Bank",
        bankBranch: "Cyber City",
        amount: 800000.0,
        issueDate: new Date(),
        maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "MISMATCH",
        institutionId: institution!.id,
        createdById: adminUser!.id,
        verifiedByBank: true,
      },
    });

    const disc = await prisma.discrepancy.create({
      data: {
        instrumentId: inst.id,
        code: "BRANCH_CODE_MISMATCH",
        severity: "medium",
        status: "OPEN",
        details: JSON.stringify({ field: "branchCode", description: "Minor branch merge variance" }),
        detectedAt: new Date(),
      },
    });

    const waiveNote = "Branch merged into main hub per RBI circular 2024-B; variance waived by Approving Authority";

    const res = await fetch(`${baseUrl}/api/discrepancies/${disc.id}/resolve`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "WAIVED",
        note: waiveNote,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.discrepancy.status).toBe("WAIVED");
    expect(json.instrumentStatus).toBe("VERIFIED");

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: "WAIVE",
        entity: "Discrepancy",
        entityId: disc.id,
      },
    });
    expect(auditLog).toBeTruthy();
    expect(auditLog?.performedById).toBe(adminUser!.id);
  });
});
