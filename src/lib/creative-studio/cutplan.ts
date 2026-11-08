import type { ClipTranscript, CutOverride, CutSettings, ManualTrim, TimeCut } from "@/lib/creative-studio/tables";

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
/** Shortest section you can cut out by hand (about one frame). */
export const MIN_SECTION = 0.03;
/** Shortest clip a trim may leave. */
export const MIN_KEPT = 0.2;

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

/** Hand-cut sections, cleaned: inside the take, in order, overlaps merged, slivers dropped, rounded. */
export function normalizeSections(sections: readonly TimeCut[] | null | undefined, sourceS: number): TimeCut[] {
  const sorted = (sections ?? [])
    .map((x) => ({ start: Math.max(0, Math.min(x.start, x.end)), end: Math.min(sourceS, Math.max(x.start, x.end)) }))
    .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end) && x.end - x.start >= MIN_SECTION)
    .sort((a, b) => a.start - b.start);
  const out: TimeCut[] = [];
  for (const x of sorted) {
    const prev = out[out.length - 1];
    if (prev && x.start <= prev.end) prev.end = Math.max(prev.end, x.end);
    else out.push({ ...x });
  }
  return out.map((x) => ({ start: round3(x.start), end: round3(x.end) }));
}

/** True when the word is (mostly) inside a hand-cut section. */
export function inSections(w: { start: number; end: number }, sections: readonly TimeCut[]): boolean {
  const mid = (w.start + w.end) / 2;
  return sections.some((x) => mid >= x.start && mid <= x.end);
}

/** Remove the sections from the segments, exactly. */
function subtractSections(segments: { start: number; end: number }[], sections: readonly TimeCut[]) {
  let out = segments;
  for (const x of sections) {
    out = out.flatMap((s) => {
      if (x.end <= s.start || x.start >= s.end) return [s];
      const parts: { start: number; end: number }[] = [];
      if (x.start > s.start) parts.push({ start: s.start, end: x.start });
      if (x.end < s.end) parts.push({ start: x.end, end: s.end });
      return parts;
    });
  }
  return out;
}

/** Kept segments (source seconds) for one clip. */
export function computeSegments(args: {
  transcript: ClipTranscript | null;
  sourceS: number;
  settings: CutSettings;
  overrides: CutOverride[];
  manual?: ManualTrim | null;
  sections?: readonly TimeCut[] | null;
}): { segments: { start: number; end: number }[]; keptS: number } {
  const { transcript, sourceS, settings, overrides } = args;
  const manual = args.manual ?? null;
  const sections = normalizeSections(args.sections, sourceS);
  const lo = manual ? Math.max(0, manual.start) : 0;
  const hi = manual ? Math.min(sourceS, manual.end) : sourceS;
  const words = transcript?.words ?? [];
  const removed = cutWordSet(words.length, overrides);
  // A word a hand-cut section covers is gone (so the auto edges skip it); a
  // word it only clips keeps its uncut part — otherwise the pause tightening
  // would treat that leftover as silence and eat it. The section's own edges
  // decide the join, not the cut-word join below.
  const kept = words
    .map((w, i) => ({ ...w, i }))
    .filter((w) => !removed.has(w.i) && inWindow(w, manual))
    .flatMap((w) => {
      if (!sections.length) return [w];
      const left = subtractSections([{ start: w.start, end: w.end }], sections);
      return left.length ? [{ ...w, start: left[0].start, end: left[left.length - 1].end }] : [];
    });
  const cutBetween = (a: number, b: number) => {
    for (let j = a + 1; j < b; j++) if (removed.has(j)) return true;
    return false;
  };

  let segments: { start: number; end: number }[];
  if (kept.length === 0) {
    segments = [{ start: lo, end: hi }];
  } else {
    segments = [];
    // A manual trim is exact: the clip starts and ends where the handles are.
    let segStart = manual ? lo : Math.max(0, kept[0].start - LEAD);
    for (let k = 0; k < kept.length - 1; k++) {
      const prev = kept[k];
      const next = kept[k + 1];
      const skippedWords = cutBetween(prev.i, next.i);
      // Around a cut word the join is near-seamless, so the word's audio is really gone.
      const cap = skippedWords
        ? Math.min(settings.gap, CUT_JOIN_GAP)
        : manual?.keepPauses
          ? Number.POSITIVE_INFINITY
          : gapAfter(prev.i, settings, overrides);
      const maxSrc = cap * settings.speed; // a pause of `cap` at playback speed
      const srcGap = next.start - prev.end;
      if (Number.isFinite(maxSrc) && srcGap > maxSrc) {
        segments.push({ start: segStart, end: prev.end + maxSrc / 2 });
        segStart = next.start - maxSrc / 2;
      }
    }
    const last = kept[kept.length - 1];
    segments.push({ start: segStart, end: manual ? hi : Math.min(sourceS, last.end + TAIL) });
  }

  // Clamp to the take (and the manual window), cut the hand sections out,
  // merge overlaps, drop slivers, round.
  const clamped = segments.map((x) => ({ start: Math.max(lo, x.start), end: Math.min(hi, x.end) }));
  const cleaned: { start: number; end: number }[] = [];
  for (const s of subtractSections(clamped, sections)) {
    if (s.end - s.start < MIN_SEGMENT) continue;
    const prev = cleaned[cleaned.length - 1];
    // Never merge across a hand-cut section, however short it is.
    const across = prev && sections.some((x) => x.start >= prev.end - 0.001 && x.end <= s.start + 0.001);
    if (prev && !across && s.start <= prev.end + 0.01) prev.end = Math.max(prev.end, s.end);
    else cleaned.push({ ...s });
  }
  // Nothing left: the whole window (a trim that cuts everything is refused before it's saved).
  const fallback = subtractSections([{ start: lo, end: hi }], sections).filter((s) => s.end - s.start >= MIN_SEGMENT);
  const finalSegs = (cleaned.length ? cleaned : fallback.length ? fallback : [{ start: lo, end: hi }]).map((s) => ({
    start: round3(s.start),
    end: round3(s.end),
  }));
  const keptS = round3(finalSegs.reduce((t, s) => t + (s.end - s.start), 0));
  return { segments: finalSegs, keptS };
}
