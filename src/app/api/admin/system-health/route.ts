import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: Request) {
  // Only ADMIN can access admin system-health/audit
  const { error, user } = await requireAuth(req, ["ADMIN"]);
  if (error) return error;

  const [userCount, institutionCount, auditCount] = await Promise.all([
    prisma.user.count(),
    prisma.institution.count(),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({
    status: "ok",
    admin: user.email,
    stats: {
      userCount,
      institutionCount,
      auditCount,
    },
  });
}
