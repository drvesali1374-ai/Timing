/**
 * پیکربندی NextAuth v4 (ADR-009) — استراتژی JWT + Credentials.
 * این فایل فقط در سمت سرور استفاده می‌شود (route handler + getServerSession).
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyCredentials } from "../application/auth-service";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // ۳۰ روز
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "حساب کاربری",
      credentials: {
        email: { label: "رایانامه", type: "text" },
        password: { label: "گذرواژه", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await verifyCredentials(
          String(credentials.email),
          String(credentials.password),
        );
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = String(token.uid);
      }
      return session;
    },
  },
};
