/**
 * Integration Test Suite for M5 (Reminders), M6 (Renewal), and M7 (Release)
 *
 * PREREQUISITE:
 * The Next.js development server must be running at http://localhost:3000 before running this test suite:
 *   npm run dev
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
  if (!adminUser) throw new Error("admin0@example.com not found in DB");
  return createSessionCookie(adminUser);
}

async function getScrutinyCookie() {
  const scrutinyUser = await prisma.user.findUnique({ where: { email: "scrutinyofficer1@example.com" } });
  if (!scrutinyUser) throw new Error("scrutinyofficer1@example.com not found in DB");
  return createSessionCookie(scrutinyUser);
}

async function getApproverCookie() {
  const approverUser = await prisma.user.findUnique({ where: { email: "approving_authority2@example.com" } });
  if (!approverUser) throw new Error("approving_authority2@example.com not found in DB");
  return createSessionCookie(approverUser);
}

async function getInstitutionCookie(email = "institution0@example.com") {
  const instUser = await prisma.user.findUnique({ where: { email } });
  if (!instUser) throw new Error(`${email} not found in DB`);
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

// ─── M5: Maturity Reminders Tests ───────────────────────────────────────────

describe("M5: Maturity Reminders Engine", () => {
  it("non-admin gets 403 on POST /api/admin/run-reminders", async () => {
    const instCookie = await getInstitutionCookie();
    const res = await fetch(`${baseUrl}/api/admin/run-reminders`, {
      method: "POST",
      headers: { Cookie: instCookie },
    });
    expect(res.status).toBe(403);
  });

  it("admin runs reminders and creates notifications without duplicating on rerun", async () => {
    const adminCookie = await getAdminCookie();

    // 1. Initial execution
    const res1 = await fetch(`${baseUrl}/api/admin/run-reminders`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    expect(typeof json1.result.createdNotifications).toBe("number");

    // 2. Second execution immediately - must skip duplicates
    const res2 = await fetch(`${baseUrl}/api/admin/run-reminders`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    // On immediate rerun, 0 new duplicate notifications should be created
    expect(json2.result.createdNotifications).toBe(0);
    expect(json2.result.skippedDuplicates).toBeGreaterThanOrEqual(0);
  });

  it("user can retrieve and mark notifications as read", async () => {
    const scrutinyCookie = await getScrutinyCookie();

    const getRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Cookie: scrutinyCookie },
    });
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(Array.isArray(getJson.notifications)).toBe(true);

    const patchRes = await fetch(`${baseUrl}/api/notifications`, {
      method: "PATCH",
      headers: {
        Cookie: scrutinyCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ all: true }),
    });
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.success).toBe(true);
  });
});

// ─── M6: Instrument Renewal Tests ───────────────────────────────────────────

describe("M6: Instrument Renewal Engine", () => {
  it("institution owner renews instrument: creates chained child and marks old as RENEWED", async () => {
    const instUser = await prisma.user.findUnique({ where: { email: "institution0@example.com" } });
    expect(instUser).toBeTruthy();
    const instCookie = await createSessionCookie(instUser!);

    // Find an instrument owned by institution0
    const originalInst = await prisma.instrument.findFirst({
      where: {
        institutionId: instUser!.institutionId!,
        status: { not: "RENEWED" },
      },
    });
    expect(originalInst).toBeTruthy();

    const newRefNum = `FDR-RENEWED-${Date.now()}`;
    const newMaturity = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const res = await fetch(`${baseUrl}/api/instruments/${originalInst!.id}/renew`, {
      method: "POST",
      headers: {
        Cookie: instCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referenceNumber: newRefNum,
        maturityDate: newMaturity,
        amount: originalInst!.amount,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();

    // Check new instrument
    expect(json.newInstrument).toBeDefined();
    expect(json.newInstrument.referenceNumber).toBe(newRefNum);
    expect(json.newInstrument.parentId).toBe(originalInst!.id);
    expect(json.newInstrument.status).toBe("SUBMITTED");
    expect(json.newInstrument.institutionId).toBe(originalInst!.institutionId);

    // Check old instrument in DB
    const updatedOld = await prisma.instrument.findUnique({ where: { id: originalInst!.id } });
    expect(updatedOld?.status).toBe("RENEWED");
  });

  it("non-owner institution user receives 403 on renew", async () => {
    const instUser1 = await prisma.user.findUnique({ where: { email: "institution1@example.com" } });
    expect(instUser1).toBeTruthy();
    const inst1Cookie = await createSessionCookie(instUser1!);

    // Find an instrument NOT owned by institution1
    const foreignInst = await prisma.instrument.findFirst({
      where: {
        institutionId: { not: instUser1!.institutionId! },
      },
    });
    expect(foreignInst).toBeTruthy();

    const res = await fetch(`${baseUrl}/api/instruments/${foreignInst!.id}/renew`, {
      method: "POST",
      headers: {
        Cookie: inst1Cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referenceNumber: `FDR-HACK-${Date.now()}`,
        maturityDate: "2028-01-01",
      }),
    });

    expect(res.status).toBe(403);
  });

  it("renews seeded instrument FDR-DUP-999888 and returns structured JSON response", async () => {
    // 1. Locate the seeded FDR-DUP-999888 instrument (created in prisma/seed.js)
    const seededInst = await prisma.instrument.findFirst({
      where: { referenceNumber: "FDR-DUP-999888", status: { not: "RENEWED" } },
      include: { institution: true },
    });
    expect(seededInst).toBeTruthy();

    // 2. Identify owning institution user
    const instUser = await prisma.user.findFirst({
      where: { institutionId: seededInst!.institutionId },
    });
    expect(instUser).toBeTruthy();
    const instCookie = await createSessionCookie(instUser!);

    const newRef = `FDR-DUP-999888-RENEWED-${Date.now()}`;
    const newMaturity = "2029-05-15";

    // 3. Call renew endpoint
    const res = await fetch(`${baseUrl}/api/instruments/${seededInst!.id}/renew`, {
      method: "POST",
      headers: {
        Cookie: instCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referenceNumber: newRef,
        maturityDate: newMaturity,
        amount: seededInst!.amount,
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = await res.json();

    expect(json.message).toBe("Instrument renewed successfully.");
    expect(json.newInstrument).toBeDefined();
    expect(json.newInstrument.referenceNumber).toBe(newRef);
    expect(json.newInstrument.parentId).toBe(seededInst!.id);
    expect(json.newInstrument.status).toBe("SUBMITTED");
    expect(json.oldInstrument).toBeDefined();
    expect(json.oldInstrument.status).toBe("RENEWED");

    // 4. Validate DB state
    const oldDb = await prisma.instrument.findUnique({ where: { id: seededInst!.id } });
    expect(oldDb?.status).toBe("RENEWED");

    // 5. Verify error cases return valid JSON with { error }
    const badRes = await fetch(`${baseUrl}/api/instruments/${seededInst!.id}/renew`, {
      method: "POST",
      headers: {
        Cookie: instCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(badRes.status).toBe(400);
    const badJson = await badRes.json();
    expect(badJson.error).toBeDefined();
  });
});

// ─── M7: Release Workflow Tests ─────────────────────────────────────────────

describe("M7: Release Request & Multi-Stage Approval Workflow", () => {
  it("executes end-to-end release: Request -> Scrutiny Checklist -> Final Approve -> RELEASED", async () => {
    const instUser = await prisma.user.findUnique({ where: { email: "institution0@example.com" } });
    const adminUser = await prisma.user.findUnique({ where: { email: "admin0@example.com" } });
    expect(instUser).toBeTruthy();

    const instCookie = await createSessionCookie(instUser!);
    const scrutinyCookie = await getScrutinyCookie();
    const approverCookie = await getApproverCookie();

    // Create a fresh test instrument for institution0
    const testInst = await prisma.instrument.create({
      data: {
        type: "FDR",
        referenceNumber: `FDR-RELEASE-FLOW-${Date.now()}`,
        bankName: "Bank of Baroda",
        bankBranch: "Nariman Point",
        amount: 1500000.0,
        issueDate: new Date(),
        maturityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
        institutionId: instUser!.institutionId!,
        createdById: adminUser!.id,
        verifiedByBank: true,
      },
    });

    // Step 1: Institution owner submits release request
    const reqRes = await fetch(`${baseUrl}/api/instruments/${testInst.id}/release-request`, {
      method: "POST",
      headers: {
        Cookie: instCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ remarks: "Course affiliation completed successfully" }),
    });
    expect(reqRes.status).toBe(200);
    const reqJson = await reqRes.json();
    expect(reqJson.releaseRequest.status).toBe("PENDING_SCRUTINY");

    // Step 2: Role check - Scrutiny officer trying final approve must get 403
    const invalidFinalRes = await fetch(`${baseUrl}/api/instruments/${testInst.id}/release-action`, {
      method: "POST",
      headers: {
        Cookie: scrutinyCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "FINAL_APPROVE" }),
    });
    expect(invalidFinalRes.status).toBe(403);

    // Step 3: Scrutiny officer submitting incomplete checklist (not all 3 true) must get 400
    const incompleteChecklistRes = await fetch(`${baseUrl}/api/instruments/${testInst.id}/release-action`, {
      method: "POST",
      headers: {
        Cookie: scrutinyCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "SCRUTINY_APPROVE",
        checklist: [true, false, true], // 2nd item is false!
      }),
    });
    expect(incompleteChecklistRes.status).toBe(400);

    // Step 4: Scrutiny officer completes full 3-item checklist -> SCRUTINY_APPROVED
    const scrutinyRes = await fetch(`${baseUrl}/api/instruments/${testInst.id}/release-action`, {
      method: "POST",
      headers: {
        Cookie: scrutinyCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "SCRUTINY_APPROVE",
        checklist: [true, true, true],
        remarks: "All 3 verification criteria satisfied and verified on addendum.",
      }),
    });
    expect(scrutinyRes.status).toBe(200);
    const scrutinyJson = await scrutinyRes.json();
    expect(scrutinyJson.releaseRequest.status).toBe("SCRUTINY_APPROVED");

    // Step 5: Approving authority grants FINAL_APPROVE -> sets instrument to RELEASED
    const finalRes = await fetch(`${baseUrl}/api/instruments/${testInst.id}/release-action`, {
      method: "POST",
      headers: {
        Cookie: approverCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "FINAL_APPROVE" }),
    });
    expect(finalRes.status).toBe(200);
    const finalJson = await finalRes.json();
    expect(finalJson.releaseRequest.status).toBe("FINAL_APPROVED");
    expect(finalJson.instrument.status).toBe("RELEASED");

    // Confirm instrument in DB has status RELEASED
    const updated = await prisma.instrument.findUnique({ where: { id: testInst.id } });
    expect(updated?.status).toBe("RELEASED");
  });

  it("rejecting release request requires a note and updates status to REJECTED", async () => {
    const instUser = await prisma.user.findUnique({ where: { email: "institution0@example.com" } });
    const adminUser = await prisma.user.findUnique({ where: { email: "admin0@example.com" } });
    const instCookie = await createSessionCookie(instUser!);
    const scrutinyCookie = await getScrutinyCookie();

    const inst = await prisma.instrument.create({
      data: {
        type: "FDR",
        referenceNumber: `FDR-REJECT-FLOW-${Date.now()}`,
        bankName: "Canara Bank",
        bankBranch: "Koramangala",
        amount: 900000.0,
        issueDate: new Date(),
        maturityDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
        institutionId: instUser!.institutionId!,
        createdById: adminUser!.id,
        verifiedByBank: true,
      },
    });

    // Create release request
    await fetch(`${baseUrl}/api/instruments/${inst.id}/release-request`, {
      method: "POST",
      headers: {
        Cookie: instCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ remarks: "Premature release test" }),
    });

    // Reject without note -> 400
    const failRes = await fetch(`${baseUrl}/api/instruments/${inst.id}/release-action`, {
      method: "POST",
      headers: {
        Cookie: scrutinyCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "REJECT", note: "" }),
    });
    expect(failRes.status).toBe(400);

    // Reject with note -> 200 and REJECTED
    const successRes = await fetch(`${baseUrl}/api/instruments/${inst.id}/release-action`, {
      method: "POST",
      headers: {
        Cookie: scrutinyCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "REJECT",
        note: "Minimum lock-in deposit tenure of 3 years has not elapsed.",
      }),
    });
    expect(successRes.status).toBe(200);
    const successJson = await successRes.json();
    expect(successJson.releaseRequest.status).toBe("REJECTED");
  });
});
