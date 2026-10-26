import { prisma } from "../src/lib/prisma";

describe("Append-Only AuditLog Enforcement", () => {
  let createdLogId: string;

  beforeAll(async () => {
    // Create an initial audit log entry
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("Seed user needed");

    const log = await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "SecurityDeposit",
        entityId: "test-sec-999",
        performedById: user.id,
        ip: "127.0.0.1",
      },
    });
    createdLogId = log.id;
  });

  afterAll(async () => {
    // Cleanup using base raw query if needed
    await (prisma as any).$disconnect();
  });

  it("should permit create operations on AuditLog", async () => {
    const user = await prisma.user.findFirst();
    const newLog = await prisma.auditLog.create({
      data: {
        action: "VERIFY",
        entity: "TestFDR",
        entityId: "fdr-123",
        performedById: user!.id,
        ip: "192.168.1.1",
      },
    });
    expect(newLog.id).toBeDefined();
    expect(newLog.action).toBe("VERIFY");
  });

  it("should throw error when attempting to update an AuditLog row", async () => {
    await expect(
      prisma.auditLog.update({
        where: { id: createdLogId },
        data: { action: "TAMPERED_ACTION" },
      })
    ).rejects.toThrow("AuditLog is append-only: UPDATE operations are strictly prohibited.");
  });

  it("should throw error when attempting to updateMany on AuditLog", async () => {
    await expect(
      prisma.auditLog.updateMany({
        data: { ip: "0.0.0.0" },
      })
    ).rejects.toThrow("AuditLog is append-only: UPDATE_MANY operations are strictly prohibited.");
  });

  it("should throw error when attempting to delete an AuditLog row", async () => {
    await expect(
      prisma.auditLog.delete({
        where: { id: createdLogId },
      })
    ).rejects.toThrow("AuditLog is append-only: DELETE operations are strictly prohibited.");
  });

  it("should throw error when attempting to deleteMany on AuditLog", async () => {
    await expect(
      prisma.auditLog.deleteMany()
    ).rejects.toThrow("AuditLog is append-only: DELETE_MANY operations are strictly prohibited.");
  });

  it("should throw error when attempting to upsert an AuditLog row", async () => {
    const user = await prisma.user.findFirst();
    await expect(
      prisma.auditLog.upsert({
        where: { id: createdLogId },
        update: { action: "MODIFIED" },
        create: {
          action: "CREATE",
          entity: "SecurityDeposit",
          entityId: "test-sec-999",
          performedById: user!.id,
          ip: "127.0.0.1",
        },
      })
    ).rejects.toThrow("AuditLog is append-only: UPSERT operations are strictly prohibited.");
  });
});
