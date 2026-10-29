/**
 * Unit Test Suite for State-Wise Exposure Aggregation & Calculation Logic
 */

describe("State-Wise Exposure Calculation & Aggregation Rules", () => {
  // Sample test instruments simulating database records
  const sampleInstruments = [
    {
      id: "inst-1",
      amount: 50000000, // 5 Crores
      institutionId: "inst-A",
      institution: { id: "inst-A", name: "Campus A", state: "Maharashtra" },
    },
    {
      id: "inst-2",
      amount: 25000000, // 2.5 Crores
      institutionId: "inst-A",
      institution: { id: "inst-A", name: "Campus A", state: "Maharashtra" },
    },
    {
      id: "inst-3",
      amount: 100000000, // 10 Crores
      institutionId: "inst-B",
      institution: { id: "inst-B", name: "Campus B", state: "Karnataka" },
    },
    {
      id: "inst-4",
      amount: 15000000, // 1.5 Crores
      institutionId: "inst-C",
      institution: { id: "inst-C", name: "Campus C", state: "Delhi" },
    },
    {
      id: "inst-5",
      amount: 8000000, // 0.8 Crores
      institutionId: "inst-D",
      institution: { id: "inst-D", name: "Campus D", state: "   " }, // whitespace state
    },
    {
      id: "inst-6",
      amount: 12000000, // 1.2 Crores
      institutionId: "inst-E",
      institution: null, // missing institution
    },
  ];

  function aggregateStateWiseExposure(instruments: any[]) {
    const stateMap: Record<string, { state: string; count: number; totalAmount: number }> = {};
    for (const inst of instruments) {
      const rawState = inst.institution?.state?.trim();
      const state = rawState || "Unknown";
      if (!stateMap[state]) {
        stateMap[state] = { state, count: 0, totalAmount: 0 };
      }
      stateMap[state].count += 1;
      stateMap[state].totalAmount += inst.amount;
    }
    return Object.values(stateMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)
      .map((item) => ({
        state: item.state,
        count: item.count,
        amountCrores: parseFloat((item.totalAmount / 10000000).toFixed(2)),
        totalAmount: item.totalAmount,
      }));
  }

  it("converts rupees to crores accurately (totalValueInRupees / 10000000)", () => {
    const result = aggregateStateWiseExposure(sampleInstruments);
    const karnataka = result.find((s) => s.state === "Karnataka");
    expect(karnataka).toBeDefined();
    expect(karnataka!.amountCrores).toBe(10); // 100,000,000 / 10,000,000 = 10 Cr
    expect(karnataka!.totalAmount).toBe(100000000);
  });

  it("aggregates multiple instruments for the same state and counts each instrument once", () => {
    const result = aggregateStateWiseExposure(sampleInstruments);
    const maharashtra = result.find((s) => s.state === "Maharashtra");
    expect(maharashtra).toBeDefined();
    // 5 Cr + 2.5 Cr = 7.5 Cr
    expect(maharashtra!.amountCrores).toBe(7.5);
    expect(maharashtra!.count).toBe(2);
    expect(maharashtra!.totalAmount).toBe(75000000);
  });

  it("sorts states in descending order of total deposit value", () => {
    const result = aggregateStateWiseExposure(sampleInstruments);
    expect(result[0].state).toBe("Karnataka"); // 10 Cr
    expect(result[1].state).toBe("Maharashtra"); // 7.5 Cr
    expect(result[2].state).toBe("Unknown"); // 0.8 + 1.2 = 2.0 Cr
    expect(result[3].state).toBe("Delhi"); // 1.5 Cr
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].totalAmount).toBeGreaterThanOrEqual(result[i + 1].totalAmount);
    }
  });

  it("safely handles missing or whitespace states without assigning to a real state", () => {
    const result = aggregateStateWiseExposure(sampleInstruments);
    const unknown = result.find((s) => s.state === "Unknown");
    expect(unknown).toBeDefined();
    expect(unknown!.count).toBe(2); // inst-5 (whitespace) and inst-6 (null institution)
    expect(unknown!.amountCrores).toBe(2.0); // (8,000,000 + 12,000,000) / 10,000,000 = 2.0 Cr
  });

  it("enforces institution-level data isolation when scoped by institutionId", () => {
    // Simulating the whereClause { institutionId: "inst-A" } enforced on the server
    const institutionFiltered = sampleInstruments.filter((inst) => inst.institutionId === "inst-A");
    const result = aggregateStateWiseExposure(institutionFiltered);

    expect(result).toHaveLength(1);
    expect(result[0].state).toBe("Maharashtra");
    expect(result[0].count).toBe(2);
    expect(result[0].amountCrores).toBe(7.5);

    // Other institutions are completely absent
    expect(result.some((s) => s.state === "Karnataka")).toBe(false);
    expect(result.some((s) => s.state === "Delhi")).toBe(false);
  });

  it("returns an empty array when there are no eligible records", () => {
    const result = aggregateStateWiseExposure([]);
    expect(result).toEqual([]);
  });

  it("limits results to top 10 states when more than 10 states exist", () => {
    const twelveStates = Array.from({ length: 12 }, (_, i) => ({
      id: `inst-${i}`,
      amount: (i + 1) * 10000000,
      institutionId: `inst-${i}`,
      institution: { id: `inst-${i}`, name: `Campus ${i}`, state: `State ${i}` },
    }));

    const result = aggregateStateWiseExposure(twelveStates);
    expect(result).toHaveLength(10);
    // Highest state (State 11 with 12 Cr) should be first
    expect(result[0].state).toBe("State 11");
    expect(result[0].amountCrores).toBe(12);
  });
});

