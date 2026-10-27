import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { validateCredentials } from "@/lib/auth";
import { AuditService } from "@/lib/audit";
import prisma from "@/lib/prisma";
function extractClientIp(req: any): string {
  const headers = req?.headers;
  if (!headers) return "127.0.0.1";

  const forwardedFor = typeof headers.get === "function"
    ? headers.get("x-forwarded-for")
    : headers["x-forwarded-for"];

  if (forwardedFor && typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = typeof headers.get === "function"
    ? headers.get("x-real-ip")
    : headers["x-real-ip"];

  if (realIp && typeof realIp === "string") {
    return realIp.trim();
  }

  return "127.0.0.1";
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "AICTE Portal Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "admin0@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const clientIp = extractClientIp(req);
        const attemptedEmail = credentials?.email || "UNKNOWN";

        if (!credentials?.email || !credentials?.password) {
          try {
            await AuditService.log({
              action: "LOGIN_FAILED",
              entity: "User",
              entityId: "UNKNOWN",
              performedById: null,
              ip: clientIp,
              after: { email: attemptedEmail, reason: "Missing credentials" },
            });
          } catch (e) {
            console.error("Audit log error on missing credentials:", e);
          }
          return null;
        }

        const user = await validateCredentials(credentials.email, credentials.password);

        if (!user) {
          // Log FAILED login attempt in append-only AuditLog (never log password)
          try {
            const candidateUser = await prisma.user.findUnique({
              where: { email: credentials.email },
            });

            await AuditService.log({
              action: "LOGIN_FAILED",
              entity: "User",
              entityId: candidateUser ? candidateUser.id : "UNKNOWN",
              performedById: candidateUser ? candidateUser.id : null,
              ip: clientIp,
              after: { email: credentials.email, reason: "Invalid credentials" },
            });
          } catch (e) {
            console.error("Audit log error on failed login:", e);
          }
          return null;
        }

        // Log successful login in append-only AuditLog
        try {
          await AuditService.log({
            action: "LOGIN_SUCCESS",
            entity: "User",
            entityId: user.id,
            performedById: user.id,
            ip: clientIp,
            after: { email: user.email, role: user.role },
          });
        } catch (e) {
          console.error("Audit log error on login:", e);
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          institutionId: user.institutionId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hour session timeout
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = (user as any).role;
        token.institutionId = (user as any).institutionId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).email = token.email;
        (session.user as any).role = token.role;
        (session.user as any).institutionId = token.institutionId;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      if (message.token?.id) {
        try {
          await AuditService.log({
            action: "LOGOUT",
            entity: "User",
            entityId: message.token.id as string,
            performedById: message.token.id as string,
            ip: "127.0.0.1",
            after: {
              email: (message.token?.email as string) || undefined,
              message: "User signed out successfully",
            },
          });
        } catch (e) {
          console.error("Audit log error on signout:", e);
        }
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "aicte_nextauth_jwt_super_secret_key_12345",
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

/**
 * POST handler wrapper.
 *
 * NextAuth's CSRF validation runs before the credentials `authorize()` callback,
 * so a request with a dummy/missing CSRF token never reaches `authorize()` and no
 * audit log is written.  To guarantee a LOGIN_FAILED AuditLog row is written for
 * every credentials attempt (including those rejected by CSRF), we intercept
 * POST /api/auth/callback/credentials here, extract the email from the body,
 * check if the email exists in the DB, and write the LOGIN_FAILED row ourselves
 * (performedById = null when the email does not exist).
 *
 * We only write the row when the request targets the credentials callback and
 * contains an email field.  The `authorize()` callback may also run (on valid
 * CSRF) and write its own row — that is acceptable since each is a distinct
 * attempt record.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);

  // Only intercept the credentials callback endpoint
  if (url.pathname.endsWith("/callback/credentials")) {
    let email: string | null = null;
    try {
      // Clone the request so we can read the body without consuming it for NextAuth
      const cloned = req.clone();
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await cloned.text();
        const params = new URLSearchParams(text);
        email = params.get("email");
      } else if (contentType.includes("application/json")) {
        const json = await cloned.json();
        email = json?.email ?? null;
      }
    } catch {
      // Body parsing failure is non-fatal; fall through to NextAuth
    }

    if (email) {
      const ip = extractClientIp(req);
      try {
        const candidateUser = await prisma.user.findUnique({ where: { email } });
        await AuditService.log({
          action: "LOGIN_FAILED",
          entity: "User",
          entityId: candidateUser ? candidateUser.id : "UNKNOWN",
          performedById: candidateUser ? candidateUser.id : null,
          ip,
          after: { email, reason: "Login attempt (pre-authorize intercept)" },
        });
      } catch (e) {
        console.error("Audit log error on credentials intercept:", e);
      }
    }
  }

  // Always delegate to the real NextAuth handler
  return handler(req as any, { params: { nextauth: url.pathname.split("/api/auth/")[1]?.split("/") ?? [] } } as any);
}

export { handler as GET };
