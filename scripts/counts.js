// scripts/counts.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const totalInstruments = await prisma.instrument.count();
    const statusCounts = await prisma.instrument.groupBy({
      by: ["status"],
      _count: { id: true },
      orderBy: { status: "asc" },
    });
    const typeCounts = await prisma.instrument.groupBy({
      by: ["type"],
      _count: { id: true },
      orderBy: { type: "asc" },
    });
    const totalInstitutions = await prisma.institution.count();
    const totalUsers = await prisma.user.count();
    const totalDocuments = await prisma.document.count();
    const totalDocumentVersions = await prisma.documentVersion.count();
    const totalVerifications = await prisma.verification.count();
    const totalDiscrepancies = await prisma.discrepancy.count();

    const discrepancyStatusCounts = await prisma.discrepancy.groupBy({
      by: ["status"],
      _count: { id: true },
      orderBy: { status: "asc" },
    });

    const discrepancySeverityCounts = await prisma.discrepancy.groupBy({
      by: ["severity"],
      _count: { id: true },
      orderBy: { severity: "asc" },
    });

    console.log("=========================================");
    console.log("📊 AICTE FDR PORTAL - DATABASE COUNTS");
    console.log("=========================================");
    console.log(`Total Instruments:      ${totalInstruments}`);
    console.log(`Total Institutions:     ${totalInstitutions}`);
    console.log(`Total Users:            ${totalUsers}`);
    console.log(`Total Documents:        ${totalDocuments}`);
    console.log(`Total DocumentVersions: ${totalDocumentVersions}`);
    console.log(`Total Verifications:    ${totalVerifications}`);
    console.log(`Total Discrepancies:    ${totalDiscrepancies}`);
    console.log("\nCounts per Instrument Status:");
    statusCounts.forEach((s) => {
      console.log(`  - ${s.status.padEnd(16)}: ${s._count.id}`);
    });
    console.log("\nCounts per Instrument Type:");
    typeCounts.forEach((t) => {
      console.log(`  - ${t.type.padEnd(18)}: ${t._count.id}`);
    });
    console.log("\nCounts per Discrepancy Status:");
    discrepancyStatusCounts.forEach((d) => {
      console.log(`  - ${d.status.padEnd(16)}: ${d._count.id}`);
    });
    console.log("\nCounts per Discrepancy Severity:");
    discrepancySeverityCounts.forEach((d) => {
      console.log(`  - ${d.severity.padEnd(16)}: ${d._count.id}`);
    });
    console.log("=========================================");
  } catch (error) {
    console.error("Error retrieving counts:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
