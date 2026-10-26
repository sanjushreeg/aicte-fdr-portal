import { PrismaClient } from "@prisma/client";

const basePrisma = new PrismaClient();

/**
 * Extended Prisma Client with Append-Only Enforcement for AuditLog.
 * Throws explicit runtime error if any update, updateMany, delete, deleteMany, or upsert
 * operation is attempted on AuditLog.
 */
export const prisma = basePrisma.$extends({
  query: {
    auditLog: {
      async update() {
        throw new Error("AuditLog is append-only: UPDATE operations are strictly prohibited.");
      },
      async updateMany() {
        throw new Error("AuditLog is append-only: UPDATE_MANY operations are strictly prohibited.");
      },
      async delete() {
        throw new Error("AuditLog is append-only: DELETE operations are strictly prohibited.");
      },
      async deleteMany({ args, query }) {
        // Allow deleteMany ONLY during test suite resets when explicitly flagged
        if (process.env.ALLOW_AUDIT_RESET === "true") {
          return query(args);
        }
        throw new Error("AuditLog is append-only: DELETE_MANY operations are strictly prohibited.");
      },
      async upsert() {
        throw new Error("AuditLog is append-only: UPSERT operations are strictly prohibited.");
      },
    },
  },
});

export default prisma;
