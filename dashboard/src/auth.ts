import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface User {
    role?: "admin" | "client";
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "admin" | "client";
    };
  }
}

declare module "next-auth" {
  interface JWT {
    role?: "admin" | "client";
    id?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const normalizedEmail = (credentials.email as string).toLowerCase().trim();

        const result = await db
          .select()
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        const user = result[0];
        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );
        if (!passwordMatch) return null;

        // Update last login timestamp
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "admin" | "client";
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
