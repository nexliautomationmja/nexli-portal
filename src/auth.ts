import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { ensureCoreSchema } from "@/lib/schema-bootstrap";
import {
  isSubscriptionActive,
  normalizeTier,
  type Tier,
} from "@/lib/tier-access";

declare module "next-auth" {
  interface User {
    role?: "admin" | "client";
    tier?: Tier;
    /** Set when a team member signs in: their own users.id (id is the workspace owner's). */
    memberId?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "admin" | "client";
      /** Tier at sign-in time; the dashboard layout re-reads the DB for gating. */
      tier: Tier;
      /**
       * Team member's own users.id. When set, `id` is the workspace owner's id
       * (all data is scoped to it) and this is the person actually signed in.
       */
      memberId?: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: "admin" | "client";
    tier?: Tier;
    id?: string;
    memberId?: string;
  }
}

/**
 * Thrown from `authorize` when a Foundation-tier firm's subscription is no
 * longer active. NextAuth surfaces `code` to the client (result.code with
 * redirect:false, or ?code= on the error page) so the login form can show a
 * specific message instead of "invalid credentials".
 */
export class SubscriptionInactiveError extends CredentialsSignin {
  code = "subscription_inactive";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
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
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const normalizedEmail = (credentials.email as string).toLowerCase().trim();

          // Production DB may be missing hand-written migrations (no migration
          // pipeline). Idempotent; runs once per lambda. Never block sign-in
          // on it — if it fails the select below surfaces the real error.
          try {
            await ensureCoreSchema();
          } catch (err) {
            console.error("[AUTH] schema bootstrap failed:", err);
          }

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

          const tier = normalizeTier(user.tier);

          // Foundation firms are gated on their Stripe subscription. Admin and
          // legacy DRS clients are never blocked here.
          if (
            user.role === "client" &&
            tier === "foundation" &&
            !isSubscriptionActive(user.subscriptionStatus)
          ) {
            throw new SubscriptionInactiveError();
          }

          // Update last login timestamp
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user.id));

          // Team member → sign into the owner's workspace as themselves.
          let ownerId: string | null = null;
          try {
            const r = await db.execute(
              sql`SELECT workspace_owner_id FROM users WHERE id = ${user.id} LIMIT 1`
            );
            const rows = (Array.isArray(r) ? r : (r as { rows?: unknown[] }).rows ?? []) as {
              workspace_owner_id?: string | null;
            }[];
            ownerId = rows[0]?.workspace_owner_id ?? null;
          } catch (err) {
            console.error("[AUTH] workspace owner lookup failed:", err);
          }
          if (ownerId) {
            const [owner] = await db.select().from(users).where(eq(users.id, ownerId)).limit(1);
            if (!owner) return null;
            return {
              id: owner.id,
              email: user.email,
              name: user.name,
              role: owner.role,
              tier: normalizeTier(owner.tier),
              memberId: user.id,
            };
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tier,
          };
        } catch (err) {
          // Let NextAuth surface our typed sign-in errors (with their code).
          if (err instanceof CredentialsSignin) throw err;
          console.error("[AUTH] authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.tier = user.tier;
        token.id = user.id;
        token.memberId = user.memberId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "admin" | "client";
        session.user.tier = normalizeTier(token.tier);
        session.user.id = token.id as string;
        session.user.memberId = token.memberId || undefined;
      }
      return session;
    },
  },
});
