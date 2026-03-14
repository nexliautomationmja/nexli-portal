import { cookies } from "next/headers";
import { db } from "@/db";
import { portalSessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { PORTAL_SESSION_COOKIE } from "./portal-auth";

/**
 * Server-side portal session reader for layouts and server components.
 * Uses next/headers cookies() — only works in Server Components / Route Handlers.
 */
export async function getPortalSessionServer(): Promise<{
  email: string;
  clientName: string | null;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [session] = await db
    .select()
    .from(portalSessions)
    .where(
      and(
        eq(portalSessions.sessionToken, token),
        gt(portalSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  return session
    ? { email: session.email, clientName: session.clientName }
    : null;
}
