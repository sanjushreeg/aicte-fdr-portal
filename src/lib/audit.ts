import prisma from "./prisma";

export interface CreateAuditLogParams {
  action:
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILED"
    | "LOGOUT"
    | "LOGIN"
    | "CREATE"
    | "UPDATE"
    | "VERIFY"
    | "APPROVE"
    | "REJECT"
    | "DOWNLOAD"
    | string;
  entity: string;
  entityId: string;
  before?: any;
  after?: any;
  performedById?: string | null;
  ip?: string;
  timestamp?: Date;
}

/**
 * Append-only Audit Log Service.
 * Notice: This service ONLY exposes `create` and read operations (`findMany`).
 * There is explicitly NO update or delete method provided in this service.
 */
export const AuditService = {
  async log(params: CreateAuditLogParams) {
    return prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before ? JSON.stringify(params.before) : null,
        after: params.after ? JSON.stringify(params.after) : null,
        performedById: params.performedById ?? undefined,
        ip: params.ip || "127.0.0.1",
        ...(params.timestamp ? { timestamp: params.timestamp } : {}),
      },
    });
  },

  async getRecentLogs(limit = 20) {
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { timestamp: "desc" },
      include: {
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  },
};
