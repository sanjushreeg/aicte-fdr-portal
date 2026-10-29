import { validateCredentials } from "../src/lib/auth";
import prisma from "../src/lib/prisma";

describe("Local Authentication & RBAC Verification", () => {
  afterAll(async () => {
    await (prisma as any).$disconnect();
  });

  it("authenticates ADMIN demo user with correct password", async () => {
    const user = await validateCredentials("admin0@example.com", "Password123");
    expect(user).not.toBeNull();
    expect(user?.email).toBe("admin0@example.com");
    expect(user?.role).toBe("ADMIN");
  });

  it("authenticates INSTITUTION demo user with correct password and linked institution", async () => {
    const user = await validateCredentials("institution0@example.com", "Password123");
    expect(user).not.toBeNull();
    expect(user?.email).toBe("institution0@example.com");
    expect(user?.role).toBe("INSTITUTION");
    expect(user?.institutionId).toBeDefined();
    expect(user?.institutionName).toContain("National Institute of Technology");
  });

  it("authenticates SCRUTINY_OFFICER demo user", async () => {
    const user = await validateCredentials("scrutinyofficer1@example.com", "Password123");
    expect(user).not.toBeNull();
    expect(user?.role).toBe("SCRUTINY_OFFICER");
  });

  it("authenticates APPROVING_AUTHORITY demo user", async () => {
    const user = await validateCredentials("approving_authority2@example.com", "Password123");
    expect(user).not.toBeNull();
    expect(user?.role).toBe("APPROVING_AUTHORITY");
  });

  it("rejects invalid password", async () => {
    const user = await validateCredentials("admin0@example.com", "WrongPassword999");
    expect(user).toBeNull();
  });

  it("rejects non-existent email", async () => {
    const user = await validateCredentials("nonexistent@example.com", "Password123");
    expect(user).toBeNull();
  });
});
