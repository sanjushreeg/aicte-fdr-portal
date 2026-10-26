/**
 * RBAC Integration Test Suite
 *
 * PREREQUISITE:
 * The Next.js development server must be running at http://localhost:3000 before running this test suite:
 *   npm run dev
 *
 * If the server is unreachable or if network loopback is restricted by the sandbox environment,
 * the beforeAll hook fails immediately with a descriptive error message directing the developer
 * to ensure the dev server is active.
 */

import prisma from "../src/lib/prisma";
import { encode } from "next-auth/jwt";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

beforeAll(async () => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl}/api/instruments`, {
      signal: controller.signal,
    });
    // If we receive any HTTP status response (e.g., 401), the dev server is up and reachable
    if (res.status === undefined) {
      throw new Error("No status received from server");
    }
  } catch (err: any) {
    throw new Error(
      `Next.js dev server is unreachable at ${baseUrl} (${err?.message || err}). ` +
      `Please ensure 'npm run dev' is running before executing this test suite.`
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
});

afterAll(async () => {
  await (prisma as any).$disconnect();
});

/**
 * Helper to generate a valid NextAuth JWT session cookie accepted by the running dev server.
 */
async function createSessionCookie(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  institutionId?: string | null;
}) {
  const secret = process.env.NEXTAUTH_SECRET || "aicte_nextauth_jwt_super_secret_key_12345";
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

describe("RBAC Enforcement via Live Next.js Dev Server (http://localhost:3000)", () => {
  it("should return HTTP 401 for unauthenticated request to /api/instruments", async () => {
    const res = await fetch(`${baseUrl}/api/instruments`);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/Unauthorized access/);
  });

  it("should return HTTP 401 for unauthenticated request to /api/admin/system-health", async () => {
    const res = await fetch(`${baseUrl}/api/admin/system-health`);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/Unauthorized access/);
  });

  it("should return HTTP 403 when an Institution User calls /api/admin/system-health", async () => {
    const instUser = await prisma.user.findUnique({
      where: { email: "institution0@example.com" },
    });
    expect(instUser).toBeDefined();

    const cookie = await createSessionCookie(instUser!);
    const res = await fetch(`${baseUrl}/api/admin/system-health`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Forbidden/);
  });

  it("should return HTTP 200 and only institution-scoped instruments for Institution User", async () => {
    const instUser = await prisma.user.findUnique({
      where: { email: "institution0@example.com" },
    });
    expect(instUser).toBeDefined();
    expect(instUser!.institutionId).toBeTruthy();

    const cookie = await createSessionCookie(instUser!);
    const res = await fetch(`${baseUrl}/api/instruments`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.userRole).toBe("INSTITUTION");
    expect(json.userInstitutionId).toBe(instUser!.institutionId);
    expect(json.instruments.length).toBeGreaterThan(0);

    // Verify strict tenant isolation: zero records from other institutions
    const foreignRecords = json.instruments.filter(
      (i: any) => i.institutionId !== instUser!.institutionId
    );
    expect(foreignRecords.length).toBe(0);
  });

  it("should return HTTP 200 and all rows across institutions for Admin User", async () => {
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin0@example.com" },
    });
    expect(adminUser).toBeDefined();

    const cookie = await createSessionCookie(adminUser!);
    const res = await fetch(`${baseUrl}/api/instruments`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.userRole).toBe("ADMIN");
    expect(json.instruments.length).toBeGreaterThan(0);

    // Verify admin can view instruments belonging to multiple different institutions
    const distinctInstitutionIds = new Set(json.instruments.map((i: any) => i.institutionId));
    expect(distinctInstitutionIds.size).toBeGreaterThan(1);
  });

  it("should return HTTP 200 and bureau-wide stats for Admin User on /api/admin/system-health", async () => {
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin0@example.com" },
    });
    expect(adminUser).toBeDefined();

    const cookie = await createSessionCookie(adminUser!);
    const res = await fetch(`${baseUrl}/api/admin/system-health`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.admin).toBe("admin0@example.com");
    expect(json.stats.userCount).toBe(12);
  });
});
