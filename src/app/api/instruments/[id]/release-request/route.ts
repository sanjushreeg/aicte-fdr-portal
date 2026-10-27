import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";
import { AuditService } from "@/lib/audit";

/**
 * POST /api/instruments/[id]/release-request
 *
 * Initiates a release request for an instrument with status PENDING_SCRUTINY.
 * Restricted to the owning institution user.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(req, ["INSTITUTION"]);
  if (error) return error;

  const { id } = await params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const instrument = await prisma.instrument.findUnique({
    where: { id },
  });

  if (!instrument) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  // Enforce institution ownership
  if (user.institutionId !== instrument.institutionId) {
    return NextResponse.json(
      { error: "Forbidden: You may only request release for instruments owned by your institution." },
      { status: 403 }
    );
  }

  // Prevent duplicate open release requests
  const existingPending = await prisma.releaseRequest.findFirst({
    where: {
      instrumentId: instrument.id,
      status: { in: ["PENDING_SCRUTINY", "SCRUTINY_APPROVED", "SUBMITTED"] },
    },
  });

  if (existingPending) {
    return NextResponse.json(
      { error: "A release request is already active for this instrument." },
      { status: 400 }
    );
  }

  const remarks = body?.remarks?.trim() || "Obligations completed; release requested by institution.";

  const releaseRequest = await prisma.releaseRequest.create({
    data: {
      instrumentId: instrument.id,
      requestedById: user.id,
      status: "PENDING_SCRUTINY",
      remarks,
    },
  });

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  try {
    await AuditService.log({
      action: "CREATE",
      entity: "ReleaseRequest",
      entityId: releaseRequest.id,
      performedById: user.id,
      ip: clientIp,
      after: {
        instrumentId: instrument.id,
        status: "PENDING_SCRUTINY",
        remarks,
      },
    });
  } catch (e) {
    console.error("Audit log error on release request creation:", e);
  }

  return NextResponse.json({
    message: "Release request submitted successfully.",
    releaseRequest,
  });
}
