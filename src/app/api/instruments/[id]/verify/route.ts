import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";
import { mockBankService } from "@/lib/bank";
import { detectDiscrepancies, persistDiscrepancies } from "@/lib/discrepancy";
import { AuditService } from "@/lib/audit";

const ALLOWED_ROLES = ["SCRUTINY_OFFICER", "APPROVING_AUTHORITY", "ADMIN"] as const;

/**
 * POST /api/instruments/[id]/verify
 *
 * Runs core banking verification against the mock bank service, executes discrepancy
 * detection, creates a Verification row, stores newly detected Discrepancies (preventing
 * duplicate OPEN discrepancies for the same code), updates instrument status to VERIFIED
 * (if clean) or MISMATCH (if open discrepancies exist), and logs an audit entry.
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

  const instrument = await prisma.instrument.findUnique({
    where: { id },
    include: {
      institution: true,
      documents: {
        include: {
          versions: true,
        },
      },
      discrepancies: true,
    },
  });

  if (!instrument) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  const requestedAt = new Date();

  // 1. Look up FDR data from core banking API
  const bankData = await mockBankService.verifyFdr(instrument.referenceNumber, instrument);

  // 2. Run discrepancy detection logic
  const detected = await detectDiscrepancies(instrument, bankData);
  const verificationStatus = detected.length > 0 ? "MISMATCH" : "SUCCESS";
  const completedAt = new Date();

  // 3. Create Verification row
  const verification = await prisma.verification.create({
    data: {
      instrumentId: instrument.id,
      requestedAt,
      completedAt,
      status: verificationStatus,
      bankData: JSON.stringify(bankData),
      source: "MOCK_BANK_API",
      requestedById: user.id,
    },
  });

  // 4. Persist newly detected discrepancies (deduping open ones)
  await persistDiscrepancies(instrument.id, verification.id, detected);

  // 5. Determine if any open discrepancies remain on the instrument
  const openCount = await prisma.discrepancy.count({
    where: {
      instrumentId: instrument.id,
      status: "OPEN",
    },
  });

  const newStatus = openCount > 0 ? "MISMATCH" : "VERIFIED";

  // 6. Update instrument status and verifiedByBank flag
  const updatedInstrument = await prisma.instrument.update({
    where: { id: instrument.id },
    data: {
      status: newStatus,
      verifiedByBank: true,
    },
  });

  // 7. Write AuditLog entry
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  try {
    await AuditService.log({
      action: "VERIFY",
      entity: "Instrument",
      entityId: instrument.id,
      performedById: user.id,
      ip: clientIp,
      before: { status: instrument.status },
      after: {
        status: newStatus,
        verificationId: verification.id,
        verificationStatus,
        detectedDiscrepanciesCount: detected.length,
        openDiscrepanciesCount: openCount,
      },
    });
  } catch (e) {
    console.error("Audit log error on verification:", e);
  }

  // 8. Fetch all updated discrepancies for the instrument response
  const allDiscrepancies = await prisma.discrepancy.findMany({
    where: { instrumentId: instrument.id },
    orderBy: { detectedAt: "desc" },
  });

  return NextResponse.json({
    verification,
    discrepancies: allDiscrepancies,
    instrument: updatedInstrument,
    instrumentStatus: newStatus,
  });
}
