import prisma from "@/lib/prisma";
import { BankConfirmedData } from "@/lib/bank";

export type DiscrepancyCode =
  | "AMOUNT_MISMATCH"
  | "BRANCH_CODE_MISMATCH"
  | "DATE_INCONSISTENCY"
  | "DUPLICATE_FDR"
  | "MISSING_DOCUMENT";

export type DiscrepancySeverity = "critical" | "high" | "medium" | "low";

export interface DetectedDiscrepancy {
  code: DiscrepancyCode;
  severity: DiscrepancySeverity;
  details: string; // JSON payload
}

/**
 * Detection engine comparing institution-submitted instrument data with core banking confirmed data.
 *
 * Discrepancy Codes & Severity Rules:
 *  - AMOUNT_MISMATCH: critical
 *  - DUPLICATE_FDR: critical
 *  - MISSING_DOCUMENT: high
 *  - BRANCH_CODE_MISMATCH: medium
 *  - DATE_INCONSISTENCY: low
 */
export async function detectDiscrepancies(
  instrument: any,
  bankData: BankConfirmedData
): Promise<DetectedDiscrepancy[]> {
  const discrepancies: DetectedDiscrepancy[] = [];

  // 1. AMOUNT_MISMATCH (critical)
  if (Math.abs(instrument.amount - bankData.amount) > 0.01) {
    const variance = bankData.amount - instrument.amount;
    discrepancies.push({
      code: "AMOUNT_MISMATCH",
      severity: "critical",
      details: JSON.stringify({
        field: "amount",
        submittedAmount: instrument.amount,
        bankConfirmedAmount: bankData.amount,
        variance,
        description: `Submitted amount (\u20B9${instrument.amount.toLocaleString("en-IN")}) differs from core banking deposit (\u20B9${bankData.amount.toLocaleString("en-IN")}) by \u20B9${Math.abs(variance).toLocaleString("en-IN")}`,
      }),
    });
  }

  // 2. DUPLICATE_FDR (critical) - same number on another institution
  const duplicate = await prisma.instrument.findFirst({
    where: {
      referenceNumber: instrument.referenceNumber,
      institutionId: { not: instrument.institutionId },
      id: { not: instrument.id },
    },
    include: { institution: true },
  });

  if (duplicate) {
    discrepancies.push({
      code: "DUPLICATE_FDR",
      severity: "critical",
      details: JSON.stringify({
        field: "referenceNumber",
        duplicateWithInstrumentId: duplicate.id,
        duplicateWithInstitution: duplicate.institution?.name || duplicate.institutionId,
        description: `Duplicate FDR reference number detected! Already registered under ${duplicate.institution?.name || duplicate.institutionId}`,
      }),
    });
  }

  // 3. MISSING_DOCUMENT (high) - no document or no DocumentVersion
  const hasNoDocs = !instrument.documents || instrument.documents.length === 0;
  let hasNoVersions = false;
  if (instrument.documents && instrument.documents.length > 0) {
    const totalVersions = instrument.documents.reduce(
      (acc: number, d: any) => acc + (d.versions?.length || 0),
      0
    );
    if (totalVersions === 0) {
      hasNoVersions = true;
    }
  }

  if (hasNoDocs || hasNoVersions) {
    discrepancies.push({
      code: "MISSING_DOCUMENT",
      severity: "high",
      details: JSON.stringify({
        field: "documents",
        description: hasNoDocs
          ? "Mandatory deposit receipt copy not uploaded"
          : "Mandatory document has no uploaded file versions",
      }),
    });
  }

  // 4. BRANCH_CODE_MISMATCH (medium)
  if (
    bankData.branchCode &&
    instrument.bankBranch &&
    bankData.branchCode.trim().toLowerCase() !== instrument.bankBranch.trim().toLowerCase()
  ) {
    discrepancies.push({
      code: "BRANCH_CODE_MISMATCH",
      severity: "medium",
      details: JSON.stringify({
        field: "branchCode",
        submittedBranch: instrument.bankBranch,
        bankConfirmedBranch: bankData.branchCode,
        description: `Submitted branch '${instrument.bankBranch}' does not match core banking branch '${bankData.branchCode}'`,
      }),
    });
  }

  // 5. DATE_INCONSISTENCY (low)
  if (bankData.maturityDate && instrument.maturityDate) {
    const subDate = new Date(instrument.maturityDate).toISOString().slice(0, 10);
    const bankDate = new Date(bankData.maturityDate).toISOString().slice(0, 10);
    if (subDate !== bankDate) {
      discrepancies.push({
        code: "DATE_INCONSISTENCY",
        severity: "low",
        details: JSON.stringify({
          field: "maturityDate",
          submittedDate: subDate,
          bankConfirmedDate: bankDate,
          description: `Submitted maturity date (${subDate}) differs from bank record (${bankDate})`,
        }),
      });
    }
  }

  return discrepancies;
}

/**
 * Persists detected discrepancies for an instrument, ensuring no duplicate OPEN
 * discrepancies are created for the same instrument and code.
 */
export async function persistDiscrepancies(
  instrumentId: string,
  verificationId: string | null,
  detectedList: DetectedDiscrepancy[]
) {
  // Find all existing OPEN discrepancies for this instrument
  const existingOpen = await prisma.discrepancy.findMany({
    where: {
      instrumentId,
      status: "OPEN",
    },
  });

  const existingOpenCodes = new Set(existingOpen.map((d) => d.code));
  const newlyCreated = [];

  for (const item of detectedList) {
    if (!existingOpenCodes.has(item.code)) {
      const created = await prisma.discrepancy.create({
        data: {
          instrumentId,
          verificationId,
          code: item.code,
          severity: item.severity,
          status: "OPEN",
          details: item.details,
          detectedAt: new Date(),
        },
      });
      newlyCreated.push(created);
      existingOpenCodes.add(item.code);
    }
  }

  return {
    newlyCreated,
    existingOpen,
    totalOpenCount: existingOpenCodes.size,
  };
}
