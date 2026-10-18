/**
 * The biweekly client pulse-check survey — single source of truth for the
 * questions, their order, the answer shapes, and the "this needs Marcel's
 * attention" rules.
 *
 * Client-safe (no server imports): used by the public survey page, the
 * survey API, the Monday email, the Overview prompt, and the Client Tracker.
 *
 * Marcel, Oct 18 2026: seven questions so he gets a real read on the
 * relationship, with the NPS question placed sixth — asking it first is
 * "way too early". Old surveys (before this revision) stored a single 1–5
 * "confidence" score in results_score; that is kept as legacy history.
 */

export type SurveyQuestionKind = "scale5" | "value" | "nps" | "comment";

/** The four 1–5 rated questions, stored in client_surveys.answers jsonb. */
export type ScaleQuestionId = "overall" | "lead_quality" | "communication" | "responsiveness";
export const SCALE_QUESTION_IDS: readonly ScaleQuestionId[] = [
  "overall",
  "lead_quality",
  "communication",
  "responsiveness",
];

export type SurveyAccent = "blue" | "violet" | "cyan" | "emerald" | "amber";

export interface SurveyQuestion {
  id: ScaleQuestionId | "value" | "nps" | "comment";
  number: number;
  kind: SurveyQuestionKind;
  prompt: string;
  help?: string;
  /** End labels for scale5 / nps. */
  lowLabel?: string;
  highLabel?: string;
  accent: SurveyAccent;
  required: boolean;
}

export const SURVEY_QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: "overall",
    number: 1,
    kind: "scale5",
    prompt: "Overall, how are things going with Nexli right now?",
    lowLabel: "Rough",
    highLabel: "Great",
    accent: "blue",
    required: true,
  },
  {
    id: "lead_quality",
    number: 2,
    kind: "scale5",
    prompt: "How would you rate the quality of the leads coming in?",
    lowLabel: "Poor",
    highLabel: "Excellent",
    accent: "emerald",
    required: true,
  },
  {
    id: "communication",
    number: 3,
    kind: "scale5",
    prompt: "How clear are you on what our team worked on for you these past two weeks?",
    lowLabel: "In the dark",
    highLabel: "Crystal clear",
    accent: "violet",
    required: true,
  },
  {
    id: "responsiveness",
    number: 4,
    kind: "scale5",
    prompt: "When you've needed something from us, how responsive have we been?",
    lowLabel: "Slow",
    highLabel: "Fast",
    accent: "cyan",
    required: true,
  },
  {
    id: "value",
    number: 5,
    kind: "value",
    prompt: "Are you getting what you're paying for?",
    accent: "amber",
    required: true,
  },
  {
    id: "nps",
    number: 6,
    kind: "nps",
    prompt: "How likely are you to recommend Nexli to another firm owner?",
    lowLabel: "Not likely",
    highLabel: "Extremely likely",
    accent: "blue",
    required: true,
  },
  {
    id: "comment",
    number: 7,
    kind: "comment",
    prompt: "Anything we should address?",
    help: "Optional — goes straight to Marcel.",
    accent: "violet",
    required: false,
  },
];

export const SURVEY_QUESTION_COUNT = SURVEY_QUESTIONS.length;
export const SURVEY_REQUIRED_COUNT = SURVEY_QUESTIONS.filter((q) => q.required).length;
export const SURVEY_ESTIMATED_SECONDS = 90;

export function scaleQuestionLabel(id: ScaleQuestionId): string {
  switch (id) {
    case "overall":
      return "Overall";
    case "lead_quality":
      return "Lead quality";
    case "communication":
      return "Communication";
    case "responsiveness":
      return "Responsiveness";
  }
}

// ── Answer shapes ──────────────────────────────────────────

export type ValueAnswer = "yes" | "somewhat" | "no";
export const VALUE_ANSWERS: readonly ValueAnswer[] = ["yes", "somewhat", "no"];
export const VALUE_OPTIONS: { value: ValueAnswer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "somewhat", label: "Somewhat" },
  { value: "no", label: "No" },
];

export function isValueAnswer(v: unknown): v is ValueAnswer {
  return v === "yes" || v === "somewhat" || v === "no";
}

export function valueAnswerLabel(v: string | null | undefined): string {
  if (v === "yes") return "Yes";
  if (v === "somewhat") return "Somewhat";
  if (v === "no") return "No";
  return "—";
}

/** 1–5 answers to the rated questions, keyed by question id. */
export type SurveyAnswers = Partial<Record<ScaleQuestionId, number>>;

export function isScaleScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}

export function isNpsScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 10;
}

/** Validates and normalises a raw `answers` object; null when any required rated answer is missing/invalid. */
export function parseSurveyAnswers(raw: unknown): SurveyAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const out: SurveyAnswers = {};
  for (const id of SCALE_QUESTION_IDS) {
    const v = Number((raw as Record<string, unknown>)[id]);
    if (!isScaleScore(v)) return null;
    out[id] = v;
  }
  return out;
}

export function surveyComplete(
  answers: SurveyAnswers | null | undefined,
  valueAnswer: string | null | undefined,
  npsScore: number | null | undefined
): boolean {
  return (
    SCALE_QUESTION_IDS.every((id) => isScaleScore(answers?.[id])) &&
    isValueAnswer(valueAnswer) &&
    isNpsScore(npsScore)
  );
}

// ── Scoring rules ──────────────────────────────────────────

/** Standard NPS bands. */
export const NPS_DETRACTOR_MAX = 6;
export const NPS_PROMOTER_MIN = 9;
/** A rated (1–5) answer at or below this is a red flag. */
export const SCALE_LOW_MAX = 2;

export type NpsCategory = "detractor" | "passive" | "promoter";

export function npsCategory(score: number): NpsCategory {
  if (score <= NPS_DETRACTOR_MAX) return "detractor";
  if (score >= NPS_PROMOTER_MIN) return "promoter";
  return "passive";
}

/** Traffic-light hex for an NPS score (red / amber / green). */
export function npsColor(score: number): string {
  const c = npsCategory(score);
  return c === "detractor" ? "#f43f5e" : c === "passive" ? "#f59e0b" : "#10b981";
}

/** Traffic-light hex for a 1–5 answer. */
export function scaleColor(score: number): string {
  if (score <= SCALE_LOW_MAX) return "#f43f5e";
  if (score === 3) return "#f59e0b";
  return "#10b981";
}

/**
 * Human-readable list of the answers that should alert Marcel: NPS
 * detractor, "No" to getting value, or any rated answer ≤ SCALE_LOW_MAX.
 * Empty means nothing to flag.
 */
export function weakAnswers(input: {
  answers?: SurveyAnswers | null;
  valueAnswer?: string | null;
  npsScore?: number | null;
}): string[] {
  const out: string[] = [];
  if (typeof input.npsScore === "number" && npsCategory(input.npsScore) === "detractor") {
    out.push(`NPS ${input.npsScore}/10`);
  }
  if (input.valueAnswer === "no") out.push('"No" to getting what they pay for');
  for (const id of SCALE_QUESTION_IDS) {
    const v = input.answers?.[id];
    if (typeof v === "number" && v <= SCALE_LOW_MAX) out.push(`${scaleQuestionLabel(id)} ${v}/5`);
  }
  return out;
}

export function isLowScore(input: {
  answers?: SurveyAnswers | null;
  valueAnswer?: string | null;
  npsScore?: number | null;
}): boolean {
  return weakAnswers(input).length > 0;
}
