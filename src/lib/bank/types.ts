/* eslint-disable no-unused-vars */
/**
 * Bank verification service interface and data contracts.
 */

export interface BankConfirmedData {
  referenceNumber: string;
  amount: number;
  bank: string;
  branchCode: string;
  maturityDate: string;
  status: string;
  holderName: string;
  [key: string]: any;
}

export interface BankVerificationService {
  verifyFdr(referenceNumber: string, instrument?: any): Promise<BankConfirmedData>;
}
