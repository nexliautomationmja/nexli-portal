/**
 * AI avatars (Nov 2026), shared by the server and the Avatars tab: limits and
 * what the browser gets for each avatar.
 */

/**
 * Photos per avatar (a zip may hold many more: an even spread is kept). Once
 * it's given to a firm, every one of them is that studio's to use as a frame
 * or a Manus reference.
 */
export const AVATAR_MAX_PHOTOS = 60;
/** Claude reads them all (as small copies) when it sets the avatar up — an even spread past this many. */
export const READ_MAX_PHOTOS = 60;

/** `n` items spread evenly through `list` (first and last included), in order. */
export function spread<T>(list: T[], n: number): T[] {
  if (n <= 0) return [];
  if (list.length <= n) return list;
  if (n === 1) return [list[0]];
  const picks = new Set<number>();
  for (let i = 0; i < n; i++) picks.add(Math.round((i * (list.length - 1)) / (n - 1)));
  return [...picks].sort((a, b) => a - b).map((i) => list[i]);
}

/**
 * An avatar's photos in the order its studio should offer them (reference
 * strip, Manus): the main photo, its Kling angles, then the rest — minus any
 * Claude flagged as someone else.
 */
export function rankAvatarPhotos<T extends { id: string }>(
  photos: T[],
  avatar: { mainPhotoId: string | null; klingPhotoIds: string[] | null; avatarRead: { otherPerson?: string[] } | null }
): T[] {
  const skip = new Set(avatar.avatarRead?.otherPerson ?? []);
  const kling = avatar.klingPhotoIds ?? [];
  const rank = (id: string) => (id === avatar.mainPhotoId ? 0 : kling.includes(id) ? 1 + kling.indexOf(id) : 10);
  return photos.filter((p) => !skip.has(p.id)).sort((a, b) => rank(a.id) - rank(b.id));
}
/** Kling Elements take a main photo plus 1–3 more angles. */
export const KLING_EXTRA_PHOTOS = 3;
/**
 * The line the voice sample says: ElevenLabs Voice Design takes 100–1000
 * characters, but the sample is also the Kling Element's voice, which takes
 * 5–30 seconds of speech — about 450 characters at most.
 */
export const SAMPLE_MIN = 100;
export const SAMPLE_MAX = 450;
export const VOICE_DESCRIPTION_MIN = 20;
export const VOICE_DESCRIPTION_MAX = 1000;

export type KlingStatus =
  /** Not locked in yet. */
  | "not_locked"
  /** Locked in, but Kling needs a second photo (main + at least one more angle). */
  | "needs_photo"
  /** Locked in; the Kling Element hasn't been made yet (or is being made). */
  | "pending"
  | "ready"
  | "error";

export interface AvatarPhoto {
  id: string;
  url: string | null;
  width: number | null;
  height: number | null;
}

export interface AvatarView {
  id: string;
  name: string;
  pronoun: "she" | "he";
  look: string;
  bestFor: string;
  note: string;
  /** The voice description (what the voice was designed from). */
  voice: string;
  /** The line the chosen voice says, and the mp3 (signed) once locked in. */
  voiceSample: string;
  voiceUrl: string | null;
  photos: AvatarPhoto[];
  mainPhotoId: string | null;
  klingPhotoIds: string[];
  /** What Claude saw (null until it has read the photos). */
  read: { age: string; names: string[]; otherPerson: string[]; notes: string; selfie: string | null } | null;
  /** The voices to pick from before lock-in. */
  options: { description: string; sample: string; voices: { generatedVoiceId: string; url: string | null; durationS: number | null }[] } | null;
  locked: boolean;
  /** ElevenLabs kept the voice (false: only the sample exists). */
  voiceKept: boolean;
  kling: { status: KlingStatus; error: string | null };
  /** The firm it belongs to (null = still in the library). */
  assigned: { studioKey: string; studioName: string; at: string } | null;
  /** Videos made with it (assignment can only be undone at 0). */
  videos: number;
  /** Their aura in a few words, and the line they say in the trial video. */
  personality: string;
  intro: string;
  /** The photo the trial video starts from: Claude's pick of a selfie-style photo, else the main photo. */
  trialPhotoId: string | null;
  /** The trial video (a normal video in the studio it was made in), if one was made. */
  trial: { projectId: string; status: string; title: string } | null;
  /** Manus making more photos of them, while it runs (or failed). */
  photoTask: { status: "running" | "waiting" | "failed"; taskUrl: string | null; waiting: string | null; error: string | null } | null;
  createdAt: string;
}

/** About what the trial video costs on Kling (8–12 seconds at 12 credits a second). */
export const TRIAL_CREDITS = "100–150";

/** The main photo first, then the Kling picks — what Kling's Element is built from. */
export function klingPhotosOf(a: Pick<AvatarView, "mainPhotoId" | "klingPhotoIds" | "photos">): string[] {
  const ids = new Set(a.photos.map((p) => p.id));
  const main = a.mainPhotoId && ids.has(a.mainPhotoId) ? a.mainPhotoId : null;
  const extra = a.klingPhotoIds.filter((id) => ids.has(id) && id !== main).slice(0, KLING_EXTRA_PHOTOS);
  return main ? [main, ...extra] : [];
}
