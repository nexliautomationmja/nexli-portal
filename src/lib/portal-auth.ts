import crypto from "crypto";
import { db } from "@/db";
import { portalMagicLinks, portalSessions, invoices } from "@/db/schema";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const PORTAL_SESSION_COOKIE = "nexli-portal-session";

const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

/**
 * Generate a magic link token, store it, and return the full URL.
 * Token expires in 15 minutes.
 */
export async function generateMagicLink(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await db.insert(portalMagicLinks).values({
    email: email.toLowerCase().trim(),
    token,
    expiresAt,
  });

  return `${PORTAL_URL}/api/portal/auth/verify?token=${token}`;
}

/**
 * Verify a magic link token. Returns { email } if valid, null otherwise.
 * Marks the token as used on success.
 */
export async function verifyMagicLink(
  token: string
): Promise<{ email: string } | null> {
  const [link] = await db
    .select()
    .from(portalMagicLinks)
    .where(
      and(
        eq(portalMagicLinks.token, token),
        gt(portalMagicLinks.expiresAt, new Date()),
        isNull(portalMagicLinks.usedAt)
      )
    )
    .limit(1);

  if (!link) return null;

  await db
    .update(portalMagicLinks)
    .set({ usedAt: new Date() })
    .where(eq(portalMagicLinks.id, link.id));

  return { email: link.email };
}

/**
 * Create a portal session for the given email. Returns the session token string.
 * Looks up clientName from invoices for display.
 */
export async function createPortalSession(email: string): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Try to find a client name from existing invoice data
  let clientName: string | null = null;
  const [invoice] = await db
    .select({ clientName: invoices.clientName })
    .from(invoices)
    .where(eq(invoices.clientEmail, email.toLowerCase().trim()))
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  if (invoice) {
    clientName = invoice.clientName;
  }

  await db.insert(portalSessions).values({
    email: email.toLowerCase().trim(),
    sessionToken,
    clientName,
    expiresAt,
  });

  return sessionToken;
}

/**
 * Look up a portal session by token. Returns null if expired or not found.
 */
export async function getPortalSession(
  sessionToken: string
): Promise<{ email: string; clientName: string | null } | null> {
  const [session] = await db
    .select()
    .from(portalSessions)
    .where(
      and(
        eq(portalSessions.sessionToken, sessionToken),
        gt(portalSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!session) return null;
  return { email: session.email, clientName: session.clientName };
}

/**
 * Delete a portal session (sign out).
 */
export async function deletePortalSession(
  sessionToken: string
): Promise<void> {
  await db
    .delete(portalSessions)
    .where(eq(portalSessions.sessionToken, sessionToken));
}

/**
 * Extract and validate the portal session from a NextRequest.
 * Used by all portal API routes.
 */
export async function getPortalSessionFromRequest(
  req: NextRequest
): Promise<{ email: string; clientName: string | null } | null> {
  const token = req.cookies.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  return getPortalSession(token);
}
