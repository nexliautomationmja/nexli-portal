import {
  CREATIVE_VERDICTS,
  METRICS,
  OUTCOMES,
  PRIORITIES,
  REF_LEVELS,
  STEP_KINDS,
  VERDICTS,
  WINDOWS,
  type CreativeVerdictName,
  type MetricName,
  type OutcomeName,
  type Priority,
  type StepKind,
  type Verdict,
  type WindowName,
} from "@/lib/ads/schema";

/**
 * Turn whatever Manus returned into something the page can trust (pure,
 * client-safe): enums coerced to known values, strings and lists clipped,
 * numbers clamped, USD → cents, every target checked against the data Manus
 * was given (unknown ids flagged), and evidence numbers compared with the
 * pack (> 10% off → flagged). A zero-filled failure is rejected.
 */

export type RefLevel = (typeof REF_LEVELS)[number];
export type EntityLevel = "account" | "campaign" | "adset" | "ad";

export interface PackIndex {
  account: string;
  /** Known entity by id. */
  has: (level: EntityLevel, id: string) => boolean;
  /** Id for an exact (case-insensitive) name. */
  idByName: (level: EntityLevel, name: string) => string | null;
  /** The pack's value (USD for money, 0-1 for rates) — null when not in the pack. */
  metric: (level: RefLevel, id: string | null, metric: MetricName, window: WindowName) => number | null;
}

export interface ParsedTarget {
  level: EntityLevel;
  id: string | null;
  name: string;
  unverified: boolean;
}

export interface ParsedEvidence {
  label: string;
  metric: MetricName;
  window: WindowName;
  value: number | null;
  display: string;
  baselineDisplay: string | null;
  refLevel: RefLevel;
  refId: string | null;
  mismatch: boolean;
}

export interface ParsedFinding {
  title: string;
  detail: string;
  evidence: ParsedEvidence[];
}

export interface ParsedCreative {
  adId: string;
  adName: string;
  verdict: CreativeVerdictName;
  fatigue: string;
  why: string;
  hookNote: string | null;
  iterateIdea: string | null;
  evidence: ParsedEvidence[];
}

export interface ParsedRefresh {
  count: number;
  format: "photo" | "video" | "both";
  angles: string[];
  brief: string;
  keep: string | null;
  avoid: string | null;
}

export interface ParsedStep {
  key: string;
  continuesStepId: string | null;
  priority: Priority;
  kind: StepKind;
  title: string;
  why: string;
  how: string;
  targets: ParsedTarget[];
  evidence: ParsedEvidence[];
  waitDays: number | null;
  successCheck: { metric: MetricName; targetDisplay: string; checkAfterDays: number | null } | null;
  creativeRefresh: ParsedRefresh | null;
  budgetChange: { fromCents: number | null; toCents: number | null } | null;
  expectedImpact: string;
  confidence: "low" | "medium" | "high";
  effort: "5_min" | "30_min" | "1_hour_plus";
  risk: string | null;
}

export interface ParsedTest {
  key: string;
  priority: Priority;
  hypothesis: string;
  variable: string;
  control: string;
  variant: string;
  setup: string;
  dailyBudgetCents: number | null;
  durationDays: number;
  primaryMetric: MetricName;
  minSample: string;
  decisionRule: string;
  targets: ParsedTarget[];
}

export interface ParsedBudget {
  recommendation: "hold" | "increase" | "decrease" | "reallocate";
  currentDailyCents: number | null;
  suggestedDailyCents: number | null;
  rationale: string;
  moves: { from: ParsedTarget | null; to: ParsedTarget | null; dailyCents: number | null; why: string }[];
}

export interface ParsedAnalysis {
  verdict: Verdict;
  healthScore: number;
  headline: string;
  summary: string;
  dataConfidence: "low" | "medium" | "high";
  dataNotes: string[];
  whatsWorking: ParsedFinding[];
  whatsNot: ParsedFinding[];
  creatives: ParsedCreative[];
  steps: ParsedStep[];
  tests: ParsedTest[];
  budget: ParsedBudget;
  trackingIssues: { severity: "info" | "warning" | "critical"; issue: string; fix: string; evidence: ParsedEvidence[] }[];
  previousStepsReview: { stepId: string; outcome: OutcomeName; comment: string }[];
  watchlist: string[];
  nextCheckInDays: number;
  reportMarkdown: string;
}

export type Obj = Record<string, unknown>;
export const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
export const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
export const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const strOrNull = (v: unknown, max: number): string | null => {
  const s = str(v, max);
  return s ? s : null;
};
export function en<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const int = (v: unknown, min: number, max: number): number | null => {
  const n = num(v);
  return n === null ? null : Math.max(min, Math.min(max, Math.round(n)));
};
const cents = (usd: unknown): number | null => {
  const n = num(usd);
  return n === null || n < 0 || n > 10_000_000 ? null : Math.round(n * 100);
};

const MONEY: MetricName[] = ["spend", "cost_per_booked_call", "cost_per_lead", "cpm", "cpc", "cac"];

function evidenceOf(v: unknown, idx: PackIndex): ParsedEvidence {
  const e = obj(v);
  const metric = en(e.metric, METRICS, "other");
  const window = en(e.window, WINDOWS, "not_applicable");
  const refLevel = en(e.ref_level, REF_LEVELS, "account");
  const refId = strOrNull(e.ref_id, 40);
  const value = num(e.value);
  let mismatch = false;
  if (value !== null && metric !== "other" && window !== "not_applicable") {
    const actual = idx.metric(refLevel, refId, metric, window);
    if (actual !== null) {
      const diff = Math.abs(value - actual);
      const tolerance = Math.max(Math.abs(actual) * 0.1, MONEY.includes(metric) ? 1 : 0.0005);
      mismatch = diff > tolerance;
    }
  }
  return {
    label: str(e.label, 80) || metric.replace(/_/g, " "),
    metric,
    window,
    value,
    display: str(e.display, 40) || (value !== null ? String(value) : "—"),
    baselineDisplay: strOrNull(e.baseline_display, 40),
    refLevel,
    refId,
    mismatch,
  };
}

function targetOf(v: unknown, idx: PackIndex): ParsedTarget {
  const t = obj(v);
  const level = en(t.level, ["account", "campaign", "adset", "ad"] as const, "account");
  const name = str(t.name, 160) || "—";
  const id = strOrNull(t.id, 40);
  if (level === "account") return { level, id: id ?? idx.account, name, unverified: false };
  if (id && idx.has(level, id)) return { level, id, name, unverified: false };
  const byName = idx.idByName(level, name);
  if (byName) return { level, id: byName, name, unverified: false };
  return { level, id, name, unverified: true };
}

const evidenceList = (v: unknown, idx: PackIndex) => arr(v, 6).map((e) => evidenceOf(e, idx));
const targetList = (v: unknown, idx: PackIndex) => arr(v, 6).map((t) => targetOf(t, idx));

export function parseAnalysis(value: unknown, idx: PackIndex): ParsedAnalysis | null {
  const v = obj(value);
  const headline = str(v.headline, 200);
  const summary = str(v.summary, 1500);
  const rawSteps = arr(v.next_steps, 10);
  const rawCreatives = arr(v.creatives, 40);
  // A zero-filled fallback (Manus couldn't extract) has nothing to say.
  if (!headline && !summary && rawSteps.length === 0 && rawCreatives.length === 0) return null;

  const steps: ParsedStep[] = rawSteps
    .map((sv, i) => {
      const s = obj(sv);
      const sc = obj(s.success_check);
      const cr = obj(s.creative_refresh);
      const bc = obj(s.budget_change);
      const format = en(cr.format, ["photo", "video", "both"] as const, "photo");
      const kind = en(s.kind, STEP_KINDS, "other");
      const refresh: ParsedRefresh | null =
        s.creative_refresh && typeof s.creative_refresh === "object"
          ? {
              count: int(cr.count, 1, format === "video" ? 10 : 20) ?? 5,
              format,
              angles: arr(cr.angles, 8).map((a) => str(a, 160)).filter(Boolean),
              brief: str(cr.brief, 1500),
              keep: strOrNull(cr.keep, 300),
              avoid: strOrNull(cr.avoid, 300),
            }
          : null;
      return {
        key: (str(s.key, 60).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || `step-${i + 1}`).slice(0, 60),
        continuesStepId: strOrNull(s.continues_step_id, 40),
        priority: en(s.priority, PRIORITIES, "later"),
        kind,
        title: str(s.title, 120),
        why: str(s.why, 700),
        how: str(s.how, 2000),
        targets: targetList(s.targets, idx),
        evidence: evidenceList(s.evidence, idx),
        waitDays: int(s.wait_days, 0, 60),
        successCheck: s.success_check && typeof s.success_check === "object" ? { metric: en(sc.metric, METRICS, "other"), targetDisplay: str(sc.target_display, 60), checkAfterDays: int(sc.check_after_days, 0, 60) } : null,
        creativeRefresh: refresh && (refresh.brief || refresh.angles.length) ? refresh : null,
        budgetChange: s.budget_change && typeof s.budget_change === "object" ? { fromCents: cents(bc.from_daily_usd), toCents: cents(bc.to_daily_usd) } : null,
        expectedImpact: str(s.expected_impact, 300),
        confidence: en(s.confidence, ["low", "medium", "high"] as const, "medium"),
        effort: en(s.effort, ["5_min", "30_min", "1_hour_plus"] as const, "30_min"),
        risk: strOrNull(s.risk, 300),
      } satisfies ParsedStep;
    })
    .filter((s) => s.title);

  const budget = obj(v.budget);
  return {
    verdict: en(v.verdict, VERDICTS, "too_early"),
    healthScore: int(v.health_score, 0, 100) ?? 50,
    headline: headline || summary.slice(0, 140),
    summary,
    dataConfidence: en(v.data_confidence, ["low", "medium", "high"] as const, "medium"),
    dataNotes: arr(v.data_notes, 8).map((x) => str(x, 300)).filter(Boolean),
    whatsWorking: arr(v.whats_working, 6).map((f) => ({ title: str(obj(f).title, 120), detail: str(obj(f).detail, 500), evidence: evidenceList(obj(f).evidence, idx) })).filter((f) => f.title),
    whatsNot: arr(v.whats_not, 6).map((f) => ({ title: str(obj(f).title, 120), detail: str(obj(f).detail, 500), evidence: evidenceList(obj(f).evidence, idx) })).filter((f) => f.title),
    creatives: rawCreatives
      .map((cv) => {
        const c = obj(cv);
        return {
          adId: str(c.ad_id, 40),
          adName: str(c.ad_name, 160),
          verdict: en(c.verdict, CREATIVE_VERDICTS, "too_early"),
          fatigue: en(c.fatigue, ["too_early", "fresh", "healthy", "watch", "fatigued", "dead"] as const, "too_early"),
          why: str(c.why, 400),
          hookNote: strOrNull(c.hook_note, 300),
          iterateIdea: strOrNull(c.iterate_idea, 400),
          evidence: evidenceList(c.evidence, idx),
        };
      })
      .filter((c) => c.adId && (idx.has("ad", c.adId) || idx.idByName("ad", c.adName)))
      .map((c) => (idx.has("ad", c.adId) ? c : { ...c, adId: idx.idByName("ad", c.adName) as string })),
    steps,
    tests: arr(v.tests, 6)
      .map((tv) => {
        const t = obj(tv);
        return {
          key: str(t.key, 60),
          priority: en(t.priority, PRIORITIES, "later"),
          hypothesis: str(t.hypothesis, 400),
          variable: str(t.variable, 40) || "other",
          control: str(t.control, 300),
          variant: str(t.variant, 300),
          setup: str(t.setup, 800),
          dailyBudgetCents: cents(t.daily_budget_usd),
          durationDays: int(t.duration_days, 1, 60) ?? 7,
          primaryMetric: en(t.primary_metric, METRICS, "other"),
          minSample: str(t.min_sample, 200),
          decisionRule: str(t.decision_rule, 400),
          targets: targetList(t.targets, idx),
        };
      })
      .filter((t) => t.hypothesis),
    budget: {
      recommendation: en(budget.recommendation, ["hold", "increase", "decrease", "reallocate"] as const, "hold"),
      currentDailyCents: cents(budget.current_daily_usd),
      suggestedDailyCents: cents(budget.suggested_daily_usd),
      rationale: str(budget.rationale, 800),
      moves: arr(budget.moves, 6).map((mv) => {
        const m = obj(mv);
        return { from: m.from ? targetOf(m.from, idx) : null, to: m.to ? targetOf(m.to, idx) : null, dailyCents: cents(m.daily_usd), why: str(m.why, 300) };
      }),
    },
    trackingIssues: arr(v.tracking_issues, 8)
      .map((tv) => {
        const t = obj(tv);
        return { severity: en(t.severity, ["info", "warning", "critical"] as const, "info"), issue: str(t.issue, 300), fix: str(t.fix, 500), evidence: evidenceList(t.evidence, idx) };
      })
      .filter((t) => t.issue),
    previousStepsReview: arr(v.previous_steps_review, 20)
      .map((rv) => {
        const r = obj(rv);
        return { stepId: str(r.step_id, 40), outcome: en(r.outcome, OUTCOMES, "unknown"), comment: str(r.comment, 500) };
      })
      .filter((r) => r.stepId),
    watchlist: arr(v.watchlist, 8).map((x) => str(x, 240)).filter(Boolean),
    nextCheckInDays: int(v.next_check_in_days, 1, 30) ?? 7,
    reportMarkdown: str(v.report_markdown, 60_000),
  };
}

/** A JSON object from text: a ```json fence, or the first balanced {...}. */
export function jsonFromText(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fence?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf("{");
    if (start < 0) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          return JSON.parse(c.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}
