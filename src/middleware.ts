import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets and auth endpoints bypass
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon.ico") ||
    pathname === "/login"
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "aicte_nextauth_jwt_super_secret_key_12345",
  });

  // Protect /admin routes (UI)
  if (pathname.startsWith("/admin")) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token.role !== "ADMIN") {
      // 403 Forbidden for non-admins
      return new NextResponse(
        JSON.stringify({ error: "Forbidden: Access restricted to Administrators only" }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }
  }

  // Protect /dashboard, /instruments, /scrutiny, and /reports portal routes
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/instruments") ||
    pathname.startsWith("/scrutiny") ||
    pathname.startsWith("/reports")
  ) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Security Headers
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()"
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
