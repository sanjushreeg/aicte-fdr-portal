/**
 * tests/state_exposure_api.test.ts
 *
 * Unit tests for GET /api/reports/state-exposure.
 * Mocks requireAuth and prisma so no database is needed.
 */

import { NextResponse } from "next/server";

// ── Mock requireAuth ──────────────────────────────────────────────────────────

const mockRequireAuth = jest.fn();
jest.mock("@/lib/serverAuth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

// ── Mock prisma ───────────────────────────────────────────────────────────────

const mockFindMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    instrument: {
      findMany: (...args: any[]) => mockFindMany(...args),
    },
  },
}));

// ── Import route AFTER mocks ──────────────────────────────────────────────────

import { GET } from "@/app/api/reports/state-exposure/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/reports/state-exposure");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

const NOW = new Date();
const IN_20_DAYS = new Date(NOW.getTime() + 20 * 24 * 60 * 60 * 1000);
const IN_60_DAYS = new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000);

const LIVE_INSTRUMENTS = [
  {
    id: "i1", amount: 50_000_000, status: "ACTIVE",
    maturityDate: IN_60_DAYS, institutionId: "inst-A",
    institution: { state: "Maharashtra", id: "inst-A" },
  },
  {
    id: "i2", amount: 80_000_000, status: "VERIFIED",
    maturityDate: IN_20_DAYS, institutionId: "inst-B",
    institution: { state: "Karnataka", id: "inst-B" },
  },
  {
    id: "i3", amount: 20_000_000, status: "MISMATCH",
    maturityDate: IN_60_DAYS, institutionId: "inst-A",
    institution: { state: "Maharashtra", id: "inst-A" },
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/reports/state-exposure — auth enforcement", () => {
  test("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  test("returns 403 when role is INSTITUTION", async () => {
    mockRequireAuth.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user: { id: "u1", role: "INSTITUTION" },
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/reports/state-exposure — authorised roles", () => {
  const authorisedCases = [
    { role: "SCRUTINY_OFFICER" },
    { role: "APPROVING_AUTHORITY" },
    { role: "ADMIN" },
  ];

  test.each(authorisedCases)("$role gets 200 with state data", async ({ role }) => {
    mockRequireAuth.mockResolvedValue({
      error: null,
      user: { id: "u1", role },
    });
    mockFindMany.mockResolvedValue(LIVE_INSTRUMENTS);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
  });
});

describe("GET /api/reports/state-exposure — aggregation correctness", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({
      error: null,
      user: { id: "u-admin", role: "ADMIN" },
    });
    mockFindMany.mockResolvedValue(LIVE_INSTRUMENTS);
  });

  test("returns states sorted by totalAmount descending", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    const states: string[] = body.data.map((r: any) => r.state);
    // Maharashtra (50M + 20M = 70M) > Karnataka (80M) — wait: 70M < 80M
    // Karnataka (80M) > Maharashtra (i1:50M + i3:20M = 70M)
    expect(states[0]).toBe("Karnataka");
    expect(states[1]).toBe("Maharashtra");
  });

  test("totalCrores is correct for Karnataka (80M rupees = 8.00 Cr)", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    const karnataka = body.data.find((r: any) => r.state === "Karnataka");
    expect(karnataka).toBeDefined();
    expect(karnataka.totalCrores).toBe(8.0);
    expect(karnataka.instrumentCount).toBe(1);
    expect(karnataka.institutionCount).toBe(1);
  });

  test("Maharashtra has 2 instruments (i1+i3), 1 institution (inst-A), 1 mismatch", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    const mh = body.data.find((r: any) => r.state === "Maharashtra");
    expect(mh).toBeDefined();
    expect(mh.instrumentCount).toBe(2); // i1 + i3
    expect(mh.institutionCount).toBe(1); // both from inst-A
    expect(mh.mismatchCount).toBe(1);   // i3 is MISMATCH
  });

  test("meta.totalStates reflects distinct states in result", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.meta.totalStates).toBe(2);
  });

  test("limit=1 returns only the top state", async () => {
    const res = await GET(makeRequest({ limit: "1" }));
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].state).toBe("Karnataka");
  });
});

describe("GET /api/reports/state-exposure — query param validation", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({
      error: null,
      user: { id: "u-admin", role: "ADMIN" },
    });
    mockFindMany.mockResolvedValue([]);
  });

  test("returns 400 for invalid type param", async () => {
    const res = await GET(makeRequest({ type: "INVALID_TYPE" }));
    expect(res.status).toBe(400);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  test("returns 400 for invalid status param", async () => {
    const res = await GET(makeRequest({ status: "RELEASED" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 for non-numeric limit", async () => {
    const res = await GET(makeRequest({ limit: "abc" }));
    expect(res.status).toBe(400);
  });

  test("accepts valid type=FDR", async () => {
    mockFindMany.mockResolvedValue([]);
    const res = await GET(makeRequest({ type: "FDR" }));
    expect(res.status).toBe(200);
  });

  test("accepts valid status=ACTIVE", async () => {
    const res = await GET(makeRequest({ status: "ACTIVE" }));
    expect(res.status).toBe(200);
  });
});

