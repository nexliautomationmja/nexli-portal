/**
 * AI avatars (Nov 2026), shared by the server and the Avatars tab: limits and
 * what the browser gets for each avatar.
 */

/** Photos per avatar (a zip may hold more; the first ones by name are kept). */
export const AVATAR_MAX_PHOTOS = 12;
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
  read: { age: string; names: string[]; otherPerson: string[]; notes: string } | null;
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
  createdAt: string;
}

/** The main photo first, then the Kling picks — what Kling's Element is built from. */
export function klingPhotosOf(a: Pick<AvatarView, "mainPhotoId" | "klingPhotoIds" | "photos">): string[] {
  const ids = new Set(a.photos.map((p) => p.id));
  const main = a.mainPhotoId && ids.has(a.mainPhotoId) ? a.mainPhotoId : null;
  const extra = a.klingPhotoIds.filter((id) => ids.has(id) && id !== main).slice(0, KLING_EXTRA_PHOTOS);
  return main ? [main, ...extra] : [];
}
