import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";

/**
 * GET /api/instruments/[id]
 *
 * Returns full detail of a single instrument with:
 *   - institution
 *   - documents (each with all versions, uploader, sha256, size)
 *   - verifications (all, latest first, with submitted vs bank data)
 *   - discrepancies (all)
 *   - renewal chain (parent chain via parentId)
 *   - auditLogs for this instrument
 *
 * Institution users get 403 if instrument belongs to another institution.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  const instrument = await prisma.instrument.findUnique({
    where: { id: params.id },
    include: {
      institution: {
        select: { id: true, aicteId: true, name: true, state: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
      documents: {
        orderBy: { createdAt: "asc" },
        include: {
          versions: {
            orderBy: { version: "asc" },
            include: {
              uploadedBy: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      },
      verifications: {
        orderBy: { requestedAt: "desc" },
        include: {
          discrepancies: true,
        },
      },
      discrepancies: {
        orderBy: { detectedAt: "desc" },
      },
      // Renewal chain: immediate parent and children
      parent: {
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          maturityDate: true,
        },
      },
      children: {
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          maturityDate: true,
        },
        orderBy: { createdAt: "asc" },
      },
      releaseRequests: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!instrument) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  // Institution scoping enforcement: 403 for another institution's instrument
  if (
    user.role === "INSTITUTION" &&
    instrument.institutionId !== user.institutionId
  ) {
    return NextResponse.json(
      { error: "Forbidden: this instrument belongs to another institution" },
      { status: 403 }
    );
  }

  // Fetch audit logs for this instrument
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entity: "Instrument", entityId: instrument.id },
        { entity: "Verification", entityId: { in: instrument.verifications.map((v) => v.id) } },
        { entity: "Discrepancy", entityId: { in: instrument.discrepancies.map((d) => d.id) } },
      ],
    },
    orderBy: { timestamp: "desc" },
    take: 100,
    include: {
      performedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  // Compute days to maturity
  const now = new Date();
  const maturityDate = new Date(instrument.maturityDate);
  const daysToMaturity = Math.ceil(
    (maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return NextResponse.json({
    instrument: {
      ...instrument,
      daysToMaturity,
      openDiscrepancyCount: instrument.discrepancies.filter((d) => d.status === "OPEN").length,
    },
    auditLogs,
  });
}
