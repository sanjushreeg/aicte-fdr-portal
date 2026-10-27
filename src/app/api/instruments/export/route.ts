import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * GET /api/instruments/export
 *
 * Exports matching instruments as a CSV file.
 * Strictly respects institution scoping for INSTITUTION role users.
 */
export async function GET(req: Request) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const isInstitution = user.role === "INSTITUTION";

  const statusFilter = searchParams.get("status") || undefined;
  const typeFilter = searchParams.get("type") || undefined;
  const stateFilter = searchParams.get("state") || undefined;
  const institutionFilter = searchParams.get("institution") || undefined;
  const maturityFilter = searchParams.get("maturity") || undefined;
  const openDiscrepancy = searchParams.get("openDiscrepancy") === "true";
  const search = searchParams.get("search") || undefined;

  const whereClause: any = {};

  // Strict institution scoping
  if (user.role === "INSTITUTION") {
    if (!user.institutionId) {
      return NextResponse.json(
        { error: "Institution user has no linked institution" },
        { status: 400 }
      );
    }
    whereClause.institutionId = user.institutionId;
  } else if (institutionFilter) {
    whereClause.institutionId = institutionFilter;
  }

  if (statusFilter) whereClause.status = statusFilter;
  if (typeFilter) whereClause.type = typeFilter;

  if (stateFilter) {
    whereClause.institution = { state: stateFilter };
  }

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

  if (openDiscrepancy) {
    whereClause.discrepancies = {
      some: { status: "OPEN" },
    };
  }

  if (search) {
    whereClause.OR = [
      { referenceNumber: { contains: search } },
      { bankName: { contains: search } },
    ];
  }

  const instruments = await prisma.instrument.findMany({
    where: whereClause,
    include: {
      institution: {
        select: {
          aicteId: true,
          name: true,
          state: true,
        },
      },
      discrepancies: {
        where: { status: "OPEN" },
        select: { id: true, code: true, severity: true },
      },
    },
    orderBy: { maturityDate: "asc" },
  });

  const now = new Date();
  const headers = [
    "Reference Number",
    "AICTE Institution ID",
    "Institution Name",
    "State",
    "Instrument Type",
    "Bank Name",
    "Branch",
    "Amount (INR)",
    "Issue Date",
    "Maturity Date",
    "Days to Maturity",
    "Status",
    "Bank Verified",
    "Open Discrepancies Count",
    "Open Discrepancy Codes",
  ];

  const rows = instruments.map((inst) => {
    const matDate = new Date(inst.maturityDate);
    const diffMs = matDate.getTime() - now.getTime();
    const daysToMaturity = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const codes = inst.discrepancies.map((d) => d.code).join("; ");

    return [
      escapeCsvField(inst.referenceNumber),
      escapeCsvField(inst.institution?.aicteId || ""),
      escapeCsvField(inst.institution?.name || ""),
      escapeCsvField(inst.institution?.state || ""),
      escapeCsvField(inst.type),
      escapeCsvField(inst.bankName),
      escapeCsvField(inst.bankBranch),
      escapeCsvField(inst.amount.toFixed(2)),
      escapeCsvField(inst.issueDate ? new Date(inst.issueDate).toISOString().slice(0, 10) : ""),
      escapeCsvField(inst.maturityDate ? new Date(inst.maturityDate).toISOString().slice(0, 10) : ""),
      escapeCsvField(daysToMaturity),
      escapeCsvField(inst.status),
      escapeCsvField(inst.verifiedByBank ? "YES" : "NO"),
      escapeCsvField(inst.discrepancies.length),
      escapeCsvField(codes),
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\r\n");

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = isInstitution
    ? `aicte_instruments_${user.institutionId || "inst"}_${dateStr}.csv`
    : `aicte_instruments_bureau_${dateStr}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
