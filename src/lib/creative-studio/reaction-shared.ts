/**
 * Reaction videos (Nov 2026), the parts the browser and the server share:
 * limits on the video she reacts to and how its times are written. No server
 * imports here.
 */

/** Longest video she can react to (Claude reads all of it; the light copy has to fit one 300 s request). */
export const SOURCE_MAX_SECONDS = 180;
/** Biggest upload (it's downloaded into a function's ~500 MB of scratch space). */
export const SOURCE_MAX_BYTES = 400 * 1024 * 1024;
/** What it can be: the same files the final cut takes. */
export const SOURCE_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov" };

/** "0:12" / "1:05.5": seconds as the user reads them on the video's own timeline. */
export function clock(s: number, tenths = false): string {
  const safe = Math.max(0, Number.isFinite(s) ? s : 0);
  // Round first, so 59.96 s reads 1:00 rather than 0:60.
  const total = tenths ? Math.round(safe * 10) : Math.floor(safe) * 10;
  const m = Math.floor(total / 600);
  const rest = total - m * 600;
  const whole = Math.floor(rest / 10);
  const frac = rest % 10;
  return `${m}:${String(whole).padStart(2, "0")}${frac ? `.${frac}` : ""}`;
}

/** "0:12", "12", "12.5" or "1:05.5" → seconds (null when it isn't a time). */
export function parseClock(text: string): number | null {
  const t = text.trim();
  const m = t.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const secs = (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
  return Number.isFinite(secs) ? Math.round(secs * 10) / 10 : null;
}

/** A prepare step (stills + words, or the light copy) still running: claimed less than 320 s ago (its route's limit is 300 s). */
export const CLAIM_STALE_S = 320;
export function claimLive(at: string | null | undefined, now = Date.now()): boolean {
  return Boolean(at && now - new Date(at).getTime() < CLAIM_STALE_S * 1000);
}

/** The video is too long to react to. */
export function tooLongMessage(durationS: number): string {
  return `This video is ${clock(durationS)} long. Trim it to ${clock(SOURCE_MAX_SECONDS)} or less and upload it again.`;
}
