import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";
import type { Role } from "@/lib/validations";

// Only bureau-level roles can see cross-institution state data
const ALLOWED_ROLES: Role[] = ["SCRUTINY_OFFICER", "APPROVING_AUTHORITY", "ADMIN"];

// Statuses that represent live exposure (instruments still on the hook)
const LIVE_STATUSES = ["ACTIVE", "EXPIRING_SOON", "VERIFIED", "SUBMITTED", "MISMATCH"];

const QuerySchema = z.object({
  status: z.enum(["ACTIVE", "EXPIRING_SOON", "VERIFIED", "SUBMITTED", "MISMATCH"]).optional(),
  bank: z.string().min(1).max(200).optional(),
  type: z.enum(["FDR", "SECURITY_DEPOSIT"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(10),
});

export async function GET(req: Request) {
  const { error, user } = await requireAuth(req, ALLOWED_ROLES);
  if (error) return error;

  // Parse & validate query params
  const url = new URL(req.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());
  const parsed = QuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { status, bank, type, limit } = parsed.data;

  // Build Prisma where clause (typed loosely because the extended PrismaClient
  // changes the generic signature; the shape is correct at runtime)
  const statusFilter = status ? [status] : LIVE_STATUSES;
  const where = {
    status: { in: statusFilter },
    ...(type ? { type } : {}),
    ...(bank ? { bankName: { contains: bank } } : {}),
  };

  // Fetch instruments with their institution's state
  const instruments = await prisma.instrument.findMany({
    where,
    select: {
      id: true,
      amount: true,
      status: true,
      maturityDate: true,
      institutionId: true,
      institution: {
        select: { state: true, id: true },
      },
    },
  });

  // Aggregate by state
  const now = new Date();
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

  // Convert to array, sort, slice
  const sorted = Array.from(stateMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit);

  const data = sorted.map((entry) => ({
    state: entry.state,
    totalAmount: entry.totalAmount,
    totalCrores: parseFloat((entry.totalAmount / 10_000_000).toFixed(2)),
    instrumentCount: entry.instrumentIds.size,
    institutionCount: entry.institutionIds.size,
    expiringIn30Days: entry.expiringIn30Days,
    mismatchCount: entry.mismatchCount,
  }));

  return NextResponse.json(
    {
      data,
      meta: {
        totalStates: stateMap.size,
        returnedStates: data.length,
        limit,
        filters: { status: status ?? null, bank: bank ?? null, type: type ?? null },
        generatedAt: now.toISOString(),
        requestedBy: { id: user.id, role: user.role },
      },
    },
    { status: 200 }
  );
}

