import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";

const PAGE_SIZE = 25;

/**
 * GET /api/instruments
 *
 * Query params:
 *   page       – 1-based page number (default 1)
 *   sortBy     – "maturityDate" | "amount" (default "maturityDate")
 *   sortDir    – "asc" | "desc" (default "asc")
 *   status     – one of the InstrumentStatus enum values
 *   type       – "FDR" | "SECURITY_DEPOSIT"
 *   state      – institution state string
 *   institution – institutionId UUID
 *   maturity   – "7" | "30" | "60" | "90" | "overdue"
 *   openDiscrepancy – "true" to filter only instruments with ≥1 open discrepancy
 *   search     – substring match on referenceNumber or bankName (case-insensitive)
 */
export async function GET(req: Request) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);

  // Pagination
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  // Sorting
  const sortBy = searchParams.get("sortBy") === "amount" ? "amount" : "maturityDate";
  const sortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";

  // Filters
  const statusFilter = searchParams.get("status") || undefined;
  const typeFilter = searchParams.get("type") || undefined;
  const stateFilter = searchParams.get("state") || undefined;
  const institutionFilter = searchParams.get("institution") || undefined;
  const maturityFilter = searchParams.get("maturity") || undefined;
  const openDiscrepancy = searchParams.get("openDiscrepancy") === "true";
  const search = searchParams.get("search") || undefined;

  // Build where clause
  const whereClause: any = {};

  // Institution scoping – Institution users can only see their own rows (ENFORCED SERVER-SIDE)
  if (user.role === "INSTITUTION") {
    if (!user.institutionId) {
      return NextResponse.json(
        { error: "Institution user has no linked institution" },
        { status: 400 }
      );
    }
    whereClause.institutionId = user.institutionId;
  } else {
    // Non-institution users can optionally filter by institution
    if (institutionFilter) {
      whereClause.institutionId = institutionFilter;
    }
  }

  if (statusFilter) whereClause.status = statusFilter;
  if (typeFilter) whereClause.type = typeFilter;

  // State filter via institution relation
  if (stateFilter) {
    whereClause.institution = { state: stateFilter };
  }

  // Maturity window filter
  if (maturityFilter) {
    const now = new Date();
    if (maturityFilter === "overdue") {
      whereClause.maturityDate = { lt: now };
    } else {
      const days = parseInt(maturityFilter, 10);
      if (!isNaN(days)) {
        const future = new Date(now);
        future.setDate(future.getDate() + days);
        whereClause.maturityDate = { gte: now, lte: future };
      }
    }
  }

  // Open discrepancy filter
  if (openDiscrepancy) {
    whereClause.discrepancies = {
      some: { status: "OPEN" },
    };
  }

  // Text search on referenceNumber or bankName (SQLite: use contains, case-insensitive via mode)
  if (search) {
    whereClause.OR = [
      { referenceNumber: { contains: search } },
      { bankName: { contains: search } },
    ];
  }

  const [total, instruments] = await Promise.all([
    prisma.instrument.count({ where: whereClause }),
    prisma.instrument.findMany({
      where: whereClause,
      include: {
        institution: { select: { id: true, aicteId: true, name: true, state: true } },
        discrepancies: {
          where: { status: "OPEN" },
          select: { id: true },
        },
      },
      orderBy: { [sortBy]: sortDir },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  // Compute days to maturity
  const now = new Date();
  const instrumentsWithDays = instruments.map((inst) => {
    const maturityDate = new Date(inst.maturityDate);
    const diffMs = maturityDate.getTime() - now.getTime();
    const daysToMaturity = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return {
      ...inst,
      daysToMaturity,
      openDiscrepancyCount: inst.discrepancies.length,
    };
  });

  return NextResponse.json({
    userRole: user.role,
    userInstitutionId: user.institutionId,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    count: instrumentsWithDays.length,
    instruments: instrumentsWithDays,
  });
}
