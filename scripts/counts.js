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

    console.log("=========================================");
    console.log("📊 AICTE FDR PORTAL - DATABASE COUNTS");
    console.log("=========================================");
    console.log(`Total Instruments:   ${totalInstruments}`);
    console.log(`Total Institutions:  ${totalInstitutions}`);
    console.log(`Total Users:         ${totalUsers}`);
    console.log(`Total Documents:     ${totalDocuments}`);
    console.log("\nCounts per Status:");
    statusCounts.forEach((s) => {
      console.log(`  - ${s.status.padEnd(16)}: ${s._count.id}`);
    });
    console.log("\nCounts per Instrument Type:");
    typeCounts.forEach((t) => {
      console.log(`  - ${t.type.padEnd(18)}: ${t._count.id}`);
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
