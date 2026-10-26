// scripts/verify_checkpoint.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  console.log("=================================================");
  console.log("📊 CHECKPOINT 1: DATABASE ROW COUNTS");
  console.log("=================================================");
  const instCount = await prisma.institution.count();
  const userCount = await prisma.user.count();
  const instrumentCount = await prisma.instrument.count();
  const docCount = await prisma.document.count();
  const docVerCount = await prisma.documentVersion.count();
  const notifCount = await prisma.notification.count();
  const ruleCount = await prisma.reminderRule.count();
  const auditCount = await prisma.auditLog.count();
  const verifCount = await prisma.verification.count();
  const discCount = await prisma.discrepancy.count();
  const releaseCount = await prisma.releaseRequest.count();

  console.log(`Institutions:     ${instCount}`);
  console.log(`Users:            ${userCount}`);
  console.log(`Instruments:      ${instrumentCount}`);
  console.log(`Documents:        ${docCount}`);
  console.log(`DocumentVersions: ${docVerCount}`);
  console.log(`Notifications:    ${notifCount}`);
  console.log(`ReminderRules:    ${ruleCount}`);
  console.log(`AuditLogs:        ${auditCount}`);
  console.log(`Verifications:    ${verifCount}`);
  console.log(`Discrepancies:    ${discCount}`);
  console.log(`ReleaseRequests:  ${releaseCount}`);

  console.log("\n=================================================");
  console.log("📈 INSTRUMENTS PER STATUS (RECONCILED COUNT: 130 TOTAL)");
  console.log("=================================================");
  const instruments = await prisma.instrument.findMany();
  const statusMap = {};
  for (const inst of instruments) {
    statusMap[inst.status] = (statusMap[inst.status] || 0) + 1;
  }
  for (const [status, count] of Object.entries(statusMap)) {
    console.log(`- ${status.padEnd(16)}: ${count}`);
  }
  console.log(`TOTAL INSTRUMENTS: ${instruments.length} (120 baseline + 1 mismatch + 3 maturity + 2 duplicate + 1 missing doc + 2 renewal chain + 1 pending release = 130)`);

  console.log("\n=================================================");
  console.log("🔍 CHECKPOINT 2: EVIDENCE FOR PLANTED CASES");
  console.log("=================================================");

  // a. Amount mismatch
  console.log("\n[a] Amount Mismatch Case:");
  const mismatch = await prisma.instrument.findFirst({
    where: { referenceNumber: "FDR-MISMATCH-2026" },
    include: {
      institution: true,
      verifications: true,
      discrepancies: true,
    },
  });
  if (mismatch) {
    const bankData = JSON.parse(mismatch.verifications[0].bankData);
    console.log(`  Reference Number:       ${mismatch.referenceNumber}`);
    console.log(`  Institution:            ${mismatch.institution.name}`);
    console.log(`  Submitted Amount:       ₹${mismatch.amount.toLocaleString("en-IN")}`);
    console.log(`  Bank-Confirmed Amount:  ₹${bankData.confirmedAmount.toLocaleString("en-IN")}`);
    console.log(`  Discrepancy Code:       ${mismatch.discrepancies[0]?.code} (${mismatch.discrepancies[0]?.severity})`);
    console.log(`  Discrepancy Status:     ${mismatch.discrepancies[0]?.status}`);
    console.log(`  Verification Source:    ${mismatch.verifications[0].source}`);
    console.log(`  Status:                 ${mismatch.status}`);
  }

  // b. Three maturity cases (7, 30, 90 days)
  console.log("\n[b] Approaching Maturity Cases (7, 30, 90 days):");
  const matureCases = await prisma.instrument.findMany({
    where: { referenceNumber: { startsWith: "FDR-EXPIRE-" } },
    include: { institution: true },
    orderBy: { maturityDate: "asc" },
  });
  const now = new Date();
  for (const m of matureCases) {
    const diffMs = m.maturityDate.getTime() - now.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    console.log(`  Ref: ${m.referenceNumber.padEnd(26)} | Days to Maturity: ${days} days | Mat Date: ${m.maturityDate.toISOString().split("T")[0]} | Inst: ${m.institution.name.substring(0, 30)}...`);
  }

  // c. Duplicate FDR number pair
  console.log("\n[c] Duplicate FDR Number Pair:");
  const dupes = await prisma.instrument.findMany({
    where: { referenceNumber: "FDR-DUP-999888" },
    include: { institution: true, discrepancies: true },
  });
  dupes.forEach((d, idx) => {
    console.log(`  Pair #${idx + 1}: Ref: ${d.referenceNumber} | Status: ${d.status.padEnd(10)} | Amount: ₹${d.amount.toLocaleString("en-IN")} | Institution: ${d.institution.name} | Discrepancies: ${d.discrepancies.length}`);
  });

  // d. Renewal chain
  console.log("\n[d] Renewal Chain (Original -> Renewal):");
  const orig = await prisma.instrument.findFirst({
    where: { referenceNumber: "FDR-ORIG-CHAIN-001" },
    include: { children: true, documents: { include: { versions: true } } },
  });
  if (orig) {
    console.log(`  Original: ID: ${orig.id} | Ref: ${orig.referenceNumber} | Status: ${orig.status} | Doc Versions: ${orig.documents[0]?.versions.length}`);
    for (const child of orig.children) {
      console.log(`  Renewal:  ID: ${child.id} | Ref: ${child.referenceNumber} | Status: ${child.status} | ParentID: ${child.parentId}`);
    }
  }

  // e. Pending release request
  console.log("\n[e] Pending Release Request with Institution & Instrument:");
  const releaseReq = await prisma.releaseRequest.findFirst({
    include: {
      instrument: { include: { institution: true } },
      requestedBy: true,
    },
  });
  if (releaseReq) {
    console.log(`  Request ID:             ${releaseReq.id}`);
    console.log(`  Instrument Ref:         ${releaseReq.instrument.referenceNumber}`);
    console.log(`  Deposit Amount:         ₹${releaseReq.instrument.amount.toLocaleString("en-IN")}`);
    console.log(`  Institution:            ${releaseReq.instrument.institution.name}`);
    console.log(`  Requested By:           ${releaseReq.requestedBy.name} (${releaseReq.requestedBy.email})`);
    console.log(`  Request Status:         ${releaseReq.status}`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
