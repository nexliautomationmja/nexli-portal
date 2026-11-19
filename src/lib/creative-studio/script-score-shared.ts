import { CAPS, RUBRIC, bandOf, type Band, type RubricKey } from "@/lib/ads/grader-shared";
import { OFFER_FACTS } from "@/lib/creative-studio/offer-facts";

/**
 * A script's score out of 100 (Nov 19 2026), on the Ad Grader's seven points
 * and weights — as a FIXED CHECKLIST, not a judgment. Marcel saw the first
 * version's scores move from run to run ("make sure it adheres to a real
 * scoring metric and not just making things up"), so:
 *
 *   - 19 checks, each worth a fixed number of points; a point's score is the
 *     sum of the checks it passes. The seven points add up to 100.
 *   - 12 checks are MEASURED in code from the script's words (clip 1's
 *     length, a number in the hook, old-offer wording, clip count, line
 *     length, the qualifier, the call to book, stock phrases, words copied
 *     from the reference…). Same script, same result, every time.
 *   - 7 are yes/no questions Claude answers, and an answer only counts when
 *     it quotes the script: code checks the quote is really in the clip it
 *     names. An unbacked "yes" is a no; an unbacked "no" (for checks that
 *     look for a problem) is a yes.
 *   - A score belongs to the exact script it read (`key`) and is never
 *     re-scored: only a changed script gets a new score.
 *
 * Scripts recreated in Nexli's studio are scored after they're written; a
 * script under 80 (or with a point under 7 of 10) gets ONE automatic rewrite
 * along its path to 90, then is scored again. Pure and client-safe.
 */

export const SCORE_VERSION = 2;

/** A point below this (of 10) triggers the automatic rewrite. */
export const WEAK_BELOW = 7;
/** A script under this total is also rewritten once, automatically, along its path to 90. */
export const AUTO_BELOW = 80;
/** The two marks the path aims for (Marcel: "how we can get it closer to an 80 or a 90"). */
export const TARGETS = [80, 90] as const;

// ── The checklist ───────────────────────────────────────

export type CheckId =
  | "hook_short"
  | "hook_no_warmup"
  | "hook_number"
  | "hook_specific"
  | "hook_audience"
  | "offer_clean"
  | "offer_stated"
  | "belief_shift"
  | "lines_short"
  | "clip_count"
  | "pace"
  | "proof_numbers"
  | "proof_mechanism"
  | "cta_ask"
  | "cta_next"
  | "no_stock"
  | "not_copied"
  | "qualifier"
  | "owner_pains";

export interface CheckDef {
  id: CheckId;
  point: RubricKey;
  points: number;
  /** measured = code reads it from the words; claude = yes/no that must quote the script. */
  source: "measured" | "claude";
  label: string;
  /** Claude checks: "presence" needs a quote to pass; "absence" needs a quote to fail. */
  proof?: "presence" | "absence";
  /** Claude checks: the exact yes/no question. */
  question?: string;
}

export const CHECKS: readonly CheckDef[] = [
  // Hook — first 3 seconds (25)
  { id: "hook_short", point: "hook", points: 5, source: "measured", label: "Clip 1 is 14 words or fewer, so it lands in the first seconds" },
  { id: "hook_no_warmup", point: "hook", points: 5, source: "measured", label: "Clip 1 starts on the point, not a greeting or warm-up" },
  { id: "hook_number", point: "hook", points: 5, source: "measured", label: "A concrete number or dollar figure in clip 1 or 2" },
  { id: "hook_specific", point: "hook", points: 5, source: "claude", proof: "presence", label: "Clip 1 makes one specific claim, callout or pain", question: "Does clip 1 make one specific claim, callout, number or pain (not a greeting, an intro or a vague setup)? Quote the words in clip 1 that do it." },
  { id: "hook_audience", point: "hook", points: 5, source: "claude", proof: "presence", label: "Clip 1 or 2 names CPA firm owners or their exact problem", question: "Does clip 1 or 2 say who it's for (owners of CPA or accounting firms) or name their exact problem? Quote it." },
  // Message & offer (20)
  { id: "offer_clean", point: "message", points: 8, source: "measured", label: "No old offer (setup fee, $9,997, annual, month to month, ad credits)" },
  { id: "offer_stated", point: "message", points: 4, source: "measured", label: "States the $10,000 monthly fee (VSL; ads leave the price to the VSL)" },
  { id: "belief_shift", point: "message", points: 8, source: "claude", proof: "presence", label: "One clear new belief replaces an old one", question: "Does the script state one clear new belief that replaces an old one the viewer holds? Quote the clip where the new belief is stated." },
  // Built for Meta / the page (15)
  { id: "lines_short", point: "meta_fit", points: 5, source: "measured", label: "Every line is 30 words or fewer (one clip, under 12 seconds)" },
  { id: "clip_count", point: "meta_fit", points: 5, source: "measured", label: "The framework's length: 7–11 clips for an ad, 30–50 for a VSL" },
  { id: "pace", point: "meta_fit", points: 5, source: "claude", proof: "absence", label: "No run of 5+ clips stuck on the same point", question: "Is there a run of 5 or more clips in a row that keeps repeating the same point? Answer pass=false ONLY if so, and quote a clip in that run. Otherwise pass=true." },
  // Proof (10)
  { id: "proof_numbers", point: "proof", points: 4, source: "measured", label: "At least 3 clips carry a concrete number (the math)" },
  { id: "proof_mechanism", point: "proof", points: 6, source: "claude", proof: "presence", label: "Shows how it works (mechanism, math or system steps), not adjectives", question: "Does the script show how the result is produced (the mechanism, the math, or the system's steps), rather than only describing it with adjectives? Quote one clip that does." },
  // Call to action (10)
  { id: "cta_ask", point: "cta", points: 5, source: "measured", label: "One of the last 3 clips asks for the action (book the call / watch the video)" },
  { id: "cta_next", point: "cta", points: 5, source: "claude", proof: "presence", label: "Says what happens next (what the call or the next page shows)", question: "Does the script tell the viewer what happens after they act (what the next page or the call shows them)? Quote it." },
  // Fresh (10)
  { id: "no_stock", point: "fresh", points: 5, source: "measured", label: "No stock agency phrases (game-changer, next level, unlock…)" },
  { id: "not_copied", point: "fresh", points: 5, source: "measured", label: "No 6-word run copied from the reference video" },
  // Right audience (10)
  { id: "qualifier", point: "audience", points: 5, source: "measured", label: "Has the qualifier: CPA firms doing 750K to 1 million" },
  { id: "owner_pains", point: "audience", points: 5, source: "claude", proof: "presence", label: "The pains and outcomes are a firm owner's, not a consumer's", question: "Are the pains and outcomes those of a CPA firm owner (their clients, fees, capacity, the firm's growth) rather than a consumer's? Quote one clip that shows it." },
];

export const CLAUDE_CHECKS = CHECKS.filter((c) => c.source === "claude");
const DEF = new Map(CHECKS.map((c) => [c.id, c]));

// ── Types ───────────────────────────────────────────────

export interface ScoreCheck {
  id: CheckId;
  point: RubricKey;
  label: string;
  points: number;
  source: "measured" | "claude";
  pass: boolean;
  /** What it saw: a measurement ("clip 1 is 19 words") or the verified quote. */
  evidence: string;
  /** The clip the evidence is in (1-based), when there is one. */
  clip: number | null;
  /** The change that passes it (empty when it passes). */
  fix: string;
}

export interface ScriptScoreSub {
  key: RubricKey;
  label: string;
  weight: number;
  /** 0–10: the points earned ÷ the weight. */
  score: number;
  /** Points earned out of `weight` (the sum of its passed checks). */
  points: number;
  why: string;
  fix: string;
}

export interface ScriptScore {
  v: number;
  /** scriptKey() of the lines it scored. */
  key: string;
  score: number;
  raw: number;
  band: Band;
  subs: ScriptScoreSub[];
  checks?: ScoreCheck[];
  caps: { key: "policy_risk"; label: string; max: number; why: string }[];
  /** Old-offer wording found in the lines. */
  oldOffer: string[];
  verdict: string;
  /** The one automatic improvement has been used on this video. */
  improved: boolean;
  /** Set right after a rewrite: the score it had before. */
  before: number | null;
  /** A rewrite just replaced the script (the next score shows "before"). */
  justImproved?: boolean;
  /** A score, the automatic improvement, or a rewrite toward 80/90 ("apply") running now (claimed; stale after 320 s). */
  pending?: { kind: "score" | "improve" | "apply"; at: string } | null;
  at: string;
}

/** A stored score that belongs to this exact script and this checklist. */
export function scoreIsCurrent(s: ScriptScore | null | undefined, key: string): boolean {
  return Boolean(s && s.v === SCORE_VERSION && s.key === key && s.subs.length > 0);
}

/** Scored before Kling: a video to recreate, in Nexli's own studio (client firms sell their own offer). */
export function scoreEligible(project: { studioId: string | null; media: { mode: string } | null }): boolean {
  return !project.studioId && project.media?.mode === "recreate";
}

/** What identifies a script's words: every clip's section and line, in order (FNV-1a, 32-bit). */
export function scriptKey(clips: { section: string; line: string }[]): string {
  let h = 0x811c9dc5;
  const text = `${clips.length}\n${clips.map((c) => `${c.section}|${c.line}`).join("\n")}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ── Measured checks ─────────────────────────────────────

const OLD_OFFER: { re: RegExp; label: string }[] = [
  { re: /\b9,?997\b|nine thousand nine hundred/i, label: "$9,997" },
  { re: /\b4,?997\b|four thousand nine hundred/i, label: "$4,997" },
  { re: /month[- ]to[- ]month/i, label: "month to month" },
  { re: /\bannual plan\b|\bpaid annually\b|\byearly plan\b/i, label: "annual plan" },
  { re: /\bad credits?\b|first[- ]month (?:ad )?bonus|match(?:es)? your (?:first month|ad budget)/i, label: "first-month ad bonus" },
  { re: /\bcancel any ?time\b|\bno contracts?\b/i, label: "no contract / cancel anytime" },
];

/** Old-offer wording in the lines. "No setup fee" is the new offer; any other setup fee is the old one. */
export function oldOfferIn(lines: string[]): string[] {
  const text = lines.join("\n");
  const found = new Set<string>();
  for (const o of OLD_OFFER) if (o.re.test(text)) found.add(o.label);
  const setup = /setup fee/gi;
  let m: RegExpExecArray | null;
  while ((m = setup.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 14), m.index).toLowerCase();
    if (!/\bno\s+$|\bwithout\s+(?:a\s+)?$|\bzero\s+$|\bnot? a\s+$/.test(before)) found.add("a setup fee");
  }
  return [...found];
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const NUMBER = /\$\s?\d|\d[\d,.]*\s?(?:k|%|percent)?\b|\b(?:hundred|thousand|million|billion|percent)\b/i;
const WARMUP = /^(?:hi|hey|hello|welcome|so|okay|ok|alright|today|in this video|let me|i want to|i'm going to|my name|have you ever|what's up)\b/i;
const STOCK = ["game-changer", "game changer", "next level", "unlock", "skyrocket", "secret sauce", "crush it", "in today's world", "cutting-edge", "cutting edge", "leverage", "synergy", "look no further", "revolutionary", "supercharge", "10x your", "dive in", "deep dive"];
const QUALIFIER_SIZE = /750\s?k|750,000|seven hundred(?: and)? fifty/i;
const QUALIFIER_TOP = /\bmillion\b|\b1\s?m\b|1,000,000/i;
const ASK_VSL = /\b(?:book|pick a (?:time|spot)|grab a (?:time|spot)|schedule|choose a time|calendar)\b/i;
const ASK_AD = /\b(?:watch|tap|click|link|video|below|book)\b/i;
const FEE = /\$\s?10,?000\b|\bten thousand\b|\b10k\b/i;
const RISKY = /\b(?:guarantee(?:d|s)?|promise you|you will make|you'll make|risk[- ]free)\b/i;
const NEGATED = /\b(?:no|not|never|don't|doesn't|won't|without)\b[^.]{0,20}$/i;

const norm = (s: string) => s.toLowerCase().replace(/[“”"’'`]/g, "").replace(/[^a-z0-9$%\s]/g, " ").replace(/\s+/g, " ").trim();

/** The first 6-word run of the script that also appears in the reference's words, or null. */
export function copiedRun(lines: string[], referenceText: string | null): string | null {
  if (!referenceText) return null;
  const ref = norm(referenceText).split(" ");
  if (ref.length < 6) return null;
  const grams = new Set<string>();
  for (let i = 0; i + 6 <= ref.length; i++) grams.add(ref.slice(i, i + 6).join(" "));
  for (const line of lines) {
    const w = norm(line).split(" ");
    for (let i = 0; i + 6 <= w.length; i++) {
      const g = w.slice(i, i + 6).join(" ");
      if (grams.has(g)) return g;
    }
  }
  return null;
}

type Measured = Omit<ScoreCheck, "point" | "label" | "points" | "source">;

/** Every measured check, from the words alone. Deterministic. */
export function measureScript(clips: { line: string }[], format: "vsl_16x9" | "ad_9x16", referenceText: string | null): Measured[] {
  const lines = clips.map((c) => c.line.trim());
  const vsl = format === "vsl_16x9";
  const first = lines[0] ?? "";
  const n1 = words(first).length;
  const out: Measured[] = [];
  const add = (id: CheckId, pass: boolean, evidence: string, clip: number | null, fix: string) => out.push({ id, pass, evidence, clip, fix: pass ? "" : fix });

  add("hook_short", n1 > 0 && n1 <= 14, `Clip 1 is ${n1} word${n1 === 1 ? "" : "s"}.`, 1, `Cut clip 1 to 14 words or fewer (it's ${n1}): lead with the claim, move the rest to clip 2.`);
  const warm = first.match(WARMUP);
  add("hook_no_warmup", !warm, warm ? `Clip 1 opens with “${warm[0]}”.` : "Clip 1 starts on the point.", 1, `Start clip 1 on the claim itself, not “${warm?.[0] ?? ""}”.`);
  const numIn = [0, 1].find((i) => NUMBER.test(lines[i] ?? ""));
  add("hook_number", numIn !== undefined, numIn !== undefined ? `Clip ${numIn + 1}: “${(lines[numIn].match(NUMBER)?.[0] ?? "").trim()}”.` : "No number in clips 1–2.", numIn !== undefined ? numIn + 1 : null, "Put a concrete number or dollar figure in clip 1 or 2 (the framework's math, e.g. 300 × $800 vs 50 × $15,000).");

  const old = oldOfferIn(lines);
  add("offer_clean", old.length === 0, old.length ? `Mentions ${old.join(", ")}.` : "No old-offer wording.", null, `Remove ${old.join(", ")}: use only the current offer.`);
  const feeAt = lines.findIndex((l) => FEE.test(l));
  add(
    "offer_stated",
    !vsl || feeAt >= 0,
    !vsl ? "Ads leave the price to the VSL." : feeAt >= 0 ? `Clip ${feeAt + 1} states the fee.` : "The $10,000 monthly fee isn't stated.",
    vsl && feeAt >= 0 ? feeAt + 1 : null,
    "State the fee plainly in the investment section: $10,000 a month, no setup fee."
  );

  const long = lines.map((l, i) => ({ i, n: words(l).length })).filter((x) => x.n > 30);
  add("lines_short", long.length === 0, long.length ? `${long.length} line${long.length === 1 ? "" : "s"} over 30 words (clip ${long.map((x) => x.i + 1).slice(0, 6).join(", ")}).` : "Every line is 30 words or fewer.", long[0] ? long[0].i + 1 : null, `Split the long lines into two clips each (clip ${long.map((x) => x.i + 1).slice(0, 6).join(", ")}).`);
  const [lo, hi] = vsl ? [30, 50] : [7, 11];
  add("clip_count", lines.length >= lo && lines.length <= hi, `${lines.length} clips (the framework: ${lo}–${hi}).`, null, `Bring it to ${lo}–${hi} clips (it has ${lines.length}).`);

  const withNumbers = lines.filter((l) => NUMBER.test(l)).length;
  add("proof_numbers", withNumbers >= 3, `${withNumbers} clip${withNumbers === 1 ? "" : "s"} with a number.`, null, `Add the math: at least 3 clips with a concrete number (it has ${withNumbers}).`);

  const tail = lines.slice(-3);
  const askAt = tail.findIndex((l) => (vsl ? ASK_VSL : ASK_AD).test(l));
  add(
    "cta_ask",
    askAt >= 0,
    askAt >= 0 ? `Clip ${lines.length - tail.length + askAt + 1} asks for it.` : "None of the last 3 clips asks for the action.",
    askAt >= 0 ? lines.length - tail.length + askAt + 1 : null,
    vsl ? "End by asking them to pick a time below and book the call." : "End by pointing them to the video: “Tap below and watch it.”"
  );

  const lower = lines.join("\n").toLowerCase();
  const stock = STOCK.filter((p) => lower.includes(p));
  add("no_stock", stock.length === 0, stock.length ? `Uses “${stock.join("”, “")}”.` : "No stock phrases.", null, `Replace “${stock.join("”, “")}” with what actually changes for the firm.`);
  const copied = copiedRun(lines, referenceText);
  add("not_copied", !copied, copied ? `Copies “${copied}” from the reference.` : referenceText ? "No 6-word run copied from the reference." : "No reference words to compare.", null, `Reword “${copied ?? ""}”: it's the reference's own words.`);

  const qAt = lines.findIndex((l) => QUALIFIER_SIZE.test(l) && QUALIFIER_TOP.test(l));
  add("qualifier", qAt >= 0, qAt >= 0 ? `Clip ${qAt + 1} has the qualifier.` : "No qualifier line.", qAt >= 0 ? qAt + 1 : null, "Add the qualifier before the close: “This is for C-P-A firms doing 750K to 1 million a year, who know they can 10x their business.”");
  return out;
}

/** Results, guarantees or tax outcomes promised (not negated): caps the score at 45. */
export function riskyClaim(lines: string[]): { clip: number; text: string } | null {
  for (let i = 0; i < lines.length; i++) {
    const m = RISKY.exec(lines[i]);
    if (m && !NEGATED.test(lines[i].slice(0, m.index))) return { clip: i + 1, text: m[0] };
  }
  return null;
}

// ── Claude's yes/no answers, verified ───────────────────

export interface RawCheckAnswer {
  id?: string;
  pass?: unknown;
  clip?: unknown;
  quote?: unknown;
  fix?: unknown;
}

export interface RawScriptScore {
  checks?: RawCheckAnswer[];
  verdict?: unknown;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** True when `quote` (3+ words) really is in clip `clip` (1-based), ignoring case and punctuation. */
export function quoteInClip(lines: string[], clip: unknown, quote: string): boolean {
  const i = Number(clip) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= lines.length) return false;
  const q = norm(quote);
  return q.split(" ").length >= 3 && norm(lines[i]).includes(q);
}

/** Claude's answers → checks. A "presence" yes counts only with a verified quote; an "absence" no only with one. */
export function verifyAnswers(answers: RawCheckAnswer[], lines: string[]): Measured[] {
  return CLAUDE_CHECKS.map((def) => {
    const a = answers.find((x) => x?.id === def.id);
    const quote = text(a?.quote, 300);
    const backed = quoteInClip(lines, a?.clip, quote);
    const said = a?.pass === true;
    const clip = backed ? Number(a?.clip) : null;
    const fix = text(a?.fix, 300);
    if (def.proof === "presence") {
      const pass = said && backed;
      return {
        id: def.id,
        pass,
        evidence: pass ? `Clip ${clip}: “${quote}”` : said ? "Claude said yes but quoted nothing from the script, so it doesn't count." : "Not found in the script.",
        clip,
        fix: pass ? "" : fix || `Add it: ${def.label.toLowerCase()}.`,
      };
    }
    // absence: it fails only when the problem is quoted from the script.
    const pass = said || !backed;
    return {
      id: def.id,
      pass,
      evidence: pass ? (said ? "No such stretch." : "No stretch quoted from the script.") : `Clip ${clip}: “${quote}”`,
      clip: pass ? null : clip,
      fix: pass ? "" : fix || `Fix the stretch around clip ${clip}.`,
    };
  });
}

// ── The score ───────────────────────────────────────────

/** Measured + verified checks → the stored score. Points and the total are computed here, never taken from Claude. */
export function buildScore(args: {
  key: string;
  clips: { line: string }[];
  format: "vsl_16x9" | "ad_9x16";
  referenceText: string | null;
  raw: RawScriptScore;
  prev: ScriptScore | null;
  now?: Date;
}): ScriptScore {
  const lines = args.clips.map((c) => c.line.trim());
  const results = [...measureScript(args.clips, args.format, args.referenceText), ...verifyAnswers(args.raw.checks ?? [], lines)];
  const checks: ScoreCheck[] = CHECKS.map((def) => {
    const r = results.find((x) => x.id === def.id) as Measured;
    return { ...r, point: def.point, label: def.label, points: def.points, source: def.source };
  });
  const subs: ScriptScoreSub[] = RUBRIC.map((r) => {
    const mine = checks.filter((c) => c.point === r.key);
    const points = mine.filter((c) => c.pass).reduce((t, c) => t + c.points, 0);
    const failed = mine.filter((c) => !c.pass);
    return {
      key: r.key,
      label: r.label,
      weight: r.weight,
      score: Math.round((points / r.weight) * 10),
      points,
      why: failed.length ? failed.map((c) => c.evidence).join(" ") : "Every check passes.",
      fix: failed[0]?.fix ?? "",
    };
  });
  const rawScore = subs.reduce((t, s) => t + s.points, 0);
  const risky = riskyClaim(lines);
  const caps = risky ? [{ key: "policy_risk" as const, label: CAPS.policy_risk.label, max: CAPS.policy_risk.max, why: `Clip ${risky.clip}: “${risky.text}”` }] : [];
  const score = caps.length ? Math.min(rawScore, CAPS.policy_risk.max) : rawScore;
  const prev = args.prev;
  return {
    v: SCORE_VERSION,
    key: args.key,
    score,
    raw: rawScore,
    band: bandOf(score),
    subs,
    checks,
    caps,
    oldOffer: oldOfferIn(lines),
    verdict: text(args.raw.verdict, 300),
    improved: Boolean(prev?.improved),
    before: prev?.justImproved ? prev.score : null,
    justImproved: false,
    pending: null,
    at: (args.now ?? new Date()).toISOString(),
  };
}

/** The points under 7 of 10, weakest first. */
export function weakPoints(s: ScriptScore): ScriptScoreSub[] {
  return s.subs.filter((x) => x.score < WEAK_BELOW).sort((a, b) => a.score - b.score);
}

// ── The path to 80 and 90 ────────────────────────────────

export interface PathStep {
  id: CheckId;
  point: RubricKey;
  label: string;
  fix: string;
  /** Exactly what passing this check adds. */
  gain: number;
  source: "measured" | "claude";
}

export interface ScorePath {
  target: number;
  /** The failed checks, biggest first, that get there (or all of them when they fall short). */
  steps: PathStep[];
  /** The score with those changes made: exact, since every check is worth fixed points. */
  reaches: number;
  enough: boolean;
}

/** The score with these checks passed (the risky-claim cap lifts only by removing the claim). */
export function projectedScore(s: ScriptScore, passed: Set<CheckId>): number {
  const raw = (s.checks ?? []).reduce((t, c) => t + (c.pass || passed.has(c.id) ? c.points : 0), 0);
  return s.caps.length ? Math.min(raw, CAPS.policy_risk.max) : raw;
}

/** The fewest failed checks, biggest first (measured before Claude's on a tie), that take the script to `target`. */
export function pathTo(s: ScriptScore, target: number): ScorePath {
  const failed = (s.checks ?? [])
    .filter((c) => !c.pass)
    .sort((a, b) => b.points - a.points || (a.source === "measured" ? -1 : 1) - (b.source === "measured" ? -1 : 1));
  const steps: PathStep[] = [];
  const passed = new Set<CheckId>();
  let reaches = s.score;
  for (const c of failed) {
    if (reaches >= target) break;
    steps.push({ id: c.id, point: c.point, label: c.label, fix: c.fix, gain: c.points, source: c.source });
    passed.add(c.id);
    reaches = projectedScore(s, passed);
  }
  return { target, steps, reaches, enough: reaches >= target };
}

/** The automatic rewrite's changes: the path to 90 (with a risky claim, removing it first). */
export function improvementPath(s: ScriptScore): ScorePath {
  return pathTo(s, 90);
}

/**
 * The rewrite's instruction (Marcel: "regenerate based off of the
 * recommendations and make sure it still aligns with my offer"): the chosen
 * changes, the risky claim if any, and the current offer spelled out.
 */
export function pathNote(s: ScriptScore, path: ScorePath): string {
  return [
    `This script scored ${s.score}/100 on a fixed checklist. Rewrite it to reach ${path.target} or more by making these changes:`,
    ...path.steps.map((st) => `- ${st.label} (+${st.gain}): ${st.fix}`),
    ...s.caps.map((c) => `- Remove the risky claim (${c.why}): no guarantees or promised results.`),
    ...(s.oldOffer.length ? [`- Remove the old offer (${s.oldOffer.join(", ")}): it must not appear anywhere.`] : []),
    "",
    "Every line must match Nexli's offer as it is today, and nothing else about the offer may appear:",
    OFFER_FACTS,
    "",
    "Keep everything that already passes and the shape copied from the reference. Return the whole script.",
  ].join("\n");
}

export function improvementNote(s: ScriptScore): string {
  return pathNote(s, improvementPath(s));
}

/** The offer check shown with the score. */
export function offerCheck(s: ScriptScore): { ok: boolean; text: string } {
  return s.oldOffer.length
    ? { ok: false, text: `Mentions the old offer: ${s.oldOffer.join(", ")}` }
    : { ok: true, text: "Matches the current offer: no setup fee, old price, annual plan or month to month" };
}

/** A score or rewrite claimed less than 320 s ago (its route's limit is 300 s). */
export function pendingLive(s: ScriptScore | null | undefined, now = Date.now()): boolean {
  return Boolean(s?.pending && now - new Date(s.pending.at).getTime() < 320_000);
}

/** What the page and the batch board do next with a video's score (null = nothing). `stale` = not this script's current score. */
export function nextScoreStep(args: { eligible: boolean; status: string; clips: number; score: (ScriptScore & { stale: boolean }) | null }): "score" | "improve" | null {
  const { eligible, status, clips, score } = args;
  if (!eligible || status !== "scripted" || clips === 0) return null;
  if (score && pendingLive(score)) return null;
  if (!score || score.stale || score.v !== SCORE_VERSION || !score.subs.length) return "score";
  const wants = score.score < AUTO_BELOW || weakPoints(score).length > 0 || score.oldOffer.length > 0 || score.caps.length > 0;
  if (!score.improved && wants && improvementPath(score).steps.length + score.caps.length + score.oldOffer.length > 0) return "improve";
  return null;
}

/** For the card: a check's definition. */
export const checkDef = (id: CheckId): CheckDef | undefined => DEF.get(id);
