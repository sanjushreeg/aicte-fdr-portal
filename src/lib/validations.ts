import { z } from "zod";

export const RoleEnum = z.enum([
  "ADMIN",
  "SCRUTINY_OFFICER",
  "APPROVING_AUTHORITY",
  "INSTITUTION",
]);
export type Role = z.infer<typeof RoleEnum>;

export const InstrumentTypeEnum = z.enum(["FDR", "SECURITY_DEPOSIT"]);
export type InstrumentType = z.infer<typeof InstrumentTypeEnum>;

export const InstrumentStatusEnum = z.enum([
  "SUBMITTED",
  "VERIFIED",
  "MISMATCH",
  "ACTIVE",
  "EXPIRING_SOON",
  "MATURED",
  "EXPIRED",
  "RENEWED",
  "REPLACED",
  "RELEASED",
  "REJECTED",
]);
export type InstrumentStatus = z.infer<typeof InstrumentStatusEnum>;

export const UserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: RoleEnum,
  institutionId: z.string().uuid().optional().nullable(),
});

export const InstrumentInputSchema = z.object({
  type: InstrumentTypeEnum,
  referenceNumber: z.string().min(1),
  bankName: z.string().min(1),
  bankBranch: z.string().min(1),
  amount: z.number().positive(),
  issueDate: z.coerce.date(),
  maturityDate: z.coerce.date(),
  status: InstrumentStatusEnum.default("SUBMITTED"),
  institutionId: z.string().min(1),
  parentId: z.string().optional().nullable(),
});

export const BankDataSchema = z.object({
  referenceNumber: z.string(),
  bankName: z.string(),
  branch: z.string(),
  amount: z.number(),
  issueDate: z.string().or(z.date()),
  maturityDate: z.string().or(z.date()),
  status: z.string(),
  verifiedBy: z.string(),
});

export const DiscrepancyItemSchema = z.object({
  field: z.string(),
  expected: z.any(),
  actual: z.any(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string(),
});
