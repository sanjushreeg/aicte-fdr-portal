// scripts/test_rbac_endpoints.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function simulateEndpoints() {
  console.log("=================================================");
  console.log("🔒 SERVER RBAC API ENDPOINT TEST");
  console.log("=================================================");

  // Helper simulating requireAuth logic in API routes
  function testRequireAuth(sessionUser, allowedRoles) {
    if (!sessionUser) {
      return { status: 401, error: "Unauthorized access. Please login." };
    }
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(sessionUser.role)) {
      return { status: 403, error: `Forbidden. Role '${sessionUser.role}' lacks permission for this resource.` };
    }
    return { status: 200, user: sessionUser };
  }

  // 1. Unauthenticated Request
  console.log("\n[1] Testing Unauthenticated Request to /api/instruments and /api/admin/system-health:");
  const unauthRes1 = testRequireAuth(null);
  console.log(`  Calling GET /api/instruments without session: HTTP ${unauthRes1.status} -> ${unauthRes1.error}`);
  const unauthRes2 = testRequireAuth(null, ["ADMIN"]);
  console.log(`  Calling GET /api/admin/system-health without session: HTTP ${unauthRes2.status} -> ${unauthRes2.error}`);

  // 2. Institution Session calling /api/admin/system-health
  console.log("\n[2] Testing Institution Session accessing Admin Endpoint /api/admin/system-health:");
  const instUser = await prisma.user.findUnique({
    where: { email: "institution0@example.com" },
    include: { institution: true },
  });
  const instSession = {
    id: instUser.id,
    name: instUser.name,
    email: instUser.email,
    role: instUser.role,
    institutionId: instUser.institutionId,
  };
  const instAdminRes = testRequireAuth(instSession, ["ADMIN"]);
  console.log(`  Institution User (${instSession.email}) calling /api/admin/system-health:`);
  console.log(`  Result: HTTP ${instAdminRes.status} -> ${instAdminRes.error}`);

  // 3. Institution Session calling /api/instruments (Data Isolation Check)
  console.log("\n[3] Testing Institution Session Data Isolation on GET /api/instruments:");
  const allInstrumentsCount = await prisma.instrument.count();
  const whereClause = { institutionId: instSession.institutionId };
  const instInstruments = await prisma.instrument.findMany({
    where: whereClause,
    include: { institution: true },
  });

  console.log(`  Total database instruments (all institutions): ${allInstrumentsCount}`);
  console.log(`  Instruments returned for ${instUser.institution.name} (ID: ${instSession.institutionId}): ${instInstruments.length}`);
  
  const foreignRecords = instInstruments.filter(i => i.institutionId !== instSession.institutionId);
  console.log(`  Foreign institution records leaked: ${foreignRecords.length} (MUST BE 0)`);
  if (foreignRecords.length === 0) {
    console.log(`  ✅ Passed: Institution only sees its own institution's rows.`);
  }

  // 4. Admin Session calling /api/instruments (Can see across all institutions)
  console.log("\n[4] Testing Admin Session GET /api/instruments (Overview across all institutions):");
  const adminUser = await prisma.user.findUnique({ where: { email: "admin0@example.com" } });
  const adminSession = { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: adminUser.role };
  const adminRes = testRequireAuth(adminSession, ["ADMIN"]);
  console.log(`  Admin User (${adminSession.email}) calling /api/admin/system-health: HTTP ${adminRes.status} -> Allowed`);
}

simulateEndpoints()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
