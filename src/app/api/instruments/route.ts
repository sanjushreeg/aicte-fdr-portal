import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: Request) {
  // Check auth
  const { error, user } = await requireAuth(req);
  if (error) return error;

  // RBAC data filtering: Institution can only view their own instruments!
  const whereClause: any = {};
  if (user.role === "INSTITUTION") {
    if (!user.institutionId) {
      return NextResponse.json({ error: "Institution user has no linked institution" }, { status: 400 });
    }
    whereClause.institutionId = user.institutionId;
  }

  const instruments = await prisma.instrument.findMany({
    where: whereClause,
    include: {
      institution: { select: { aicteId: true, name: true, state: true } },
      documents: {
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      },
      verifications: {
        orderBy: { requestedAt: "desc" },
        take: 1,
      },
      discrepancies: {
        where: { status: "OPEN" },
      },
      releaseRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    userRole: user.role,
    userInstitutionId: user.institutionId,
    count: instruments.length,
    instruments,
  });
}
