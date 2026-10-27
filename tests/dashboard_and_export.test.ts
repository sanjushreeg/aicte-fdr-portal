/**
 * Test Suite for Dashboard KPI/Charts/Impact Metrics & CSV Export Scoping
 */

import prisma from "../src/lib/prisma";
import { encode } from "next-auth/jwt";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const secret = process.env.NEXTAUTH_SECRET || "aicte_nextauth_jwt_super_secret_key_12345";

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

async function getInstitutionCookie(email = "institution0@example.com") {
  const instUser = await prisma.user.findUnique({ where: { email } });
  if (!instUser) throw new Error(`${email} not found in DB`);
  return createSessionCookie(instUser);
}

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

describe("GET /api/dashboard/stats — KPI cards, charts, impact metrics & RBAC scoping", () => {
  it("returns 401 unauthenticated", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/stats`);
    expect(res.status).toBe(401);
  });

  it("returns bureau-wide KPI cards and 3 charts for Admin", async () => {
    const adminCookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/dashboard/stats`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.userRole).toBe("ADMIN");
    expect(json.isInstitution).toBe(false);

    // KPI cards
    expect(typeof json.kpi.totalInstruments).toBe("number");
    expect(typeof json.kpi.activeInstruments).toBe("number");
    expect(typeof json.kpi.expiringIn30Days).toBe("number");
    expect(typeof json.kpi.openDiscrepancies).toBe("number");
    expect(typeof json.kpi.pendingReleases).toBe("number");
    expect(json.kpi.totalInstruments).toBeGreaterThan(0);

    // 3 Charts
    expect(Array.isArray(json.charts.statusDistribution)).toBe(true);
    expect(Array.isArray(json.charts.maturityTimeline)).toBe(true);
    expect(Array.isArray(json.charts.stateWiseExposure)).toBe(true);

    // Impact Metrics panel
    expect(json.impactMetrics).toBeDefined();
    expect(json.impactMetrics.recordAccuracy).toBeDefined();
    expect(json.impactMetrics.verificationTurnaround).toBeDefined();
    expect(json.impactMetrics.timelyRenewals).toBeDefined();
    expect(json.impactMetrics.manualEffortSaved).toBeDefined();
  });

  it("strictly scopes KPI cards and charts for Institution user", async () => {
    const instUser = await prisma.user.findUnique({
      where: { email: "institution0@example.com" },
    });
    const instCookie = await getInstitutionCookie("institution0@example.com");

    const res = await fetch(`${baseUrl}/api/dashboard/stats`, {
      headers: { Cookie: instCookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.userRole).toBe("INSTITUTION");
    expect(json.isInstitution).toBe(true);
    expect(json.institutionInfo).toBeDefined();

    // Verify instrument count matches database count for this institution
    const dbCount = await prisma.instrument.count({
      where: { institutionId: instUser!.institutionId! },
    });
    expect(json.kpi.totalInstruments).toBe(dbCount);

    // State exposure should only contain the institution's state
    const states = json.charts.stateWiseExposure.map((s: any) => s.state);
    expect(states.length).toBeLessThanOrEqual(1);
  });
});

describe("GET /api/instruments/export — CSV Export & Scoping", () => {
  it("returns 401 unauthenticated", async () => {
    const res = await fetch(`${baseUrl}/api/instruments/export`);
    expect(res.status).toBe(401);
  });

  it("returns bureau CSV export for Admin", async () => {
    const adminCookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments/export`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("Reference Number");
    expect(text).toContain("AICTE Institution ID");
    expect(text).toContain("Maturity Date");

    const lines = text.trim().split("\r\n");
    // Header line + multiple data rows
    expect(lines.length).toBeGreaterThan(1);
  });

  it("respects institution scoping on CSV export", async () => {
    const instUser = await prisma.user.findUnique({
      where: { email: "institution0@example.com" },
      include: { institution: true },
    });
    const instCookie = await getInstitutionCookie("institution0@example.com");

    const res = await fetch(`${baseUrl}/api/instruments/export`, {
      headers: { Cookie: instCookie },
    });
    expect(res.status).toBe(200);
    const text = await res.text();

    const dbInstCount = await prisma.instrument.count({
      where: { institutionId: instUser!.institutionId! },
    });

    const lines = text.trim().split("\r\n");
    // Header + matching rows
    expect(lines.length - 1).toBe(dbInstCount);

    // Each row should contain the institution's name or AICTE ID
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).toContain(instUser!.institution!.aicteId);
    }
  });

  it("filters CSV export by status=ACTIVE", async () => {
    const adminCookie = await getAdminCookie();
    const res = await fetch(`${baseUrl}/api/instruments/export?status=ACTIVE`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text.trim().split("\r\n");

    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).toContain('"ACTIVE"');
    }
  });
});
