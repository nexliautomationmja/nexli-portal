import crypto from "crypto";
import { db } from "@/db";
import {
  portalMagicLinks,
  portalSessions,
  invoices,
  documents,
  documentLinks,
  eSignatures,
  taxReturns,
  engagements,
  engagementSigners,
} from "@/db/schema";
import { eq, and, gt, lt, isNull, desc, asc } from "drizzle-orm";
import { createNotification } from "@/lib/notifications";
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

export type PortalSession = {
  email: string;
  clientName: string | null;
  ownerId: string | null;
};

/**
 * Create a portal session for the given email. Returns the session token string.
 * Looks up clientName and ownerId from invoices for display and tenant scoping.
 */
export async function createPortalSession(email: string): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Look up clientName and ownerId across all client-facing tables
  let clientName: string | null = null;
  let ownerId: string | null = null;
  const normalEmail = email.toLowerCase().trim();

  // Try invoices first (most common)
  const [inv] = await db
    .select({ clientName: invoices.clientName, ownerId: invoices.ownerId })
    .from(invoices)
    .where(eq(invoices.clientEmail, normalEmail))
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  if (inv) {
    clientName = inv.clientName;
    ownerId = inv.ownerId;
  }

  // Fall through other tables if no invoice found
  if (!ownerId) {
    const [doc] = await db
      .select({ clientName: documents.clientName, ownerId: documents.ownerId })
      .from(documents)
      .where(eq(documents.clientEmail, normalEmail))
      .orderBy(desc(documents.createdAt))
      .limit(1);
    if (doc) { clientName = clientName || doc.clientName; ownerId = doc.ownerId; }
  }

  if (!ownerId) {
    const [link] = await db
      .select({ clientName: documentLinks.clientName, ownerId: documentLinks.ownerId })
      .from(documentLinks)
      .where(eq(documentLinks.clientEmail, normalEmail))
      .orderBy(desc(documentLinks.createdAt))
      .limit(1);
    if (link) { clientName = clientName || link.clientName; ownerId = link.ownerId; }
  }

  if (!ownerId) {
    const [esign] = await db
      .select({ signerName: eSignatures.signerName, ownerId: eSignatures.ownerId })
      .from(eSignatures)
      .where(eq(eSignatures.signerEmail, normalEmail))
      .orderBy(desc(eSignatures.createdAt))
      .limit(1);
    if (esign) { clientName = clientName || esign.signerName; ownerId = esign.ownerId; }
  }

  if (!ownerId) {
    const [tr] = await db
      .select({ clientName: taxReturns.clientName, ownerId: taxReturns.ownerId })
      .from(taxReturns)
      .where(eq(taxReturns.clientEmail, normalEmail))
      .orderBy(desc(taxReturns.createdAt))
      .limit(1);
    if (tr) { clientName = clientName || tr.clientName; ownerId = tr.ownerId; }
  }

  if (!ownerId) {
    const [signer] = await db
      .select({
        name: engagementSigners.name,
        engagementId: engagementSigners.engagementId,
      })
      .from(engagementSigners)
      .where(eq(engagementSigners.email, normalEmail))
      .orderBy(desc(engagementSigners.createdAt))
      .limit(1);
    if (signer) {
      clientName = clientName || signer.name;
      const [eng] = await db
        .select({ ownerId: engagements.ownerId })
        .from(engagements)
        .where(eq(engagements.id, signer.engagementId))
        .limit(1);
      if (eng) ownerId = eng.ownerId;
    }
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Clean up: remove expired sessions for this email
  await db
    .delete(portalSessions)
    .where(
      and(
        eq(portalSessions.email, normalizedEmail),
        lt(portalSessions.expiresAt, new Date())
      )
    );

  // Limit active sessions to 5 per email — delete oldest if over limit
  const activeSessions = await db
    .select({ id: portalSessions.id })
    .from(portalSessions)
    .where(eq(portalSessions.email, normalizedEmail))
    .orderBy(asc(portalSessions.createdAt));

  if (activeSessions.length >= 5) {
    const toDelete = activeSessions.slice(0, activeSessions.length - 4);
    for (const s of toDelete) {
      await db.delete(portalSessions).where(eq(portalSessions.id, s.id));
    }
  }

  await db.insert(portalSessions).values({
    email: normalizedEmail,
    sessionToken,
    clientName,
    ownerId,
    expiresAt,
  });

  // Notify CPA of portal login
  if (ownerId) {
    try {
      await createNotification({
        userId: ownerId,
        type: "portal_login",
        title: "Client Portal Login",
        message: `${clientName || email} signed in to the client portal`,
        metadata: { clientEmail: email, clientName },
      });
    } catch {
      // Non-critical — don't block session creation
    }
  }

  return sessionToken;
}

/**
 * Look up a portal session by token. Returns null if expired or not found.
 */
export async function getPortalSession(
  sessionToken: string
): Promise<PortalSession | null> {
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
  return {
    email: session.email,
    clientName: session.clientName,
    ownerId: session.ownerId,
  };
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
): Promise<PortalSession | null> {
  const token = req.cookies.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  return getPortalSession(token);
}
