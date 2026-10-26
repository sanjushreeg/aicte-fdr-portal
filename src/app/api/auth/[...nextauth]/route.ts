import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { validateCredentials } from "@/lib/auth";
import { AuditService } from "@/lib/audit";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "AICTE Portal Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "admin0@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const clientIp = (req?.headers as any)?.["x-forwarded-for"] || "127.0.0.1";

        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await validateCredentials(credentials.email, credentials.password);

        if (!user) {
          // Log FAILED login attempt in append-only AuditLog
          try {
            const candidateUser = await (prisma as any).user.findUnique({
              where: { email: credentials.email },
            });

            await AuditService.log({
              action: "LOGIN_FAILED" as any,
              entity: "User",
              entityId: candidateUser ? candidateUser.id : "UNKNOWN",
              performedById: candidateUser ? candidateUser.id : "00000000-0000-0000-0000-000000000000",
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
            action: "LOGIN",
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
        token.role = (user as any).role;
        token.institutionId = (user as any).institutionId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
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
            after: { message: "User signed out" },
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
