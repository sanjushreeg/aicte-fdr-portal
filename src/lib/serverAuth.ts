import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Role } from "./validations";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  institutionId?: string | null;
}

/**
 * Server-side RBAC enforcement helper for API route handlers.
 * Checks for authenticated session and validates role membership.
 */
export async function requireAuth(req?: Request, allowedRoles?: Role[]) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized access. Please login." }, { status: 401 }),
      user: null as unknown as SessionUser,
    };
  }

  const user = session.user as SessionUser;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return {
        error: NextResponse.json(
          { error: `Forbidden. Role '${user.role}' lacks permission for this resource.` },
          { status: 403 }
        ),
        user,
      };
    }
  }

  return { error: null, user };
}
