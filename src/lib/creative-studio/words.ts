import type { CaptionWord } from "@/remotion/types";
import type { TranscriptWord } from "@/lib/creative-studio/tables";

/**
 * The words file for captions (editing rulebook § 4): ALL CAPS, trailing
 * punctuation stripped with contractions kept, split money and split
 * compounds merged, and fatal assertions so a broken words file fails the
 * build instead of shipping a bad caption.
 *
 * Spoken-only spellings from the Kling framework become caption spellings:
 * "C-P-A" → "CPA", "I-R-S" → "IRS".
 */

const LETTER_SPELLINGS: Record<string, string> = { "C-P-A": "CPA", "I-R-S": "IRS", "C-E-O": "CEO", "P-AND-L": "P&L" };

export function normalizeWord(raw: string): string {
  let w = raw.trim().toUpperCase();
  w = w.replace(/^[“”"'(\[]+/, "").replace(/[“”")\]]+$/, "");
  w = w.replace(/[.,!?;:…]+$/, ""); // trailing punctuation only — keeps $9,997 and YOU'RE
  w = w.replace(/’/g, "'");
  for (const [spoken, shown] of Object.entries(LETTER_SPELLINGS)) {
    if (w === spoken || w.startsWith(`${spoken}'`)) w = w.replace(spoken, shown);
  }
  return w;
}

/** Merge "$9" + ",997", "$" + "9,997", and "FOLLOW" + "-UP" into single tokens. */
export function mergeTokens(words: CaptionWord[]): CaptionWord[] {
  const out: CaptionWord[] = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    const joinsMoney = prev && (/^[,.]\d/.test(w.word) && /\d$/.test(prev.word) || prev.word === "$" && /^\d/.test(w.word));
    const joinsCompound = prev && /^-\w/.test(w.word);
    if (joinsMoney || joinsCompound) {
      prev.word = `${prev.word}${w.word}`;
      prev.end = Math.max(prev.end, w.end);
    } else {
      out.push({ ...w });
    }
  }
  return out;
}

/** Fatal checks (rulebook): any failure throws with the offending tokens. */
export function assertWords(words: CaptionWord[]): void {
  const problems: string[] = [];
  const seen = new Map<number, string>();
  for (const w of words) {
    if (!(w.end > w.start)) problems.push(`zero-length "${w.word}" at ${w.start}`);
    const key = Math.round(w.start * 1000);
    if (seen.has(key)) problems.push(`"${seen.get(key)}" and "${w.word}" share start ${w.start}`);
    seen.set(key, w.word);
    if (/^-\w/.test(w.word)) problems.push(`unmerged fragment "${w.word}" at ${w.start}`);
    if (!w.word.trim()) problems.push(`empty token at ${w.start}`);
  }
  if (problems.length) throw new Error(`Caption words failed checks: ${problems.slice(0, 5).join("; ")}`);
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Repair tiny timing artifacts (not hallucinations): stacked or zero-length tokens get nudged apart. */
function tidyTimes(words: CaptionWord[]): CaptionWord[] {
  const out = [...words].sort((a, b) => a.start - b.start).map((w) => ({ ...w, start: r3(w.start), end: r3(w.end) }));
  for (let i = 0; i < out.length; i++) {
    const prev = out[i - 1];
    if (prev && out[i].start <= prev.start) out[i].start = r3(prev.start + 0.01);
    const next = out[i + 1];
    if (out[i].end <= out[i].start) out[i].end = r3(Math.min(out[i].start + 0.12, next ? Math.max(next.start, out[i].start + 0.01) : out[i].start + 0.12));
  }
  return out;
}

/**
 * Use the approved script's spelling when the take's words line up with the
 * script one-for-one (Scribe supplies only the timings); otherwise keep what
 * Scribe heard. Returns whether the script spelling was used.
 */
export function alignToScript(heard: CaptionWord[], scriptLine: string): { words: CaptionWord[]; aligned: boolean } {
  const script = mergeTokens(
    scriptLine
      .split(/\s+/)
      .map(normalizeWord)
      .filter(Boolean)
      .map((word) => ({ word, start: 0, end: 0 }))
  ).map((w) => w.word);
  if (script.length === heard.length && script.length > 0) {
    return { words: heard.map((w, i) => ({ ...w, word: script[i] })), aligned: true };
  }
  return { words: heard, aligned: false };
}

export interface CutClipWords {
  line: string;
  words: TranscriptWord[];
  segments: { start: number; end: number }[];
}

/**
 * Caption words on the final cut's timeline, from each clip's word timings
 * mapped through its kept segments and the playback speed.
 */
export function cutTimelineWords(clips: CutClipWords[], speed: number): { words: CaptionWord[]; unaligned: number[] } {
  const all: CaptionWord[] = [];
  const unaligned: number[] = [];
  let offset = 0;
  clips.forEach((clip, ci) => {
    const kept = clip.segments.reduce((t, s) => t + (s.end - s.start), 0);
    const mapped: CaptionWord[] = [];
    for (const w of clip.words) {
      const mid = (w.start + w.end) / 2;
      let before = 0;
      for (const s of clip.segments) {
        if (mid >= s.start && mid <= s.end) {
          const a = Math.max(w.start, s.start);
          const b = Math.min(w.end, s.end);
          mapped.push({ word: normalizeWord(w.text), start: offset + (before + (a - s.start)) / speed, end: offset + (before + (b - s.start)) / speed });
          break;
        }
        before += s.end - s.start;
      }
    }
    const merged = mergeTokens(mapped.filter((w) => w.word));
    const { words, aligned } = alignToScript(merged, clip.line);
    if (!aligned) unaligned.push(ci + 1);
    all.push(...words);
    offset += kept / speed;
  });
  return { words: finalizeWords(all), unaligned };
}

/** Sort, repair stacked/zero-length timings, and run the fatal checks. */
export function finalizeWords(words: CaptionWord[]): CaptionWord[] {
  const out = tidyTimes(words);
  assertWords(out);
  return out;
}

const bare = (w: string) => normalizeWord(w).replace(/[^A-Z0-9$&%']/g, "");

/**
 * The rulebook's `swap` op from a plain-English correction ("the caption says
 * CALCULATING, it should be CALENDAR"): replace every run of tokens matching
 * `find` with `replace`, keeping the run's timing (spread evenly when the
 * word count changes).
 */
export function applySwaps(words: CaptionWord[], swaps: { find: string; replace: string }[]): { words: CaptionWord[]; applied: number } {
  let out = [...words];
  let applied = 0;
  for (const sw of swaps) {
    const find = sw.find.split(/\s+/).map(bare).filter(Boolean);
    const repl = sw.replace.split(/\s+/).map(normalizeWord).filter(Boolean);
    if (find.length === 0 || repl.length === 0) continue;
    const next: CaptionWord[] = [];
    for (let i = 0; i < out.length; ) {
      const hit = find.every((f, k) => out[i + k] && bare(out[i + k].word) === f);
      if (!hit) {
        next.push(out[i]);
        i++;
        continue;
      }
      const start = out[i].start;
      const end = out[i + find.length - 1].end;
      const step = (end - start) / repl.length;
      repl.forEach((word, k) => next.push({ word, start: start + step * k, end: k === repl.length - 1 ? end : start + step * (k + 1) }));
      applied++;
      i += find.length;
    }
    out = next;
  }
  return { words: finalizeWords(mergeTokens(out)), applied };
}

/** Caption words for an uploaded cut transcribed as one file. */
export function wholeCutWords(words: TranscriptWord[]): CaptionWord[] {
  return finalizeWords(mergeTokens(words.map((w) => ({ word: normalizeWord(w.text), start: w.start, end: w.end })).filter((w) => w.word)));
}

/**
 * Retype words [from..to] of the captions by hand (a misheard word, a line
 * you want worded differently). The new words share that span's timing;
 * empty text removes them. Same rules and checks as the words file.
 */
export function replaceCaptionWords(words: CaptionWord[], from: number, to: number, text: string): CaptionWord[] {
  const a = Math.max(0, Math.min(from, to));
  const b = Math.min(words.length - 1, Math.max(from, to));
  if (a > b || !words[a]) return words;
  const next = mergeTokens(text.split(/\s+/).map(normalizeWord).filter(Boolean).map((word) => ({ word, start: 0, end: 0 })));
  const start = words[a].start;
  const end = words[b].end;
  const step = (end - start) / Math.max(1, next.length);
  const placed = next.map((w, k) => ({ word: w.word, start: start + step * k, end: k === next.length - 1 ? end : start + step * (k + 1) }));
  return finalizeWords([...words.slice(0, a), ...placed, ...words.slice(b + 1)]);
}
