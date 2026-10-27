import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";
import { AuditService } from "@/lib/audit";

/**
 * POST /api/instruments/[id]/release-action
 *
 * Handles administrative actions on an instrument release request:
 *
 * 1. SCRUTINY_APPROVE:
 *    - Role: SCRUTINY_OFFICER or ADMIN (others get 403)
 *    - Requires checklist of 3 booleans, all true
 *    - Transitions release request to SCRUTINY_APPROVED
 *
 * 2. FINAL_APPROVE:
 *    - Role: APPROVING_AUTHORITY or ADMIN (others get 403)
 *    - Transitions release request to FINAL_APPROVED
 *    - Transitions the instrument status to RELEASED
 *
 * 3. REJECT:
 *    - Role: SCRUTINY_OFFICER, APPROVING_AUTHORITY, or ADMIN (others get 403)
 *    - Requires non-empty rejection note
 *    - Transitions release request to REJECTED
 *
 * Append-only AuditLog recorded for all actions.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  const { id } = await params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, checklist, note, remarks } = body;

  if (!action || !["SCRUTINY_APPROVE", "FINAL_APPROVE", "REJECT"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Supported: SCRUTINY_APPROVE, FINAL_APPROVE, REJECT" },
      { status: 400 }
    );
  }

  const instrument = await prisma.instrument.findUnique({
    where: { id },
  });

  if (!instrument) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  // Find the active release request for this instrument
  const releaseRequest = await prisma.releaseRequest.findFirst({
    where: {
      instrumentId: instrument.id,
      status: { in: ["PENDING_SCRUTINY", "SCRUTINY_APPROVED", "SUBMITTED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!releaseRequest) {
    return NextResponse.json(
      { error: "No active release request found for this instrument." },
      { status: 404 }
    );
  }

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  // ─── ACTION 1: SCRUTINY_APPROVE ──────────────────────────────────────────
  if (action === "SCRUTINY_APPROVE") {
    if (user.role !== "SCRUTINY_OFFICER" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: `Forbidden: Role '${user.role}' cannot perform Scrutiny Approval.` },
        { status: 403 }
      );
    }

    // Validate 3 boolean checklist items
    let checklistValid = false;
    if (Array.isArray(checklist)) {
      checklistValid = checklist.length === 3 && checklist.every((item) => item === true);
    } else if (checklist && typeof checklist === "object") {
      const values = Object.values(checklist);
      checklistValid = values.length >= 3 && values.slice(0, 3).every((item) => item === true);
    }

    if (!checklistValid) {
      return NextResponse.json(
        {
          error:
            "Scrutiny approval requires a checklist of 3 items (original FDR surrendered, no dues clearance, lock-in period compliance) all confirmed true.",
        },
        { status: 400 }
      );
    }

    const updatedRequest = await prisma.releaseRequest.update({
      where: { id: releaseRequest.id },
      data: {
        status: "SCRUTINY_APPROVED",
        remarks: remarks || releaseRequest.remarks,
      },
    });

    try {
      await AuditService.log({
        action: "SCRUTINY_APPROVE",
        entity: "ReleaseRequest",
        entityId: releaseRequest.id,
        performedById: user.id,
        ip: clientIp,
        before: { status: releaseRequest.status },
        after: {
          status: "SCRUTINY_APPROVED",
          instrumentId: instrument.id,
          checklistVerified: true,
        },
      });
    } catch (e) {
      console.error("Audit log error on scrutiny approve:", e);
    }

    return NextResponse.json({
      success: true,
      action: "SCRUTINY_APPROVE",
      releaseRequest: updatedRequest,
    });
  }

  // ─── ACTION 2: FINAL_APPROVE ─────────────────────────────────────────────
  if (action === "FINAL_APPROVE") {
    if (user.role !== "APPROVING_AUTHORITY" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: `Forbidden: Role '${user.role}' cannot perform Final Approval.` },
        { status: 403 }
      );
    }

    const updatedRequest = await prisma.releaseRequest.update({
      where: { id: releaseRequest.id },
      data: {
        status: "FINAL_APPROVED",
      },
    });

    // Set the instrument status to RELEASED
    const updatedInstrument = await prisma.instrument.update({
      where: { id: instrument.id },
      data: {
        status: "RELEASED",
      },
    });

    try {
      await AuditService.log({
        action: "FINAL_APPROVE",
        entity: "ReleaseRequest",
        entityId: releaseRequest.id,
        performedById: user.id,
        ip: clientIp,
        before: {
          releaseStatus: releaseRequest.status,
          instrumentStatus: instrument.status,
        },
        after: {
          releaseStatus: "FINAL_APPROVED",
          instrumentStatus: "RELEASED",
          instrumentId: instrument.id,
        },
      });
    } catch (e) {
      console.error("Audit log error on final approve:", e);
    }

    return NextResponse.json({
      success: true,
      action: "FINAL_APPROVE",
      releaseRequest: updatedRequest,
      instrument: updatedInstrument,
    });
  }

  // ─── ACTION 3: REJECT ────────────────────────────────────────────────────
  if (action === "REJECT") {
    if (
      user.role !== "SCRUTINY_OFFICER" &&
      user.role !== "APPROVING_AUTHORITY" &&
      user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: `Forbidden: Role '${user.role}' cannot reject release requests.` },
        { status: 403 }
      );
    }

    const rejectionNote = (note || remarks || "").trim();
    if (!rejectionNote) {
      return NextResponse.json(
        { error: "A rejection note is required explaining why the release request was rejected." },
        { status: 400 }
      );
    }

    const updatedRequest = await prisma.releaseRequest.update({
      where: { id: releaseRequest.id },
      data: {
        status: "REJECTED",
        remarks: rejectionNote,
      },
    });

    try {
      await AuditService.log({
        action: "REJECT",
        entity: "ReleaseRequest",
        entityId: releaseRequest.id,
        performedById: user.id,
        ip: clientIp,
        before: { status: releaseRequest.status },
        after: {
          status: "REJECTED",
          instrumentId: instrument.id,
          rejectionNote,
        },
      });
    } catch (e) {
      console.error("Audit log error on release rejection:", e);
    }

    return NextResponse.json({
      success: true,
      action: "REJECT",
      releaseRequest: updatedRequest,
    });
  }

  return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
}
