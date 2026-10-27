/**
 * M3 Integration Test Suite — Instrument List, Detail, Filters & Institution Scoping
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

// ─── Instruments List — Filters & Pagination ─────────────────────────────────

describe("GET /api/instruments — filters, pagination, sorting", () => {
  it("returns 401 without authentication", async () => {
    const res = await fetch(`${baseUrl}/api/instruments`);
    expect(res.status).toBe(401);
  });

  it("returns paginated response (page 1, 25 per page) for admin", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?page=1`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(25);
    expect(typeof json.total).toBe("number");
    expect(typeof json.totalPages).toBe("number");
    expect(Array.isArray(json.instruments)).toBe(true);
    expect(json.instruments.length).toBeLessThanOrEqual(25);
  });

  it("filters by status=ACTIVE correctly", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?status=ACTIVE`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    // Every returned instrument should be ACTIVE
    expect(json.instruments.length).toBeGreaterThan(0);
    json.instruments.forEach((inst: any) => {
      expect(inst.status).toBe("ACTIVE");
    });
  });

  it("filters by type=FDR correctly", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?type=FDR`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.instruments.length).toBeGreaterThan(0);
    json.instruments.forEach((inst: any) => {
      expect(inst.type).toBe("FDR");
    });
  });

  it("filters by type=SECURITY_DEPOSIT correctly", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?type=SECURITY_DEPOSIT`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.instruments.length).toBeGreaterThan(0);
    json.instruments.forEach((inst: any) => {
      expect(inst.type).toBe("SECURITY_DEPOSIT");
    });
  });

  it("filters by openDiscrepancy=true returns instruments with ≥1 open discrepancy", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?openDiscrepancy=true`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    // If any instruments have open discrepancies, each returned one must have count > 0
    if (json.instruments.length > 0) {
      json.instruments.forEach((inst: any) => {
        expect(inst.openDiscrepancyCount).toBeGreaterThan(0);
      });
    }
  });

  it("text search on referenceNumber narrows results", async () => {
    const cookie = await getAdminCookie();
    // Search for the known seeded mismatch FDR
    const res = await fetch(`${baseUrl}/api/instruments?search=FDR-MISMATCH`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.instruments.length).toBeGreaterThan(0);
    json.instruments.forEach((inst: any) => {
      const match =
        inst.referenceNumber.includes("FDR-MISMATCH") || inst.bankName.includes("FDR-MISMATCH");
      expect(match).toBe(true);
    });
  });

  it("sorts by amount ascending", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?sortBy=amount&sortDir=asc&page=1`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const amounts: number[] = json.instruments.map((i: any) => i.amount);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]);
    }
  });

  it("sorts by amount descending", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?sortBy=amount&sortDir=desc&page=1`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const amounts: number[] = json.instruments.map((i: any) => i.amount);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i]).toBeLessThanOrEqual(amounts[i - 1]);
    }
  });

  it("sorts by maturityDate ascending", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?sortBy=maturityDate&sortDir=asc&page=1`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const dates: number[] = json.instruments.map((i: any) => new Date(i.maturityDate).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
    }
  });

  it("returns each instrument with daysToMaturity and openDiscrepancyCount fields", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?page=1`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.instruments.length).toBeGreaterThan(0);
    json.instruments.forEach((inst: any) => {
      expect(typeof inst.daysToMaturity).toBe("number");
      expect(typeof inst.openDiscrepancyCount).toBe("number");
    });
  });

  it("filters by maturity window (overdue) — all returned instruments have past maturity", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments?maturity=overdue`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    if (json.instruments.length > 0) {
      json.instruments.forEach((inst: any) => {
        expect(inst.daysToMaturity).toBeLessThan(1);
      });
    }
  });
});

// ─── Institution Scoping — List ───────────────────────────────────────────────

describe("GET /api/instruments — institution scoping", () => {
  it("institution user sees only their own instruments (zero foreign records)", async () => {
    const instUser = await prisma.user.findUnique({ where: { email: "institution0@example.com" } });
    expect(instUser).toBeTruthy();
    const cookie = await createSessionCookie(instUser!);

    const res = await fetch(`${baseUrl}/api/instruments`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.userRole).toBe("INSTITUTION");
    expect(json.userInstitutionId).toBe(instUser!.institutionId);

    const foreign = json.instruments.filter(
      (i: any) => i.institutionId !== instUser!.institutionId
    );
    expect(foreign.length).toBe(0);
  });

  it("institution user cannot override institution filter via query param", async () => {
    const instUser = await prisma.user.findUnique({ where: { email: "institution0@example.com" } });
    const otherInstitution = await prisma.institution.findFirst({
      where: { id: { not: instUser!.institutionId! } },
    });
    expect(otherInstitution).toBeTruthy();
    const cookie = await createSessionCookie(instUser!);

    // Attempt to pass another institution's ID in query string
    const res = await fetch(
      `${baseUrl}/api/instruments?institution=${otherInstitution!.id}`,
      { headers: { Cookie: cookie } }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // Still must only see own instruments — the query param institution filter is ignored for INSTITUTION role
    const foreign = json.instruments.filter(
      (i: any) => i.institutionId !== instUser!.institutionId
    );
    expect(foreign.length).toBe(0);
  });

  it("admin sees instruments from multiple institutions", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const json = await res.json();
    const distinctIds = new Set(json.instruments.map((i: any) => i.institutionId));
    expect(distinctIds.size).toBeGreaterThan(1);
  });
});

// ─── Institution Scoping — Detail ────────────────────────────────────────────

describe("GET /api/instruments/[id] — institution scoping on detail", () => {
  it("returns 403 when institution user requests another institution's instrument", async () => {
    const instUser = await prisma.user.findUnique({ where: { email: "institution0@example.com" } });
    expect(instUser).toBeTruthy();

    // Find an instrument from a DIFFERENT institution
    const foreignInstrument = await prisma.instrument.findFirst({
      where: { institutionId: { not: instUser!.institutionId! } },
    });
    expect(foreignInstrument).toBeTruthy();

    const cookie = await createSessionCookie(instUser!);
    const res = await fetch(`${baseUrl}/api/instruments/${foreignInstrument!.id}`, {
      headers: { Cookie: cookie },
    });

    expect([403, 404]).toContain(res.status);
  });

  it("returns 200 when institution user requests their own instrument", async () => {
    const instUser = await prisma.user.findUnique({ where: { email: "institution0@example.com" } });
    expect(instUser).toBeTruthy();

    const ownInstrument = await prisma.instrument.findFirst({
      where: { institutionId: instUser!.institutionId! },
    });
    expect(ownInstrument).toBeTruthy();

    const cookie = await createSessionCookie(instUser!);
    const res = await fetch(`${baseUrl}/api/instruments/${ownInstrument!.id}`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.instrument.id).toBe(ownInstrument!.id);
  });

  it("returns 404 for a completely non-existent id", async () => {
    const cookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments/00000000-0000-0000-0000-000000000000`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("detail response includes documents, verifications, discrepancies, auditLogs", async () => {
    const cookie = await getAdminCookie();
    // Get any instrument id
    const listRes = await fetch(`${baseUrl}/api/instruments?page=1`, {
      headers: { Cookie: cookie },
    });
    const listJson = await listRes.json();
    const firstId = listJson.instruments[0]?.id;
    expect(firstId).toBeTruthy();

    const res = await fetch(`${baseUrl}/api/instruments/${firstId}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.instrument).toBeDefined();
    expect(Array.isArray(json.instrument.documents)).toBe(true);
    expect(Array.isArray(json.instrument.verifications)).toBe(true);
    expect(Array.isArray(json.instrument.discrepancies)).toBe(true);
    expect(Array.isArray(json.auditLogs)).toBe(true);
    expect(typeof json.instrument.daysToMaturity).toBe("number");
  });
});

// ─── LOGIN_FAILED audit with non-existent email ───────────────────────────────

describe("LOGIN_FAILED audit entry for non-existent email", () => {
  it("records a LOGIN_FAILED AuditLog with performedById=null for an email that does not exist", async () => {
    const nonExistentEmail = `no-such-user-${Date.now()}@ghost.invalid`;
    const before = new Date();

    // Attempt login via NextAuth credentials endpoint
    await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        email: nonExistentEmail,
        password: "WrongPassword999",
        csrfToken: "dummy", // NextAuth will reject but the authorize callback still runs
        json: "true",
      }),
      redirect: "manual",
    });

    // The endpoint may 302 or 401; either way, the authorize() callback should have fired
    // Give the DB a moment to commit (the server is async)
    await new Promise((r) => setTimeout(r, 500));

    // Check for LOGIN_FAILED entry in the DB
    const logs = await prisma.auditLog.findMany({
      where: {
        action: "LOGIN_FAILED",
        timestamp: { gte: before },
      },
      orderBy: { timestamp: "desc" },
      take: 5,
    });

    // Filter to find one matching our non-existent email
    const matching = logs.filter((l) => {
      try {
        const after = l.after ? JSON.parse(l.after) : null;
        return after?.email === nonExistentEmail;
      } catch {
        return false;
      }
    });

    expect(matching.length).toBeGreaterThan(0);
    // performedById must be null (not crashing, not using a random ID)
    expect(matching[0].performedById).toBeNull();
  });
});
