import type { ClipTranscript, CutOverride, CutSettings, ManualTrim } from "@/lib/creative-studio/tables";

/**
 * Pure auto-cut segment maths — shared by the server (which renders it) and
 * the trim editor (which previews it), so the preview matches the render.
 * No Node imports here.
 */

export const DEFAULT_CUT: CutSettings = { speed: 1.2, gap: 0.25 };
/** Source seconds kept before the first word / after the last word of a clip. */
export const LEAD = 0.1;
export const TAIL = 0.15;
const TIGHT_GAP = 0.12;
const LOOSE_GAP = 0.45;
const MIN_SEGMENT = 0.04;
/** Pause left (playback seconds) where cut words were removed. */
const CUT_JOIN_GAP = 0.06;

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Pause cap (playback seconds) for the boundary after word `i`, from the overrides (last one wins). */
function gapAfter(i: number, settings: CutSettings, overrides: CutOverride[]): number {
  let gap = settings.gap;
  for (const o of overrides) {
    // A range covers the boundaries inside it plus the one just before it.
    if (i >= o.fromWord - 1 && i <= o.toWord) {
      if (o.action === "tighten") gap = o.gapSeconds ?? TIGHT_GAP;
      else if (o.action === "loosen") gap = o.gapSeconds ?? LOOSE_GAP;
      else if (o.action === "restore") gap = Number.POSITIVE_INFINITY;
    }
  }
  return gap;
}

/** Word indexes removed by "cut" overrides (later "restore" wins back). */
export function cutWordSet(count: number, overrides: CutOverride[]): Set<number> {
  const out = new Set<number>();
  for (const o of overrides) {
    for (let i = Math.max(0, o.fromWord); i <= Math.min(count - 1, o.toWord); i++) {
      if (o.action === "cut") out.add(i);
      else if (o.action === "restore") out.delete(i);
    }
  }
  return out;
}

/** Turn a set of word indexes into "cut" override ranges. */
export function cutRanges(indexes: number[]): CutOverride[] {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  const out: CutOverride[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i === last.toWord + 1) last.toWord = i;
    else out.push({ fromWord: i, toWord: i, action: "cut" });
  }
  return out;
}

export function inWindow(w: { start: number; end: number }, manual: ManualTrim | null | undefined): boolean {
  if (!manual) return true;
  const mid = (w.start + w.end) / 2;
  return mid >= manual.start && mid <= manual.end;
}

/** Kept segments (source seconds) for one clip. */
export function computeSegments(args: {
  transcript: ClipTranscript | null;
  sourceS: number;
  settings: CutSettings;
  overrides: CutOverride[];
  manual?: ManualTrim | null;
}): { segments: { start: number; end: number }[]; keptS: number } {
  const { transcript, sourceS, settings, overrides } = args;
  const manual = args.manual ?? null;
  const lo = manual ? Math.max(0, manual.start) : 0;
  const hi = manual ? Math.min(sourceS, manual.end) : sourceS;
  const words = transcript?.words ?? [];
  const removed = cutWordSet(words.length, overrides);
  const kept = words.map((w, i) => ({ ...w, i })).filter((w) => !removed.has(w.i) && inWindow(w, manual));

  let segments: { start: number; end: number }[];
  if (kept.length === 0) {
    segments = [{ start: lo, end: hi }];
  } else {
    segments = [];
    let segStart = Math.max(0, kept[0].start - LEAD);
    for (let k = 0; k < kept.length - 1; k++) {
      const prev = kept[k];
      const next = kept[k + 1];
      const skippedWords = next.i - prev.i > 1;
      // Around a cut word the join is near-seamless, so the word's audio is really gone.
      const cap = skippedWords ? Math.min(settings.gap, CUT_JOIN_GAP) : gapAfter(prev.i, settings, overrides);
      const maxSrc = cap * settings.speed; // a pause of `cap` at playback speed
      const srcGap = next.start - prev.end;
      if (Number.isFinite(maxSrc) && srcGap > maxSrc) {
        segments.push({ start: segStart, end: prev.end + maxSrc / 2 });
        segStart = next.start - maxSrc / 2;
      }
    }
    const last = kept[kept.length - 1];
    segments.push({ start: segStart, end: Math.min(sourceS, last.end + TAIL) });
  }

  // Clamp to the take (and the manual window), merge overlaps, drop slivers, round.
  const cleaned: { start: number; end: number }[] = [];
  for (const s of segments.map((x) => ({ start: Math.max(lo, x.start), end: Math.min(hi, x.end) }))) {
    if (s.end - s.start < MIN_SEGMENT) continue;
    const prev = cleaned[cleaned.length - 1];
    if (prev && s.start <= prev.end + 0.01) prev.end = Math.max(prev.end, s.end);
    else cleaned.push({ ...s });
  }
  const finalSegs = (cleaned.length ? cleaned : [{ start: lo, end: hi }]).map((s) => ({ start: round3(s.start), end: round3(s.end) }));
  const keptS = round3(finalSegs.reduce((t, s) => t + (s.end - s.start), 0));
  return { segments: finalSegs, keptS };
}
