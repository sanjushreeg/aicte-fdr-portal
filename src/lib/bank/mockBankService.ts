import prisma from "@/lib/prisma";
import { BankConfirmedData, BankVerificationService } from "./types";

/**
 * MockBankService simulates core banking API lookup for FDR / Security Deposit instruments.
 * Adds ~300ms realistic network latency and deterministically derives confirmed data from
 * the instrument records, preserving seeded test mismatch cases.
 */
export class MockBankService implements BankVerificationService {
  async verifyFdr(referenceNumber: string, instrument?: any): Promise<BankConfirmedData> {
    // Simulate real-world core banking API network latency (300ms)
    await new Promise((resolve) => setTimeout(resolve, 300));

    let inst = instrument;
    if (!inst) {
      inst = await prisma.instrument.findFirst({
        where: { referenceNumber },
        include: { institution: true },
      });
    } else if (!inst.institution && inst.institutionId) {
      const institution = await prisma.institution.findUnique({
        where: { id: inst.institutionId },
      });
      inst = { ...inst, institution };
    }

    if (!inst) {
      throw new Error(`Instrument with reference number '${referenceNumber}' not found in core banking registry`);
    }

    // Default: deterministically mirror instrument values for clean confirmation
    let confirmedAmount = inst.amount;
    let branchCode = inst.bankBranch;
    let maturityDate = new Date(inst.maturityDate).toISOString();

    // Preserve explicit seeded mismatch cases
    if (inst.referenceNumber === "FDR-MISMATCH-2026" || inst.referenceNumber.includes("AMOUNT-MISMATCH") || inst.referenceNumber.includes("AMOUNT_MISMATCH")) {
      // 25L submitted vs 20L bank confirmed (or -100k for synthetic test case)
      confirmedAmount = inst.referenceNumber === "FDR-MISMATCH-2026" ? 2000000.0 : inst.amount - 100000;
    }

    if (inst.referenceNumber.includes("BRANCH-MISMATCH") || inst.referenceNumber.includes("BRANCH_MISMATCH")) {
      branchCode = "CORE_BANKING_BRANCH_9999_MISMATCH";
    }

    if (inst.referenceNumber.includes("DATE-MISMATCH") || inst.referenceNumber.includes("DATE_MISMATCH")) {
      maturityDate = new Date(new Date(inst.maturityDate).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    return {
      referenceNumber: inst.referenceNumber,
      amount: confirmedAmount,
      bank: inst.bankName,
      branchCode,
      maturityDate,
      status: "ACTIVE_IN_CORE_BANKING",
      holderName: inst.institution?.name || "AICTE Registered Institution",
    };
  }
}

export const mockBankService = new MockBankService();
