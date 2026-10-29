import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { Role } from "./validations";

/** Verify email & password */
export async function validateCredentials(email: string, password: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { institution: true },
    });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
      institutionId: user.institutionId,
      institutionName: user.institution?.name || null,
    };
  } catch (err: any) {
    console.error("[validateCredentials] Database error during credentials verification:", err?.message || err);
    return null;
  }
}
