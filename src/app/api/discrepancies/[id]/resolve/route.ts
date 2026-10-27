import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";
import { AuditService } from "@/lib/audit";

const ALLOWED_ROLES = ["SCRUTINY_OFFICER", "APPROVING_AUTHORITY", "ADMIN"] as const;

/**
 * POST /api/discrepancies/[id]/resolve
 *
 * Sets discrepancy status to RESOLVED or WAIVED, recording resolvedAt, resolvedById,
 * and a required resolution note.
 * If no open discrepancies remain on the instrument, flips the instrument status to VERIFIED.
 * Logs an append-only AuditLog record for the resolution event.
 *
 * Restricted to SCRUTINY_OFFICER, APPROVING_AUTHORITY, and ADMIN.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(req, ALLOWED_ROLES as any);
  if (error) return error;

  // Next.js 16: params is a Promise
  const { id } = await params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const { status = "RESOLVED", note } = body;

  if (!note || typeof note !== "string" || !note.trim()) {
    return NextResponse.json(
      { error: "A non-empty resolution note is required" },
      { status: 400 }
    );
  }

  const targetStatus = status === "WAIVED" ? "WAIVED" : "RESOLVED";

  const discrepancy = await prisma.discrepancy.findUnique({
    where: { id },
    include: { instrument: true },
  });

  if (!discrepancy) {
    return NextResponse.json({ error: "Discrepancy not found" }, { status: 404 });
  }

  // Parse existing JSON details payload and append resolution details
  let detailsObj: any = {};
  try {
    detailsObj = JSON.parse(discrepancy.details);
  } catch {
    detailsObj = {};
  }
  detailsObj.resolutionNote = note.trim();
  detailsObj.resolutionAction = targetStatus;

  const resolvedAt = new Date();

  // 1. Update discrepancy status and metadata
  const updatedDiscrepancy = await prisma.discrepancy.update({
    where: { id },
    data: {
      status: targetStatus,
      resolvedAt,
      resolvedById: user.id,
      details: JSON.stringify(detailsObj),
    },
  });

  // 2. Check if all open discrepancies for the instrument are now cleared
  const remainingOpen = await prisma.discrepancy.count({
    where: {
      instrumentId: discrepancy.instrumentId,
      status: "OPEN",
    },
  });

  let instrumentStatus = discrepancy.instrument.status;
  if (remainingOpen === 0) {
    const updatedInstrument = await prisma.instrument.update({
      where: { id: discrepancy.instrumentId },
      data: {
        status: "VERIFIED",
      },
    });
    instrumentStatus = updatedInstrument.status;
  }

  // 3. Write AuditLog entry
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  try {
    await AuditService.log({
      action: targetStatus === "WAIVED" ? "WAIVE" : "RESOLVE",
      entity: "Discrepancy",
      entityId: discrepancy.id,
      performedById: user.id,
      ip: clientIp,
      before: { status: discrepancy.status },
      after: {
        status: targetStatus,
        note: note.trim(),
        instrumentId: discrepancy.instrumentId,
        instrumentStatus,
      },
    });
  } catch (e) {
    console.error("Audit log error on discrepancy resolve:", e);
  }

  return NextResponse.json({
    discrepancy: updatedDiscrepancy,
    instrumentStatus,
    remainingOpenCount: remainingOpen,
  });
}
