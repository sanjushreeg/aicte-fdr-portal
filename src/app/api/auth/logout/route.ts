import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { AuditService } from "@/lib/audit";

/**
 * POST /api/auth/logout
 * Writes a LOGOUT AuditLog entry (actor, time) before the client calls signOut.
 * Called by the AppHeader Logout button before invoking next-auth signOut.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const user = session.user as any;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    try {
      await AuditService.log({
        action: "LOGOUT",
        entity: "User",
        entityId: user.id,
        performedById: user.id,
        ip,
        after: {
          email: user.email,
          role: user.role,
          message: "User initiated logout",
        },
      });
    } catch (e) {
      console.error("Audit log error on logout API:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
