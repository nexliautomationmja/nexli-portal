import { ANGLES, FORMATS, type CreativeAngle, type CreativeFormat } from "@/lib/ads/creative-types";

/**
 * The Ad Grader (pure, client-safe): a creative scored out of 100 before it
 * gets spend, against Marcel's own ads' results and the long-running ads in
 * his niche. Meta publishes no pre-launch score, so every point has to cite
 * real evidence (his videos' numbers, niche ads, facts about the file) — a
 * line with none is capped — and the grader is checked by grading his past
 * videos blind and comparing with what really happened.
 */

export const RUBRIC_VERSION = "g1";

export const RUBRIC = [
  { key: "hook", label: "Hook — first 3 seconds", weight: 25 },
  { key: "message", label: "Message & offer", weight: 20 },
  { key: "meta_fit", label: "Built for Meta", weight: 15 },
  { key: "proof", label: "Proof", weight: 10 },
  { key: "cta", label: "Call to action", weight: 10 },
  { key: "fresh", label: "Fresh", weight: 10 },
  { key: "audience", label: "Right audience", weight: 10 },
] as const;
export type RubricKey = (typeof RUBRIC)[number]["key"];
export const RUBRIC_KEYS = RUBRIC.map((r) => r.key) as RubricKey[];
const WEIGHT = Object.fromEntries(RUBRIC.map((r) => [r.key, r.weight])) as Record<RubricKey, number>;
export const RUBRIC_LABEL = Object.fromEntries(RUBRIC.map((r) => [r.key, r.label])) as Record<RubricKey, string>;

/** Hard ceilings: whatever else it does well, a creative with one of these can't score above `max`. */
export const CAPS = {
  wrong_aspect: { max: 60, label: "Not vertical", source: "code" },
  too_long: { max: 65, label: "Longer than 90 seconds", source: "code" },
  silent_no_captions: { max: 50, label: "No sound and no captions", source: "code" },
  near_copy_of_dud: { max: 40, label: "Near-copy of a video that flopped", source: "code" },
  no_captions_talking_head: { max: 55, label: "Talking with no captions", source: "claude" },
  no_hook_in_3s: { max: 50, label: "Nothing stops the scroll in 3 seconds", source: "claude" },
  wrong_audience: { max: 35, label: "Not aimed at firm owners", source: "claude" },
  policy_risk: { max: 45, label: "Promises results / risky claims", source: "claude" },
  no_cta: { max: 60, label: "Never asks for the call", source: "claude" },
} as const;
export type CapKey = keyof typeof CAPS;
export const CLAUDE_CAPS = (Object.keys(CAPS) as CapKey[]).filter((k) => CAPS[k].source === "claude");

export type Band = "run" | "fix" | "skip";
export const BAND: Record<Band, { label: string; blurb: string }> = {
  run: { label: "Run it", blurb: "Worth testing with real budget." },
  fix: { label: "Fix first", blurb: "Fix what's listed before it gets spend." },
  skip: { label: "Don't spend", blurb: "Not worth publishing as it is." },
};
export const bandOf = (score: number): Band => (score >= 70 ? "run" : score >= 50 ? "fix" : "skip");

// ── What a video is (the READ) ─────────────────────────────

export const HOOK_TYPES = ["question", "pain", "stat", "bold_claim", "story", "curiosity", "pattern_interrupt", "demo", "none"] as const;
export const PROOF_KINDS = ["none", "numbers", "client_result", "authority", "demo", "testimonial"] as const;

export interface CreativeRead {
  v: 1;
  format: CreativeFormat;
  angle: CreativeAngle;
  /** Who's on screen, in a few words ("Daniela, AI presenter", "no one — text and b-roll"). */
  presenter: string;
  hook: { visual: string; spoken: string; onScreenText: string; type: (typeof HOOK_TYPES)[number]; namesAudience: boolean };
  offer: string;
  proof: { kind: (typeof PROOF_KINDS)[number]; detail: string };
  cta: { text: string; when: "none" | "early" | "end" | "throughout"; bookCall: boolean };
  captions: { burnedIn: boolean; readable: boolean };
  soundOffReadable: boolean;
  safeZoneIssues: string[];
  pacing: "slow" | "steady" | "fast";
  beats: string[];
  summary: string;
  claimsRisk: string[];
}

export interface ReadFrame {
  t: number;
  /** Storage path (creative-studio bucket). */
  path: string;
  role: "hook" | "spread" | "end";
}

export interface ReadMedia {
  kind: "video" | "image";
  durationS: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  frames: ReadFrame[];
  words: { text: string; start: number; end: number }[];
  text: string;
  transcriptError: string | null;
  /** Words that start in the first 3 seconds. */
  hookWords: string;
  firstWordAt: number | null;
  wordsPerSec: number | null;
  sizeBytes: number | null;
  fileHash: string | null;
  quality: "full" | "no_transcript" | "still_only";
}

/** The first 3 seconds and the pace, from the timed words. */
export function hookFacts(words: { text: string; start: number; end: number }[], durationS: number | null) {
  const first = words[0];
  const hook = words.filter((w) => w.start < 3).map((w) => w.text).join(" ").replace(/\s+([,.!?])/g, "$1");
  const span = durationS && durationS > 0 ? durationS : first ? words[words.length - 1].end : 0;
  return { hookWords: hook, firstWordAt: first ? Math.round(first.start * 10) / 10 : null, wordsPerSec: span > 0 && words.length ? Math.round((words.length / span) * 10) / 10 : null };
}

/** Video facts the code can check without any judgment. */
export function codeCaps(m: Pick<ReadMedia, "kind" | "durationS" | "width" | "height" | "hasAudio">, read: Pick<CreativeRead, "captions"> | null): CapKey[] {
  const out: CapKey[] = [];
  if (m.width && m.height && m.width > m.height * 1.05) out.push("wrong_aspect");
  if (m.kind === "video" && (m.durationS ?? 0) > 90) out.push("too_long");
  if (m.kind === "video" && !m.hasAudio && read && !read.captions.burnedIn) out.push("silent_no_captions");
  return out;
}

// ── How each past video did ─────────────────────────────────

export type OutcomeLabel = "winner" | "booked_expensive" | "leads_cheap" | "leads_expensive" | "dud" | "too_little";
export const OUTCOME: Record<OutcomeLabel, { label: string; ordinal: number | null }> = {
  winner: { label: "Winner", ordinal: 4 },
  booked_expensive: { label: "Booked, pricey", ordinal: 3 },
  leads_cheap: { label: "Cheap leads", ordinal: 2 },
  leads_expensive: { label: "Pricey leads", ordinal: 1 },
  dud: { label: "Flopped", ordinal: 0 },
  too_little: { label: "Too little spend", ordinal: null },
};
/** Produced = booked a call, or brought leads at or under the target. */
export const produced = (l: OutcomeLabel) => (OUTCOME[l].ordinal ?? -1) >= 2;

export interface Outcome {
  spendCents: number;
  impressions: number;
  linkClicks: number;
  views3s: number;
  thruplays: number;
  leads: number;
  /** null = can't be credited in the CRM (no utm_content) — leads are Meta's then. */
  booked: number | null;
}

/** T = target per booked call, L = target per lead (cents). */
export function outcomeLabel(o: Outcome, t: { cpbCents: number; cplCents: number }): OutcomeLabel {
  const booked = o.booked ?? 0;
  if (booked >= 1) return o.spendCents / booked <= t.cpbCents ? "winner" : "booked_expensive";
  if (o.leads >= 1) return o.spendCents / o.leads <= t.cplCents ? "leads_cheap" : "leads_expensive";
  const ctr = o.impressions > 0 ? o.linkClicks / o.impressions : null;
  if (o.spendCents >= 3 * t.cplCents || (o.impressions >= 3000 && ctr !== null && ctr < 0.004)) return "dud";
  return "too_little";
}

// ── Look-alikes ────────────────────────────────────────────

export interface SimInput {
  text: string;
  format: string | null;
  angle: string | null;
  hookType: string | null;
  presenter: string | null;
}

const wordsOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9$%' ]+/g, " ").split(/\s+/).filter(Boolean);
export function shingles(t: string, n = 3): Set<string> {
  const w = wordsOf(t);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
const sameText = (a: string | null, b: string | null) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
const presenterKey = (p: string | null) => (p ?? "").toLowerCase().split(/[,—–-]/)[0].trim();

/** 0–1: how alike two videos are (script overlap, then format, angle, hook type, presenter). */
export function similarity(a: SimInput, b: SimInput): number {
  const s = 0.45 * jaccard(shingles(a.text), shingles(b.text)) + 0.2 * (sameText(a.format, b.format) ? 1 : 0) + 0.15 * (sameText(a.angle, b.angle) ? 1 : 0) + 0.1 * (sameText(a.hookType, b.hookType) ? 1 : 0) + 0.1 * (presenterKey(a.presenter) && presenterKey(a.presenter) === presenterKey(b.presenter) ? 1 : 0);
  return Math.round(s * 100) / 100;
}

/** The same video in all but name: half its script matches, or it matches on everything else and some script. */
export function isNearCopy(a: SimInput, b: SimInput): boolean {
  return jaccard(shingles(a.text), shingles(b.text)) >= 0.5 || similarity(a, b) >= 0.8;
}

export function nearest<T extends { key: string; sim: SimInput }>(cand: SimInput, pool: T[], k = 3): (T & { similarity: number })[] {
  return pool
    .map((p) => ({ ...p, similarity: similarity(cand, p.sim) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/**
 * Groups of past videos that are really the same concept (same Meta video,
 * the same script ≥ 60%, or the same first 3 seconds of words) — the blind
 * backtest leaves a video's whole group out so it can't grade a copy of itself.
 */
export function conceptClusters(items: { key: string; videoId: string | null; text: string; hookWords: string }[]): Map<string, string> {
  const parent = new Map(items.map((i) => [i.key, i.key]));
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    parent.set(k, r);
    return r;
  };
  const join = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const sh = new Map(items.map((i) => [i.key, shingles(i.text)]));
  const hook = (h: string) => wordsOf(h).join(" ");
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if ((a.videoId && a.videoId === b.videoId) || jaccard(sh.get(a.key) as Set<string>, sh.get(b.key) as Set<string>) >= 0.6 || (hook(a.hookWords).length >= 8 && hook(a.hookWords) === hook(b.hookWords))) join(a.key, b.key);
    }
  }
  return new Map(items.map((i) => [i.key, find(i.key)]));
}

// ── The grade ──────────────────────────────────────────────

/** What a ref in the evidence pack points at (frozen when the grade is made). */
export type EvidenceRef =
  | {
      kind: "ad";
      readKey: string;
      name: string;
      adIds: string[];
      label: OutcomeLabel;
      spendCents: number;
      leads: number;
      booked: number | null;
      cplCents: number | null;
      cpbCents: number | null;
      hookRate: number | null;
      ctr: number | null;
      frame: string | null;
    }
  | { kind: "niche"; advertiser: string; hook: string; daysActive: number | null; url: string | null }
  | { kind: "stat"; text: string }
  | { kind: "fact"; text: string }
  | { kind: "frame"; t: number };

export interface RawSub {
  key: RubricKey;
  score: number;
  why: string;
  evidence: { ref: string; point: string }[];
}
export interface RawFix {
  title: string;
  what: string;
  subscore: RubricKey;
  to: number;
  removes_cap: CapKey | "none";
}

export interface GradeSub {
  key: RubricKey;
  label: string;
  weight: number;
  /** 0–10. */
  score: number;
  /** score × weight ÷ 10. */
  points: number;
  why: string;
  evidence: { ref: string; point: string }[];
  /** No valid evidence → capped at 5/10 and judged on craft alone. */
  noEvidence: boolean;
}

export interface GradeCap {
  key: CapKey;
  label: string;
  max: number;
  why: string;
}

export interface GradeFix {
  title: string;
  what: string;
  subscore: RubricKey;
  to: number;
  removesCap: CapKey | null;
  /** Points this fix alone adds. */
  points: number;
}

export interface NearestAd {
  ref: string;
  readKey: string;
  name: string;
  label: OutcomeLabel;
  similarity: number;
  frame: string | null;
}

export interface GradeResult {
  rubricVersion: string;
  score: number;
  rawScore: number;
  band: Band;
  subs: GradeSub[];
  caps: GradeCap[];
  fixes: GradeFix[];
  fixedScore: number;
  fixedBand: Band;
  fixedBrief: string;
  verdictLine: string;
  upside: "low" | "medium" | "high";
  upsideWhy: string;
  nearest: NearestAd[];
  confidence: "high" | "medium" | "low";
  caveat: string;
  basis: { judged: number; booked: number; withLeads: number; marketAds: number; researchAgeDays: number | null };
}

const clamp10 = (n: unknown) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));

/** Drop refs that aren't in the pack; a line left with none is capped at 5/10. */
export function validateEvidence(subs: RawSub[], valid: Set<string>): GradeSub[] {
  return RUBRIC.map((r) => {
    const s = subs.find((x) => x.key === r.key);
    const evidence = (s?.evidence ?? []).filter((e) => valid.has(String(e.ref).trim())).map((e) => ({ ref: String(e.ref).trim(), point: String(e.point ?? "").slice(0, 200) }));
    const raw = clamp10(s?.score);
    const noEvidence = evidence.length === 0;
    const score = noEvidence ? Math.min(5, raw) : raw;
    return { key: r.key, label: r.label, weight: r.weight, score, points: Math.round((score * r.weight) / 10 * 10) / 10, why: String(s?.why ?? "").slice(0, 400), evidence, noEvidence };
  });
}

/** Total out of 100, then the lowest cap. */
export function scoreOf(subs: Pick<GradeSub, "key" | "score">[], caps: CapKey[]): { raw: number; score: number } {
  const raw = Math.round(subs.reduce((t, s) => t + (s.score * WEIGHT[s.key]) / 10, 0));
  const cap = caps.length ? Math.min(...caps.map((c) => CAPS[c].max)) : 100;
  return { raw, score: Math.min(raw, cap) };
}

/** What each fix adds on its own, and the score with all of them. */
export function scoreFixes(subs: GradeSub[], caps: CapKey[], fixes: RawFix[]): { fixes: GradeFix[]; fixedScore: number } {
  const now = scoreOf(subs, caps).score;
  const apply = (list: RawFix[]) => {
    const s = subs.map((x) => ({ key: x.key, score: x.score }));
    let c = [...caps];
    for (const f of list) {
      const t = s.find((x) => x.key === f.subscore);
      if (t) t.score = Math.max(t.score, clamp10(f.to));
      if (f.removes_cap !== "none") c = c.filter((k) => k !== f.removes_cap);
    }
    return scoreOf(s, c).score;
  };
  const valid = fixes.filter((f) => RUBRIC_KEYS.includes(f.subscore)).slice(0, 5);
  return {
    fixes: valid.map((f) => ({
      title: String(f.title).slice(0, 80),
      what: String(f.what).slice(0, 500),
      subscore: f.subscore,
      to: clamp10(f.to),
      removesCap: f.removes_cap !== "none" && f.removes_cap in CAPS ? f.removes_cap : null,
      points: Math.max(0, apply([f]) - now),
    })),
    fixedScore: Math.max(now, apply(valid)),
  };
}

/** How much to trust a grade, from how much the account has to compare against. */
export function confidenceOf(b: GradeResult["basis"]): { confidence: GradeResult["confidence"]; caveat: string } {
  const research = b.researchAgeDays !== null && b.researchAgeDays <= 60;
  const confidence: GradeResult["confidence"] = b.judged >= 12 && b.booked >= 3 && research ? "high" : b.judged >= 6 ? "medium" : "low";
  const bits = [`Compared with ${b.judged} of your videos that ran long enough to judge (${b.booked} booked a call, ${b.withLeads} brought leads)`];
  bits.push(research ? `and ${b.marketAds} long-running ads in your niche` : "— no recent Ad Library research, so nothing from your niche");
  const thin = b.booked < 3 ? " Few booked calls so far, so “message” leans on leads, not bookings." : "";
  return { confidence, caveat: `${bits.join(" ")}.${thin}` };
}

// ── How often it's right (blind backtest) ──────────────────

/** Spearman's rank correlation (ties get their average rank). */
export function spearman(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3 || y.length !== n) return null;
  const rank = (v: number[]) => {
    const idx = v.map((val, i) => ({ val, i })).sort((a, b) => a.val - b.val);
    const r = new Array<number>(n);
    for (let i = 0; i < n; ) {
      let j = i;
      while (j + 1 < n && idx[j + 1].val === idx[i].val) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k].i] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(x);
  const ry = rank(y);
  const mean = (n + 1) / 2;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mean) * (ry[i] - mean);
    dx += (rx[i] - mean) ** 2;
    dy += (ry[i] - mean) ** 2;
  }
  return dx > 0 && dy > 0 ? Math.round((num / Math.sqrt(dx * dy)) * 100) / 100 : null;
}

export interface TrackItem {
  name: string;
  score: number;
  label: OutcomeLabel;
  spendCents: number;
}

export interface TrackRecord {
  n: number;
  base: { produced: number; dud: number };
  rows: { band: Band; n: number; produced: number; dud: number; spendCents: number }[];
  rho: number | null;
  /** Spend on videos it said not to run that never produced. */
  savedCents: number;
  /** Videos it said not to run that did produce. */
  missed: { name: string; label: OutcomeLabel; score: number }[];
  verdict: "useful" | "mixed" | "not_proven" | "too_few";
  verdictText: string;
  items: (TrackItem & { band: Band })[];
}

export function trackRecord(list: TrackItem[]): TrackRecord {
  const items = list.filter((i) => i.label !== "too_little").map((i) => ({ ...i, band: bandOf(i.score) }));
  const n = items.length;
  const pr = (xs: typeof items) => xs.filter((i) => produced(i.label)).length;
  const du = (xs: typeof items) => xs.filter((i) => i.label === "dud").length;
  const rows = (["run", "fix", "skip"] as Band[]).map((band) => {
    const xs = items.filter((i) => i.band === band);
    return { band, n: xs.length, produced: pr(xs), dud: du(xs), spendCents: xs.reduce((t, i) => t + i.spendCents, 0) };
  });
  const rho = spearman(
    items.map((i) => i.score),
    items.map((i) => OUTCOME[i.label].ordinal ?? 0)
  );
  const skip = items.filter((i) => i.band === "skip");
  const savedCents = skip.filter((i) => !produced(i.label)).reduce((t, i) => t + i.spendCents, 0);
  const missed = skip.filter((i) => produced(i.label)).map((i) => ({ name: i.name, label: i.label, score: i.score }));
  const baseP = n ? pr(items) / n : 0;
  const baseD = n ? du(items) / n : 0;
  const run = rows[0];
  const sk = rows[2];
  const runGood = run.n >= 3 && run.produced / run.n >= baseP + 0.15;
  const skipGood = sk.n >= 3 && sk.dud / sk.n >= baseD + 0.15;
  let verdict: TrackRecord["verdict"];
  let verdictText: string;
  if (n < 8) {
    verdict = "too_few";
    verdictText = `Only ${n} of your past videos ran long enough to judge — too few to prove the grader either way. Treat grades as a careful second opinion.`;
  } else if (runGood && skipGood) {
    verdict = "useful";
    verdictText = `Graded blind, it told your producers from your flops: “Run it” videos produced ${Math.round((run.produced / run.n) * 100)}% of the time vs ${Math.round(baseP * 100)}% overall.`;
  } else if (runGood || skipGood || (rho !== null && rho >= 0.3)) {
    verdict = "mixed";
    verdictText = `Graded blind, it leaned the right way but not cleanly${rho !== null ? ` (rank match ${rho})` : ""}. Use it to catch obvious misses, not to pick winners.`;
  } else {
    verdict = "not_proven";
    verdictText = "Graded blind, its scores didn't line up with what actually worked in your account. Don't lean on it yet — it re-checks as more videos run.";
  }
  return { n, base: { produced: Math.round(baseP * 100) / 100, dud: Math.round(baseD * 100) / 100 }, rows, rho, savedCents, missed, verdict, verdictText, items };
}

// ── Linking a grade to the live ad ─────────────────────────

const nameTokens = (s: string) => new Set(wordsOf(s).filter((w) => w.length > 2));

/** Live video ads that look like this graded creative (made since the grade, name overlap). */
export function suggestLinks(g: { title: string; createdAt: string }, ads: { id: string; name: string; createdTime: string | null; mediaType: string }[]): { id: string; name: string; score: number }[] {
  const since = new Date(g.createdAt).getTime() - 86_400_000;
  const mine = nameTokens(g.title);
  return ads
    .filter((a) => a.mediaType === "video" && (!a.createdTime || new Date(a.createdTime).getTime() >= since))
    .map((a) => ({ id: a.id, name: a.name, score: jaccard(mine, nameTokens(a.name)) }))
    .filter((a) => a.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ── Views for the page ─────────────────────────────────────

export type GradeStatus = "queued" | "watching" | "reading" | "grading" | "done" | "failed";

export interface LiveResult {
  adIds: string[];
  names: string[];
  spendCents: number;
  impressions: number;
  hookRate: number | null;
  ctr: number | null;
  leads: number;
  booked: number | null;
  label: OutcomeLabel;
  call: string | null;
  rankings: { quality: string | null; engagement: string | null; conversion: string | null } | null;
}

export interface GradeView {
  id: string;
  kind: "upload" | "render" | "backtest";
  title: string;
  status: GradeStatus;
  error: string | null;
  createdAt: string;
  durationS: number | null;
  thumb: string | null;
  grade: GradeResult | null;
  /** ref → what it points at, with signed frame URLs for ads. */
  refs: Record<string, EvidenceRef & { frameUrl?: string | null }>;
  nearest: (NearestAd & { frameUrl: string | null })[];
  linked: LiveResult | null;
  suggestions: { id: string; name: string }[];
}

export interface LearnView {
  status: "never" | "running" | "done";
  total: number;
  done: number;
  failed: number;
  partial: number;
  /** Videos read and ready to compare against. */
  judged: number;
  updatedAt: string | null;
}

export interface GraderState {
  learn: LearnView;
  backtest: { status: "never" | "running" | "done" | "failed"; total: number; done: number; record: TrackRecord | null; finishedAt: string | null; newSince: number } | null;
  live: TrackRecord | null;
  grades: GradeView[];
  /** Grades made today (a daily cap keeps the cost down). */
  today: number;
  dailyCap: number;
}

export const FORMAT_LABEL = FORMATS;
export const ANGLE_LABEL = ANGLES;
