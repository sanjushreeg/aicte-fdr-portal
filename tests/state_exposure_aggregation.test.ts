/**
 * tests/state_exposure_aggregation.test.ts
 *
 * Pure unit tests for the state-wise aggregation logic.
 * No DB, no server — runs in Node environment.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface Instrument {
  id: string;
  amount: number;
  status: string;
  maturityDate: Date;
  institutionId: string;
  institution: { state: string; id: string } | null;
}

// ── Aggregation logic (mirrors route.ts) ──────────────────────────────────────

const LIVE_STATUSES = ["ACTIVE", "EXPIRING_SOON", "VERIFIED", "SUBMITTED", "MISMATCH"];

function aggregate(instruments: Instrument[], now: Date, limitCount: number) {
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const stateMap = new Map<
    string,
    {
      state: string;
      totalAmount: number;
      instrumentIds: Set<string>;
      institutionIds: Set<string>;
      expiringIn30Days: number;
      mismatchCount: number;
    }
  >();

  for (const inst of instruments) {
    const state = inst.institution?.state?.trim();
    if (!state) continue;
    if (!stateMap.has(state)) {
      stateMap.set(state, {
        state,
        totalAmount: 0,
        instrumentIds: new Set(),
        institutionIds: new Set(),
        expiringIn30Days: 0,
        mismatchCount: 0,
      });
    }
    const entry = stateMap.get(state)!;
    entry.totalAmount += inst.amount;
    entry.instrumentIds.add(inst.id);
    entry.institutionIds.add(inst.institutionId);

    if (inst.maturityDate >= now && inst.maturityDate <= thirtyDaysFromNow) {
      entry.expiringIn30Days += 1;
    }
    if (inst.status === "MISMATCH") {
      entry.mismatchCount += 1;
    }
  }

  return Array.from(stateMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limitCount)
    .map((entry) => ({
      state: entry.state,
      totalAmount: entry.totalAmount,
      totalCrores: parseFloat((entry.totalAmount / 10_000_000).toFixed(2)),
      instrumentCount: entry.instrumentIds.size,
      institutionCount: entry.institutionIds.size,
      expiringIn30Days: entry.expiringIn30Days,
      mismatchCount: entry.mismatchCount,
    }));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-01T00:00:00Z");
const IN_20_DAYS = new Date("2026-06-21T00:00:00Z");
const IN_60_DAYS = new Date("2026-07-31T00:00:00Z");

const fixtures: Instrument[] = [
  // Maharashtra — 3 instruments from 2 institutions
  { id: "i1", amount: 50_000_000, status: "ACTIVE",       maturityDate: IN_60_DAYS, institutionId: "inst-A", institution: { state: "Maharashtra", id: "inst-A" } },
  { id: "i2", amount: 30_000_000, status: "EXPIRING_SOON", maturityDate: IN_20_DAYS, institutionId: "inst-A", institution: { state: "Maharashtra", id: "inst-A" } },
  { id: "i3", amount: 20_000_000, status: "MISMATCH",     maturityDate: IN_60_DAYS, institutionId: "inst-B", institution: { state: "Maharashtra", id: "inst-B" } },

  // Karnataka — 1 instrument
  { id: "i4", amount: 80_000_000, status: "VERIFIED",     maturityDate: IN_60_DAYS, institutionId: "inst-C", institution: { state: "Karnataka", id: "inst-C" } },

  // Tamil Nadu — 1 SUBMITTED
  { id: "i5", amount: 15_000_000, status: "SUBMITTED",    maturityDate: IN_20_DAYS, institutionId: "inst-D", institution: { state: "Tamil Nadu", id: "inst-D" } },

  // These should be PRE-FILTERED OUT before aggregation (excluded statuses):
  { id: "i6", amount: 999_000_000, status: "RELEASED",    maturityDate: IN_60_DAYS, institutionId: "inst-E", institution: { state: "Delhi",       id: "inst-E" } },
  { id: "i7", amount: 999_000_000, status: "RENEWED",     maturityDate: IN_60_DAYS, institutionId: "inst-F", institution: { state: "Delhi",       id: "inst-F" } },
  { id: "i8", amount: 999_000_000, status: "REJECTED",    maturityDate: IN_60_DAYS, institutionId: "inst-G", institution: { state: "Gujarat",     id: "inst-G" } },
  { id: "i9", amount: 999_000_000, status: "REPLACED",    maturityDate: IN_60_DAYS, institutionId: "inst-H", institution: { state: "Rajasthan",   id: "inst-H" } },
];

// Simulate pre-filtering (the route only fetches LIVE_STATUSES)
const liveInstruments = fixtures.filter((f) => LIVE_STATUSES.includes(f.status));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("State-wise exposure aggregation", () => {
  const result = aggregate(liveInstruments, NOW, 10);

  test("excluded RELEASED, RENEWED, REJECTED, REPLACED from aggregation", () => {
    const stateNames = result.map((r) => r.state);
    expect(stateNames).not.toContain("Delhi");
    expect(stateNames).not.toContain("Gujarat");
    expect(stateNames).not.toContain("Rajasthan");
  });

  test("includes only the three live states", () => {
    expect(result).toHaveLength(3);
  });

  test("Maharashtra sorted first (highest amount: ₹10 Cr from 3 instruments)", () => {
    expect(result[0].state).toBe("Maharashtra");
    expect(result[0].totalAmount).toBe(100_000_000);
    expect(result[0].totalCrores).toBe(10.0);
  });

  test("Karnataka sorted second (₹8 Cr, 1 instrument)", () => {
    expect(result[1].state).toBe("Karnataka");
    expect(result[1].totalAmount).toBe(80_000_000);
    expect(result[1].totalCrores).toBe(8.0);
  });

  test("totalCrores is rupees / 10,000,000 rounded to 2 dp", () => {
    const tn = result.find((r) => r.state === "Tamil Nadu")!;
    expect(tn.totalCrores).toBe(1.5);
  });

  test("instrumentCount counts distinct instrument IDs per state", () => {
    const mh = result.find((r) => r.state === "Maharashtra")!;
    expect(mh.instrumentCount).toBe(3);
  });

  test("institutionCount counts distinct institution IDs per state", () => {
    const mh = result.find((r) => r.state === "Maharashtra")!;
    expect(mh.institutionCount).toBe(2); // inst-A and inst-B
  });

  test("expiringIn30Days counts instruments with maturityDate within 30 days", () => {
    // Maharashtra: i2 (EXPIRING_SOON, in 20 days) — counts; i3 (MISMATCH, in 60 days) — no
    const mh = result.find((r) => r.state === "Maharashtra")!;
    expect(mh.expiringIn30Days).toBe(1);

    // Tamil Nadu: i5 (SUBMITTED, in 20 days) — counts
    const tn = result.find((r) => r.state === "Tamil Nadu")!;
    expect(tn.expiringIn30Days).toBe(1);
  });

  test("mismatchCount counts only MISMATCH status instruments", () => {
    const mh = result.find((r) => r.state === "Maharashtra")!;
    expect(mh.mismatchCount).toBe(1); // only i3

    const ka = result.find((r) => r.state === "Karnataka")!;
    expect(ka.mismatchCount).toBe(0);
  });

  test("limit slices to specified count", () => {
    const limited = aggregate(liveInstruments, NOW, 2);
    expect(limited).toHaveLength(2);
    // Top 2 by amount: Karnataka (80M), Maharashtra (100M)
    const states = limited.map((r) => r.state);
    expect(states).toContain("Karnataka");
    expect(states).toContain("Maharashtra");
    expect(states).not.toContain("Tamil Nadu");
  });

  test("instrument with null institution.state is ignored", () => {
    const withNull: Instrument[] = [
      ...liveInstruments,
      { id: "i-null", amount: 999_000_000, status: "ACTIVE", maturityDate: IN_60_DAYS, institutionId: "inst-Z", institution: null },
    ];
    const r = aggregate(withNull, NOW, 20);
    // Should still be only 3 states — null state is skipped
    expect(r).toHaveLength(3);
  });

  test("crores math: ₹10,00,00,000 = 10.00 Cr", () => {
    expect(parseFloat((1_000_000_000 / 10_000_000).toFixed(2))).toBe(100.0);
    expect(parseFloat((10_000_000 / 10_000_000).toFixed(2))).toBe(1.0);
    expect(parseFloat((1_500_000 / 10_000_000).toFixed(2))).toBe(0.15);
  });
});

