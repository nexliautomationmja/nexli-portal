/**
 * The AI avatar library a DRS client can pick from on their Launch Pad
 * (Nov 16 2026, Marcel). Client-safe data only.
 *
 * It mirrors nexli.net/ai-avatars (lib/ai-avatars.ts in the marketing site
 * repo): same slugs, names and Mux intro videos, alphabetical — plus any
 * avatar added here before the site has her (onSite: false). Daniela is
 * Nexli's own presenter and is never offered. WHEN THE SITE ADDS OR REMOVES
 * AN AVATAR, UPDATE THIS LIST TOO: the portrait images and intro pages are
 * served from nexli.net by slug.
 *
 * The rules (the site promises the same):
 *   - ONE AVATAR, ONE FIRM: while a firm is a client, no other client gets
 *     its avatar (lib/ai-avatar-claims.ts keeps the Launch Pads apart).
 *   - Nexli picks one for every firm at no charge; a firm that wants a
 *     specific one from the library pays AI_AVATAR_PICK_CENTS once, on its
 *     first monthly invoice (lib/digital-rainmaker.ts).
 */

export interface RosterAvatar {
  slug: string;
  name: string;
  /** Mux playback id of her intro video. */
  playbackId: string;
  /**
   * false = not on nexli.net yet (no portrait or page there): her card uses
   * the first frame of her intro video and links to her video instead. Flip
   * to true once the site has her.
   */
  onSite: boolean;
}

const avatar = (name: string, playbackId: string, opts: { onSite?: boolean } = {}): RosterAvatar => ({ slug: name.toLowerCase(), name, playbackId, onSite: opts.onSite ?? true });

export const AI_AVATAR_ROSTER: readonly RosterAvatar[] = [
  avatar("Abbey", "Rl1S1B537ZkFBmlCmNFCpECDcZt7h5uYYCNJrKYobjk"),
  avatar("Adrianna", "lAFoxqj02Kku5CW4D01rYGVDm8D9HC3hIK9q009VXymuCk"),
  avatar("Anika", "DTHW003pJfQb4V1Eput7ladg2xVlVsl01BcvIVAuts6fU"),
  avatar("Aniyah", "x6U1p7nPHu6z4Ojoy8pNE6Oc7mSGDpJ1D8MLGgt00C4s"),
  avatar("Donna", "PH02TyJHCdKPxQsbnZ6OqE7GkqpktWlbS7N669UXgHHk"),
  avatar("Eliana", "gNyx02HdVhfBzXiwYoxLv7BJ2VlTZ2FocA01br01JsHFUQ"),
  avatar("Grace", "Hllp02VnJB73F51bECbfdPt82Q0200kTl3plNFncEuHW7Q"),
  avatar("Jasmine", "3kXiwnnIiPmOHVgNsfP01mfylvBHy74HthX5VVK8m02Og"),
  avatar("Madeline", "wd1yUP9D003wyJQTUwJzzmSY1u1a802GdOYyUJeCPq00S00"),
  avatar("Natalya", "z00BOr02EoFa02knfil301jxLn8ID61sWc001E7WHQKhel4s"),
  avatar("Olivia", "b3md2n01hefpGcUNdEjKdcgt01lBVLDJnQ00o4QIxGUNwg"),
  avatar("Peyton", "1luaf45hNFa02Nrk6ocHzZvcKvAJoFDs7tmZHP00Hjg18"),
  avatar("Rene", "yllxGWf6AVrx4nAEg76i1RVmRb5FI3GgKhi3nmSCqIE"),
  avatar("Sofia", "zi14WHwTKvzsX9HCDiW6O3UU2IVSs02F3VEV2mJpVH01Y"),
  avatar("Vivian", "6Hdih9wWtXjCu3BtvtuJxvbf2W3sPzVZA4OgFlRbjw8"),
  // Nov 17 2026 (Marcel). Not on nexli.net/ai-avatars yet — see onSite.
  avatar("Yasmin", "6G5cdFpYM4ww6H19QNnxeWS00ibkoOFYigKCKtRWpBJI", { onSite: false }),
  avatar("Zoey", "F5RCKS3800Lbyl022micl67OafLWfEnzHQlzWdi8xTVh8"),
];

const SITE = "https://www.nexli.net";

/** The library page on nexli.net (every avatar, with intro videos). */
export const AVATAR_LIBRARY_URL = `${SITE}/ai-avatars`;

export function rosterAvatar(slug: unknown): RosterAvatar | null {
  return typeof slug === "string" ? (AI_AVATAR_ROSTER.find((a) => a.slug === slug) ?? null) : null;
}

/** Her 9:16 portrait (the card image on nexli.net, or her intro video's first frame from Mux until the site has her; CSP img-src allows both). */
export function portraitUrl(slug: string): string {
  const r = rosterAvatar(slug);
  if (r && !r.onSite) return `https://image.mux.com/${r.playbackId}/thumbnail.webp?time=0&width=720`;
  return `${SITE}/ai-avatars/${slug}/portrait.webp`;
}

/** Her page on nexli.net, with her intro video (or Mux's player for her video until the site has her). */
export function avatarPageUrl(slug: string): string {
  const r = rosterAvatar(slug);
  if (r && !r.onSite) return `https://player.mux.com/${r.playbackId}`;
  return `${SITE}/ai-avatars/${slug}`;
}

/** Display name for a slug ("olivia" → "Olivia"), even if she left the roster. */
export function avatarName(slug: string): string {
  return rosterAvatar(slug)?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}
