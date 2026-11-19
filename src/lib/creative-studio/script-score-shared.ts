import { CAPS, RUBRIC, bandOf, scoreOf, type Band, type CapKey, type RubricKey } from "@/lib/ads/grader-shared";

/**
 * A script's score out of 100 (Nov 19 2026, Marcel: "score it and fix weak
 * points" before any Kling credits are spent), on the Ad Grader's seven
 * points and weights. Pure and client-safe.
 *
 * Scripts recreated in Nexli's studio are scored after they're written. Any
 * point under 7 of 10 gets ONE automatic rewrite aimed at those points; the
 * new script is then scored again. A score belongs to the exact script it
 * read (`key`): any later change to the lines makes it stale, and it is
 * scored again.
 */

/** The caps a script can carry (the rest — aspect, length, captions — belong to a finished video). */
export const SCRIPT_CAPS = ["no_hook_in_3s", "wrong_audience", "policy_risk", "no_cta"] as const satisfies readonly CapKey[];
export type ScriptCapKey = (typeof SCRIPT_CAPS)[number];

/** A point below this is rewritten once, automatically. */
export const WEAK_BELOW = 7;

export interface ScriptScoreSub {
  key: RubricKey;
  label: string;
  weight: number;
  /** 0–10. */
  score: number;
  /** score × weight ÷ 10. */
  points: number;
  why: string;
  /** What would raise it, in one line. */
  fix: string;
}

export interface ScriptScore {
  v: 1;
  /** scriptKey() of the lines it scored. */
  key: string;
  score: number;
  raw: number;
  band: Band;
  subs: ScriptScoreSub[];
  caps: { key: ScriptCapKey; label: string; max: number; why: string }[];
  /** Old-offer wording found in the lines (setup fee, $9,997, month to month…): message is held to 4/10 while any is there. */
  oldOffer: string[];
  verdict: string;
  /** The one automatic improvement has been used on this video. */
  improved: boolean;
  /** Set right after the automatic improvement: the score it had before. */
  before: number | null;
  /** The automatic improvement just replaced the script (the next score shows "before"). */
  justImproved?: boolean;
  /** A score or improvement running now (claimed; stale after 320 s). */
  pending?: { kind: "score" | "improve"; at: string } | null;
  at: string;
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

export interface RawScriptScore {
  subs?: { key?: string; score?: unknown; why?: unknown; fix?: unknown }[];
  caps?: { key?: string; why?: unknown }[];
  verdict?: unknown;
}

const clamp10 = (n: unknown) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Claude's raw marks → the stored score. Points and the total are computed here, never taken from Claude. */
export function toScriptScore(raw: RawScriptScore, args: { key: string; lines: string[]; prev: ScriptScore | null; now?: Date }): ScriptScore {
  const oldOffer = oldOfferIn(args.lines);
  const subs: ScriptScoreSub[] = RUBRIC.map((r) => {
    const s = (raw.subs ?? []).find((x) => x?.key === r.key);
    let score = clamp10(s?.score);
    // An old price or term in the lines can't pass on the offer.
    if (r.key === "message" && oldOffer.length) score = Math.min(score, 4);
    return {
      key: r.key,
      label: r.label,
      weight: r.weight,
      score,
      points: Math.round(((score * r.weight) / 10) * 10) / 10,
      why: text(s?.why, 400) || (r.key === "message" && oldOffer.length ? "Mentions the old offer." : ""),
      fix: text(s?.fix, 300),
    };
  });
  const capKeys = [...new Set((raw.caps ?? []).map((c) => c?.key).filter((k): k is ScriptCapKey => (SCRIPT_CAPS as readonly string[]).includes(String(k))))];
  const caps = capKeys.map((k) => ({ key: k, label: CAPS[k].label, max: CAPS[k].max, why: text((raw.caps ?? []).find((c) => c?.key === k)?.why, 300) }));
  const { raw: rawScore, score } = scoreOf(subs, capKeys);
  const prev = args.prev;
  return {
    v: 1,
    key: args.key,
    score,
    raw: rawScore,
    band: bandOf(score),
    subs,
    caps,
    oldOffer,
    verdict: text(raw.verdict, 300),
    improved: Boolean(prev?.improved),
    before: prev?.justImproved ? prev.score : null,
    justImproved: false,
    pending: null,
    at: (args.now ?? new Date()).toISOString(),
  };
}

/** The points worth one automatic rewrite (under 7 of 10), weakest first. */
export function weakPoints(s: ScriptScore): ScriptScoreSub[] {
  return s.subs.filter((x) => x.score < WEAK_BELOW).sort((a, b) => a.score - b.score);
}

/** The rewrite's instruction: the weak points with why and how, keeping what already works. */
export function improvementNote(s: ScriptScore): string {
  const weak = weakPoints(s);
  const lines = weak.map((w) => `- ${w.label} (${w.score}/10): ${w.why}${w.fix ? ` Fix: ${w.fix}` : ""}`);
  const caps = s.caps.map((c) => `- ${c.label}: ${c.why}`);
  const offer = s.oldOffer.length ? [`- It mentions the old offer (${s.oldOffer.join(", ")}). Use only the current offer facts.`] : [];
  return [
    `This script scored ${s.score}/100. Raise these points to at least 8 out of 10:`,
    ...lines,
    ...caps,
    ...offer,
    "Keep everything that already scores well, the shape copied from the reference, and the current offer facts. Return the whole script.",
  ].join("\n");
}

/** A score or improvement claimed less than 320 s ago (its route's limit is 300 s). */
export function pendingLive(s: ScriptScore | null | undefined, now = Date.now()): boolean {
  return Boolean(s?.pending && now - new Date(s.pending.at).getTime() < 320_000);
}

/** What the page and the batch board do next with a video's score (null = nothing). */
export function nextScoreStep(args: { eligible: boolean; status: string; clips: number; score: (ScriptScore & { stale: boolean }) | null }): "score" | "improve" | null {
  const { eligible, status, clips, score } = args;
  if (!eligible || status !== "scripted" || clips === 0) return null;
  if (score && pendingLive(score)) return null;
  if (!score || score.stale) return "score";
  if (!score.improved && (weakPoints(score).length > 0 || score.oldOffer.length > 0)) return "improve";
  return null;
}
