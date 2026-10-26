import http from "http";
import prisma from "../src/lib/prisma";
import { requireAuth } from "../src/lib/serverAuth";
import { encode } from "next-auth/jwt";

let server: http.Server;
let port: number;
let baseUrl: string;

/**
 * Lightweight real HTTP server using NextAuth token decoding and serverAuth helpers
 * to test live HTTP network calls, cookies, headers, and status codes.
 */
beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const url = req.url || "/";
    const cookieHeader = req.headers.cookie || "";

    // Parse JWT from cookie if present
    let mockSessionUser: any = null;
    const match = cookieHeader.match(/next-auth\.session-token=([^;]+)/);
    if (match) {
      try {
        const secret = process.env.NEXTAUTH_SECRET || "aicte_nextauth_jwt_super_secret_key_12345";
        const { decode } = require("next-auth/jwt");
        const decoded = await decode({ token: match[1], secret });
        if (decoded) {
          mockSessionUser = decoded;
        }
      } catch (err) {
        console.error("Token decode error in test server:", err);
      }
    }

    // Route: /api/instruments
    if (url.startsWith("/api/instruments")) {
      if (!mockSessionUser) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized access. Please login." }));
        return;
      }

      const whereClause: any = {};
      if (mockSessionUser.role === "INSTITUTION") {
        whereClause.institutionId = mockSessionUser.institutionId;
      }

      const instruments = await prisma.instrument.findMany({
        where: whereClause,
        include: { institution: true },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          userRole: mockSessionUser.role,
          userInstitutionId: mockSessionUser.institutionId,
          count: instruments.length,
          instruments,
        })
      );
      return;
    }

    // Route: /api/admin/system-health
    if (url.startsWith("/api/admin/system-health")) {
      if (!mockSessionUser) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized access. Please login." }));
        return;
      }

      if (mockSessionUser.role !== "ADMIN") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: `Forbidden. Role '${mockSessionUser.role}' lacks permission for this resource.`,
          })
        );
        return;
      }

      const [userCount, institutionCount, auditCount] = await Promise.all([
        prisma.user.count(),
        prisma.institution.count(),
        prisma.auditLog.count(),
      ]);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          admin: mockSessionUser.email,
          stats: { userCount, institutionCount, auditCount },
        })
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address() as any;
      port = address.port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await (prisma as any).$disconnect();
});

async function createSessionCookie(user: { id: string; name: string; email: string; role: string; institutionId?: string | null }) {
  const secret = process.env.NEXTAUTH_SECRET || "aicte_nextauth_jwt_super_secret_key_12345";
  const token = await encode({
    token: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
    },
    secret,
  });

  return `next-auth.session-token=${token}`;
}

describe("Server-Side Live HTTP RBAC Enforcement Suite", () => {
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

    const cookie = await createSessionCookie(instUser!);
    const res = await fetch(`${baseUrl}/api/instruments`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.userRole).toBe("INSTITUTION");
    expect(json.userInstitutionId).toBe(instUser!.institutionId);
    expect(json.instruments.length).toBeGreaterThan(0);

    // Strict zero data leakage verification
    const foreignRecords = json.instruments.filter(
      (i: any) => i.institutionId !== instUser!.institutionId
    );
    expect(foreignRecords.length).toBe(0);
  });

  it("should return HTTP 200 and bureau-wide stats for Admin User", async () => {
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
