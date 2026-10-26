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
export { handler as GET, handler as POST };
