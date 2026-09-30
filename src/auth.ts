import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * One teacher account, created by prisma/seed.ts — there is no sign-up page.
 * Credentials + JWT sessions, as in projectaction-next: the Credentials
 * provider in Auth.js v5 is built around JWT sessions.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const teacher = await prisma.teacher.findUnique({
          where: { email: email.trim().toLowerCase() },
        });
        if (!teacher) return null;

        const passwordMatches = await bcrypt.compare(password, teacher.passwordHash);
        if (!passwordMatches) return null;

        return { id: teacher.id, name: teacher.name, email: teacher.email };
      },
    }),
  ],
  callbacks: {
    session: async ({ session, token }) => {
      if (session.user) session.user.id = token.sub as string;
      return session;
    },
  },
});
