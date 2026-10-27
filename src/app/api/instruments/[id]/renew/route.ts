import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";
import { AuditService } from "@/lib/audit";

/**
 * POST /api/instruments/[id]/renew
 *
 * Renews an existing instrument:
 * - Creates a new instrument with parentId = old id, status SUBMITTED,
 *   and new referenceNumber & maturityDate from the request body.
 * - Transitions the old instrument's status to RENEWED.
 * - Records an append-only AuditLog entry.
 *
 * Restricted to Institution Owner (matching institutionId) or ADMIN.
 * Always returns a JSON response with appropriate status code.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth(req);
    if (error) return error;

    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Instrument ID is required." }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { referenceNumber, maturityDate, amount, bankName, bankBranch, issueDate } = body;

    if (!referenceNumber || typeof referenceNumber !== "string" || !referenceNumber.trim()) {
      return NextResponse.json({ error: "New reference number is required" }, { status: 400 });
    }

    if (!maturityDate) {
      return NextResponse.json({ error: "New maturity date is required" }, { status: 400 });
    }

    const parsedMaturity = new Date(maturityDate);
    if (isNaN(parsedMaturity.getTime())) {
      return NextResponse.json({ error: "Invalid maturity date format" }, { status: 400 });
    }

    // Look up instrument by primary key UUID; fall back to referenceNumber if accessed by reference
    let oldInstrument = await prisma.instrument.findUnique({
      where: { id },
    });

    if (!oldInstrument) {
      if (user.role === "INSTITUTION" && user.institutionId) {
        oldInstrument = await prisma.instrument.findFirst({
          where: {
            referenceNumber: id,
            institutionId: user.institutionId,
          },
        });
      } else {
        oldInstrument = await prisma.instrument.findFirst({
          where: { referenceNumber: id },
        });
      }
    }

    if (!oldInstrument) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
    }

    // Authorization check: Institution owner or ADMIN
    if (user.role === "INSTITUTION") {
      if (user.institutionId !== oldInstrument.institutionId) {
        return NextResponse.json(
          { error: "Forbidden: You may only renew instruments belonging to your institution." },
          { status: 403 }
        );
      }
    } else if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only institution owners or ADMIN can renew instruments." },
        { status: 403 }
      );
    }

    const newAmount = amount !== undefined && !isNaN(parseFloat(amount))
      ? parseFloat(amount)
      : oldInstrument.amount;
    const newBankName = bankName?.trim() || oldInstrument.bankName;
    const newBankBranch = bankBranch?.trim() || oldInstrument.bankBranch;
    const newIssueDate = issueDate ? new Date(issueDate) : new Date();

    // Ensure valid user ID for foreign key constraint (resolve stale session tokens)
    let dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser && user.email) {
      dbUser = await prisma.user.findUnique({ where: { email: user.email } });
    }
    const creatorId = dbUser?.id || oldInstrument.createdById;

    // 1. Create new instrument with parentId = oldInstrument.id and status = SUBMITTED
    const newInstrument = await prisma.instrument.create({
      data: {
        type: oldInstrument.type,
        referenceNumber: referenceNumber.trim(),
        bankName: newBankName,
        bankBranch: newBankBranch,
        amount: newAmount,
        issueDate: newIssueDate,
        maturityDate: parsedMaturity,
        status: "SUBMITTED",
        institutionId: oldInstrument.institutionId,
        createdById: creatorId,
        verifiedByBank: false,
        parentId: oldInstrument.id,
      },
    });

    // 2. Transition old instrument to RENEWED
    const updatedOldInstrument = await prisma.instrument.update({
      where: { id: oldInstrument.id },
      data: {
        status: "RENEWED",
      },
    });

    // 3. Write AuditLog
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    try {
      await AuditService.log({
        action: "RENEW",
        entity: "Instrument",
        entityId: newInstrument.id,
        performedById: creatorId,
        ip: clientIp,
        before: {
          oldInstrumentId: oldInstrument.id,
          oldReferenceNumber: oldInstrument.referenceNumber,
          oldStatus: oldInstrument.status,
        },
        after: {
          newInstrumentId: newInstrument.id,
          newReferenceNumber: newInstrument.referenceNumber,
          parentId: oldInstrument.id,
          status: "SUBMITTED",
          oldInstrumentStatus: "RENEWED",
        },
      });
    } catch (e) {
      console.error("Audit log error on renewal:", e);
    }

    return NextResponse.json({
      message: "Instrument renewed successfully.",
      newInstrument,
      oldInstrument: updatedOldInstrument,
    });
  } catch (err: any) {
    console.error("Server error on renewal:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error occurred while processing renewal." },
      { status: 500 }
    );
  }
}
