import { WATCH_MAX_S, WATCH_MIN_S } from "@/lib/creative-studio/prompts";
import type { TranscriptWord } from "@/lib/creative-studio/tables";

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

/** A watch window from untrusted input ({ from, to } in seconds), to the tenth; null when it isn't one. */
export function readWatch(v: unknown): { from: number; to: number } | null {
  if (!v || typeof v !== "object") return null;
  const { from, to } = v as Record<string, unknown>;
  if (typeof from !== "number" || typeof to !== "number" || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  return { from: Math.round(from * 10) / 10, to: Math.round(to * 10) / 10 };
}

/** Why a part of the video can't be watched as one clip (null = it can). */
export function watchProblem(w: { from: number; to: number }, durationS: number | null): string | null {
  if (w.from < 0) return "A part can't start before the video does.";
  if (w.to <= w.from) return "A part has to end after it starts.";
  const len = w.to - w.from;
  if (len < WATCH_MIN_S - 0.05) return `Each part watched is at least ${WATCH_MIN_S} seconds.`;
  if (len > WATCH_MAX_S + 0.05) return `Each part watched is ${WATCH_MAX_S} seconds at most (one Kling clip). Split a longer stretch into two watch clips.`;
  if (durationS && w.to > durationS + 0.05) return `The video is only ${clock(durationS, true)} long.`;
  return null;
}

/**
 * The frame a reaction video needs, as a shot line for Manus: the presenter
 * holding the phone, off to the left, so the corner video (top right) doesn't
 * cover their face.
 */
export function reactionShot(name: string, pronoun: "she" | "he", vertical: boolean): string {
  const poss = pronoun === "he" ? "his" : "her";
  return vertical
    ? `${name} sitting slightly left of centre, holding ${poss} phone in one hand at chest height with the screen turned toward ${pronoun === "he" ? "him" : "her"}, looking into the camera. The upper right of the frame is calm, uncluttered background.`
    : `${name} on the left third of the frame, holding ${poss} phone in one hand at chest height with the screen turned toward ${pronoun === "he" ? "him" : "her"}, looking into the camera. The right half of the frame is calm, uncluttered background.`;
}

/**
 * The words as Claude reads them: phrases with their times in seconds on the
 * video (the unit Claude answers in), broken at sentence ends, pauses over
 * half a second, or 14 words.
 */
export function sourceTranscriptLines(words: TranscriptWord[]): string[] {
  const lines: string[] = [];
  let run: TranscriptWord[] = [];
  const flush = () => {
    if (run.length === 0) return;
    lines.push(`[${run[0].start.toFixed(1)}–${run[run.length - 1].end.toFixed(1)} s] ${run.map((w) => w.text).join(" ")}`);
    run = [];
  };
  words.forEach((w, i) => {
    run.push(w);
    const next = words[i + 1];
    const pause = next ? next.start - w.end : 0;
    if (!next || /[.!?…]["”')\]]*$/.test(w.text) || pause > 0.5 || run.length >= 14) flush();
  });
  flush();
  return lines;
}
