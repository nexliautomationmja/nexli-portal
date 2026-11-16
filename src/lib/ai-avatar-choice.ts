// ══════════════════════════════════════════════════════════
// "Your AI Avatar" — the Launch Pad item (ai_avatar), Nov 16 2026 (Marcel):
//   Default → "We're selecting your AI avatar": Nexli picks one for the firm
//             at no charge (the admin records it: onboarding.avatarAssigned).
//   Pick    → the client chooses a specific avatar from the library for
//             AI_AVATAR_PICK_CENTS ($2,500) one-time, added to their first
//             monthly invoice when the build is done (lib/digital-rainmaker).
// Either way the avatar is exclusive to that firm (lib/ai-avatar-claims).
// The client can change or drop a pick until the first monthly invoice is
// sent; after that it's locked.
//
// Client-safe (no db): shared by the Launch Pad, the submit route, billing
// and the admin Onboarding page.
// ══════════════════════════════════════════════════════════

import { AI_AVATAR_PICK_CENTS } from "./drs-pricing";
import { avatarName, rosterAvatar } from "./ai-avatar-roster";

export interface AvatarChoice {
  /** "pick" = the client chose this avatar (paid); "nexli" = let Nexli choose (no charge). */
  choice: "pick" | "nexli";
  /** Library slug when choice is "pick". */
  slug: string | null;
  /** The one-time fee agreed to (0 when Nexli chooses). */
  feeCents: number;
  /** When the client ticked "I agree to the one-time fee" (server time). */
  acceptedAt: string | null;
  /** The signer who agreed. */
  acceptedBy: string | null;
}

/**
 * Check what the Launch Pad sent. The server adds acceptedAt / acceptedBy.
 * Errors are written for the client.
 */
export function cleanAvatarChoice(
  raw: unknown,
  opts: { acceptedBy?: string | null; now?: Date } = {}
): { ok: true; value: AvatarChoice } | { ok: false; error: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (r.choice === "nexli") {
    return { ok: true, value: { choice: "nexli", slug: null, feeCents: 0, acceptedAt: null, acceptedBy: null } };
  }
  if (r.choice === "pick") {
    const avatar = rosterAvatar(r.slug);
    if (!avatar) return { ok: false, error: "Pick an avatar from the library." };
    if (r.agreeFee !== true) return { ok: false, error: `Tick the box to agree to the one-time ${feeText()} fee.` };
    return {
      ok: true,
      value: {
        choice: "pick",
        slug: avatar.slug,
        feeCents: AI_AVATAR_PICK_CENTS,
        acceptedAt: (opts.now ?? new Date()).toISOString(),
        acceptedBy: opts.acceptedBy?.trim().slice(0, 200) || null,
      },
    };
  }
  return { ok: false, error: "Choose an avatar, or let us pick one for you." };
}

/** The saved answer, or null when there isn't one. */
export function asAvatarChoice(sub: unknown): AvatarChoice | null {
  const r = (sub && typeof sub === "object" ? sub : null) as Partial<AvatarChoice> | null;
  if (!r || (r.choice !== "pick" && r.choice !== "nexli")) return null;
  return {
    choice: r.choice,
    slug: typeof r.slug === "string" ? r.slug : null,
    feeCents: typeof r.feeCents === "number" ? r.feeCents : 0,
    acceptedAt: typeof r.acceptedAt === "string" ? r.acceptedAt : null,
    acceptedBy: typeof r.acceptedBy === "string" ? r.acceptedBy : null,
  };
}

/** The minimal onboarding shape these helpers read (server state or the client payload). */
export interface AvatarStateLike {
  tasks?: { ai_avatar?: { status?: string; submission?: unknown } | null } | null;
  avatarAssigned?: { slug: string; at: string } | null;
}

/**
 * The client's paid pick — what billing adds to the first monthly invoice.
 * Null when they didn't pick, the fee wasn't agreed, or Nexli sent it back.
 */
export function avatarPickOf(state: AvatarStateLike | null | undefined): { slug: string; name: string; feeCents: number } | null {
  const task = state?.tasks?.ai_avatar;
  if (!task || task.status === "needs_attention" || task.status === "todo") return null;
  const c = asAvatarChoice(task.submission);
  if (!c || c.choice !== "pick" || !c.slug || !c.acceptedAt || c.feeCents <= 0) return null;
  return { slug: c.slug, name: avatarName(c.slug), feeCents: c.feeCents };
}

/** The firm's avatar today: their paid pick, else Nexli's assignment, else none yet. */
export function effectiveAvatar(
  state: AvatarStateLike | null | undefined
): { slug: string; name: string; source: "client" | "nexli" } | null {
  const pick = avatarPickOf(state);
  if (pick) return { slug: pick.slug, name: pick.name, source: "client" };
  const assigned = state?.avatarAssigned?.slug;
  return assigned ? { slug: assigned, name: avatarName(assigned), source: "nexli" } : null;
}

export function feeText(cents: number = AI_AVATAR_PICK_CENTS): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}
