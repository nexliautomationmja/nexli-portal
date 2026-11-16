import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { engagements } from "@/db/schema";
import { effectiveAvatar, type AvatarStateLike } from "./ai-avatar-choice";

/**
 * Which library avatars are already a firm's (Nov 16 2026: "one avatar, one
 * firm"). Every Launch Pad of this owner whose engagement hasn't been
 * terminated holds its avatar: the client's paid pick, or the one Nexli
 * assigned. Returns slug → the engagement holding it.
 */
export async function avatarClaims(ownerId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      id: engagements.id,
      task: sql<unknown>`${engagements.metadata}->'onboarding'->'tasks'->'ai_avatar'`,
      assigned: sql<unknown>`${engagements.metadata}->'onboarding'->'avatarAssigned'`,
    })
    .from(engagements)
    .where(
      and(
        eq(engagements.ownerId, ownerId),
        sql`${engagements.metadata}->'onboarding' IS NOT NULL`,
        sql`${engagements.metadata}->>'terminatedAt' IS NULL`,
        sql`(${engagements.metadata}->'onboarding'->'tasks'->'ai_avatar' IS NOT NULL OR ${engagements.metadata}->'onboarding'->'avatarAssigned' IS NOT NULL)`
      )
    );
  const claims = new Map<string, string>();
  for (const r of rows) {
    const state: AvatarStateLike = {
      tasks: { ai_avatar: (r.task as { status?: string; submission?: unknown } | null) ?? null },
      avatarAssigned: (r.assigned as AvatarStateLike["avatarAssigned"]) ?? null,
    };
    const avatar = effectiveAvatar(state);
    if (avatar && !claims.has(avatar.slug)) claims.set(avatar.slug, r.id);
  }
  return claims;
}

/** Slugs other firms hold — the Launch Pad shows them as Taken. */
export async function takenAvatarSlugs(ownerId: string, engagementId: string): Promise<string[]> {
  const claims = await avatarClaims(ownerId);
  return [...claims].filter(([, id]) => id !== engagementId).map(([slug]) => slug);
}
