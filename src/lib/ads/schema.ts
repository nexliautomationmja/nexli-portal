/**
 * What Manus must return for an ads analysis (Manus `structured_output_schema`).
 * Kept inside Manus's subset: root object; every object has
 * additionalProperties:false and lists ALL properties as required (optional
 * values are nullable types); only type/enum/description/anyOf/$ref/$defs;
 * nesting ≤ 5 levels. The first value of each enum is the harmless one, so a
 * zero-filled failure ({success:false}) can't masquerade as advice.
 * Pure, client-safe.
 */

export const SCHEMA_VERSION = "ads-analysis-v1";

const nullable = (type: string) => ({ type: [type, "null"] });

export const METRICS = [
  "other",
  "spend",
  "cost_per_booked_call",
  "booked_calls",
  "cost_per_lead",
  "leads",
  "won_clients",
  "link_ctr",
  "cpm",
  "cpc",
  "frequency",
  "hook_rate",
  "hold_rate",
  "landing_page_view_rate",
  "lead_to_booked_rate",
  "close_rate",
  "cac",
] as const;

export const WINDOWS = ["not_applicable", "last_7d", "prev_7d", "base_14d", "last_30d", "prev_30d", "last_90d", "prev_90d", "month_to_date"] as const;
export const REF_LEVELS = ["account", "campaign", "adset", "ad", "platform", "placement", "audience", "tracking", "business"] as const;
export const VERDICTS = ["too_early", "hold_steady", "optimize", "refresh_creatives", "fix_tracking", "scale", "rethink"] as const;
export const PRIORITIES = ["later", "next_week", "this_week", "now"] as const;
export const STEP_KINDS = [
  "other",
  "refresh_creatives",
  "pause",
  "scale_budget",
  "reduce_budget",
  "reallocate_budget",
  "wait_and_watch",
  "launch_test",
  "consolidate",
  "fix_tracking",
  "landing_page",
  "audience",
  "placements",
  "bid_strategy",
  "optimization_event",
  "copy_or_offer",
] as const;
export const CREATIVE_VERDICTS = ["too_early", "keep", "scale", "iterate", "watch", "refresh", "pause"] as const;
export const OUTCOMES = ["unknown", "worked", "partly_worked", "no_change", "worse", "too_early", "not_done"] as const;

export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "verdict",
    "health_score",
    "headline",
    "summary",
    "data_confidence",
    "data_notes",
    "whats_working",
    "whats_not",
    "creatives",
    "next_steps",
    "tests",
    "budget",
    "tracking_issues",
    "previous_steps_review",
    "watchlist",
    "next_check_in_days",
    "report_markdown",
  ],
  properties: {
    schema_version: { type: "string", enum: [SCHEMA_VERSION] },
    verdict: { type: "string", enum: [...VERDICTS], description: "The single overall call for the account right now." },
    health_score: { type: "integer", description: "0-100. 75+ healthy, 50-74 needs work, under 50 at risk." },
    headline: { type: "string", description: "One plain sentence, max 140 characters." },
    summary: { type: "string", description: "3-5 plain sentences: what's happening and the one thing that matters most." },
    data_confidence: { type: "string", enum: ["low", "medium", "high"] },
    data_notes: { type: "array", items: { type: "string" }, description: "Caveats about the data (low volume, tracking gaps)." },
    whats_working: { type: "array", items: { $ref: "#/$defs/finding" } },
    whats_not: { type: "array", items: { $ref: "#/$defs/finding" } },
    creatives: { type: "array", items: { $ref: "#/$defs/creative" }, description: "A verdict for every ad that spent in the last 30 days." },
    next_steps: { type: "array", items: { $ref: "#/$defs/step" }, description: "Max 7, most important first, max 3 with priority now." },
    tests: { type: "array", items: { $ref: "#/$defs/test" } },
    budget: { $ref: "#/$defs/budget" },
    tracking_issues: { type: "array", items: { $ref: "#/$defs/tracking_issue" } },
    previous_steps_review: { type: "array", items: { $ref: "#/$defs/step_review" }, description: "One entry per step in history.previous_steps." },
    watchlist: { type: "array", items: { type: "string" }, description: "Things to keep an eye on before the next analysis." },
    next_check_in_days: { type: "integer" },
    report_markdown: { type: "string", description: "The full written report in Markdown, sections in the playbook's order." },
  },
  $defs: {
    metric: { type: "string", enum: [...METRICS] },
    window: { type: "string", enum: [...WINDOWS] },
    evidence: {
      type: "object",
      additionalProperties: false,
      required: ["label", "metric", "window", "value", "display", "baseline_display", "ref_level", "ref_id"],
      properties: {
        label: { type: "string" },
        metric: { $ref: "#/$defs/metric" },
        window: { $ref: "#/$defs/window" },
        value: { ...nullable("number"), description: "Raw pack value: USD for money, 0-1 for rates." },
        display: { type: "string", description: "Copied exactly from the pack's display strings." },
        baseline_display: { ...nullable("string"), description: "What it's compared with, e.g. the previous window." },
        ref_level: { type: "string", enum: [...REF_LEVELS] },
        ref_id: nullable("string"),
      },
    },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["level", "id", "name"],
      properties: {
        level: { type: "string", enum: ["account", "campaign", "adset", "ad"] },
        id: { ...nullable("string"), description: "The id from the data pack." },
        name: { type: "string" },
      },
    },
    finding: {
      type: "object",
      additionalProperties: false,
      required: ["title", "detail", "evidence"],
      properties: { title: { type: "string" }, detail: { type: "string" }, evidence: { type: "array", items: { $ref: "#/$defs/evidence" } } },
    },
    creative: {
      type: "object",
      additionalProperties: false,
      required: ["ad_id", "ad_name", "verdict", "fatigue", "why", "hook_note", "iterate_idea", "evidence"],
      properties: {
        ad_id: { type: "string" },
        ad_name: { type: "string" },
        verdict: { type: "string", enum: [...CREATIVE_VERDICTS] },
        fatigue: { type: "string", enum: ["too_early", "fresh", "healthy", "watch", "fatigued", "dead"] },
        why: { type: "string" },
        hook_note: nullable("string"),
        iterate_idea: { ...nullable("string"), description: "A concrete variation to make from this ad, when it's worth iterating." },
        evidence: { type: "array", items: { $ref: "#/$defs/evidence" } },
      },
    },
    creative_refresh: {
      type: "object",
      additionalProperties: false,
      required: ["count", "format", "angles", "brief", "keep", "avoid"],
      properties: {
        count: { type: "integer", description: "1-20 photo ads or 1-10 videos." },
        format: { type: "string", enum: ["photo", "video", "both"] },
        angles: { type: "array", items: { type: "string" } },
        brief: { type: "string", description: "Paste-ready Creative Studio brief, max 1,200 characters." },
        keep: nullable("string"),
        avoid: nullable("string"),
      },
    },
    success_check: {
      type: "object",
      additionalProperties: false,
      required: ["metric", "target_display", "check_after_days"],
      properties: { metric: { $ref: "#/$defs/metric" }, target_display: { type: "string" }, check_after_days: nullable("integer") },
    },
    budget_change: {
      type: "object",
      additionalProperties: false,
      required: ["from_daily_usd", "to_daily_usd"],
      properties: { from_daily_usd: nullable("number"), to_daily_usd: nullable("number") },
    },
    step: {
      type: "object",
      additionalProperties: false,
      required: [
        "key",
        "continues_step_id",
        "priority",
        "kind",
        "title",
        "why",
        "how",
        "targets",
        "evidence",
        "wait_days",
        "success_check",
        "creative_refresh",
        "budget_change",
        "expected_impact",
        "confidence",
        "effort",
        "risk",
      ],
      properties: {
        key: { type: "string", description: "Stable kebab-case; reuse a previous step's key when it's the same advice." },
        continues_step_id: { ...nullable("string"), description: "The previous step's id when this continues it." },
        priority: { type: "string", enum: [...PRIORITIES] },
        kind: { type: "string", enum: [...STEP_KINDS] },
        title: { type: "string", description: "The action in plain words, max 90 characters." },
        why: { type: "string" },
        how: { type: "string", description: "Numbered exact clicks and values in Ads Manager, one per line." },
        targets: { type: "array", items: { $ref: "#/$defs/target" } },
        evidence: { type: "array", items: { $ref: "#/$defs/evidence" } },
        wait_days: { ...nullable("integer"), description: "Days to wait before acting or checking." },
        success_check: { anyOf: [{ $ref: "#/$defs/success_check" }, { type: "null" }] },
        creative_refresh: { anyOf: [{ $ref: "#/$defs/creative_refresh" }, { type: "null" }] },
        budget_change: { anyOf: [{ $ref: "#/$defs/budget_change" }, { type: "null" }] },
        expected_impact: { type: "string" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        effort: { type: "string", enum: ["5_min", "30_min", "1_hour_plus"] },
        risk: nullable("string"),
      },
    },
    test: {
      type: "object",
      additionalProperties: false,
      required: ["key", "priority", "hypothesis", "variable", "control", "variant", "setup", "daily_budget_usd", "duration_days", "primary_metric", "min_sample", "decision_rule", "targets"],
      properties: {
        key: { type: "string" },
        priority: { type: "string", enum: [...PRIORITIES] },
        hypothesis: { type: "string" },
        variable: { type: "string", enum: ["other", "hook", "angle", "format", "headline", "primary_text", "cta", "landing_page", "audience", "placement", "offer", "optimization_event"] },
        control: { type: "string" },
        variant: { type: "string" },
        setup: { type: "string" },
        daily_budget_usd: nullable("number"),
        duration_days: { type: "integer" },
        primary_metric: { $ref: "#/$defs/metric" },
        min_sample: { type: "string" },
        decision_rule: { type: "string" },
        targets: { type: "array", items: { $ref: "#/$defs/target" } },
      },
    },
    budget_move: {
      type: "object",
      additionalProperties: false,
      required: ["from", "to", "daily_usd", "why"],
      properties: {
        from: { anyOf: [{ $ref: "#/$defs/target" }, { type: "null" }] },
        to: { anyOf: [{ $ref: "#/$defs/target" }, { type: "null" }] },
        daily_usd: nullable("number"),
        why: { type: "string" },
      },
    },
    budget: {
      type: "object",
      additionalProperties: false,
      required: ["recommendation", "current_daily_usd", "suggested_daily_usd", "rationale", "moves"],
      properties: {
        recommendation: { type: "string", enum: ["hold", "increase", "decrease", "reallocate"] },
        current_daily_usd: nullable("number"),
        suggested_daily_usd: nullable("number"),
        rationale: { type: "string" },
        moves: { type: "array", items: { $ref: "#/$defs/budget_move" } },
      },
    },
    tracking_issue: {
      type: "object",
      additionalProperties: false,
      required: ["severity", "issue", "fix", "evidence"],
      properties: {
        severity: { type: "string", enum: ["info", "warning", "critical"] },
        issue: { type: "string" },
        fix: { type: "string" },
        evidence: { type: "array", items: { $ref: "#/$defs/evidence" } },
      },
    },
    step_review: {
      type: "object",
      additionalProperties: false,
      required: ["step_id", "outcome", "comment"],
      properties: { step_id: { type: "string" }, outcome: { type: "string", enum: [...OUTCOMES] }, comment: { type: "string" } },
    },
  },
} as const;

export type Verdict = (typeof VERDICTS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type StepKind = (typeof STEP_KINDS)[number];
export type MetricName = (typeof METRICS)[number];
export type WindowName = (typeof WINDOWS)[number];
export type CreativeVerdictName = (typeof CREATIVE_VERDICTS)[number];
export type OutcomeName = (typeof OUTCOMES)[number];
