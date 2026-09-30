/**
 * Password setup tokens — sent in the Foundation welcome email so a newly
 * provisioned firm owner can choose their first password.
 *
 * Only the sha256 hash of the raw token is stored. Creating a new token
 * invalidates any prior unused tokens for the same user.
 */

import crypto from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordSetupTokens } from "@/db/schema";
import { PASSWORD_SETUP_TTL_DAYS, getPortalUrl } from "./foundation-config";

export function hashSetupToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function getPasswordSetupUrl(rawToken: string): string {
  return `${getPortalUrl()}/setup-password/${rawToken}`;
}

export async function createPasswordSetupToken(
  userId: string,
  ttlDays: number = PASSWORD_SETUP_TTL_DAYS
): Promise<{ rawToken: string; setupUrl: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashSetupToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Invalidate prior unused tokens for this user.
  await db
    .update(passwordSetupTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordSetupTokens.userId, userId),
        isNull(passwordSetupTokens.usedAt)
      )
    );

  await db.insert(passwordSetupTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { rawToken, setupUrl: getPasswordSetupUrl(rawToken), expiresAt };
}

/**
 * Read-only check used by the setup page to decide whether to render the form.
 */
export async function peekPasswordSetupToken(
  raw: string
): Promise<{ userId: string; expiresAt: Date } | null> {
  if (!raw || raw.length > 256) return null;
  const [row] = await db
    .select({
      userId: passwordSetupTokens.userId,
      expiresAt: passwordSetupTokens.expiresAt,
    })
    .from(passwordSetupTokens)
    .where(
      and(
        eq(passwordSetupTokens.tokenHash, hashSetupToken(raw)),
        isNull(passwordSetupTokens.usedAt),
        gt(passwordSetupTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * Atomically consume a token: it must be unexpired and unused. Returns the
 * owning userId, or null if the token is invalid.
 */
export async function consumePasswordSetupToken(
  raw: string
): Promise<{ userId: string } | null> {
  if (!raw || raw.length > 256) return null;
  const [row] = await db
    .update(passwordSetupTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordSetupTokens.tokenHash, hashSetupToken(raw)),
        isNull(passwordSetupTokens.usedAt),
        gt(passwordSetupTokens.expiresAt, new Date())
      )
    )
    .returning({ userId: passwordSetupTokens.userId });
  return row ? { userId: row.userId } : null;
}
