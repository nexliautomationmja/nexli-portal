"use client";

import { useEffect, useState } from "react";
import {
  SURVEY_QUESTIONS,
  VALUE_OPTIONS,
  SURVEY_REQUIRED_COUNT,
  SURVEY_ESTIMATED_SECONDS,
  SCALE_QUESTION_IDS,
  surveyComplete,
  isValueAnswer,
  npsColor,
  valueAnswerLabel,
  type SurveyAnswers,
  type SurveyQuestion,
  type ScaleQuestionId,
  type ValueAnswer,
} from "@/lib/survey-questions";
import {
  ACCENT,
  SYNE,
  CTA_CLASSES,
  Icon,
  PATHS,
  ProgressRing,
  LpCard,
  IconChip,
  Pill,
  LpSpinner,
  LpMessage,
  ShimmerCard,
  LaunchPadShell,
} from "@/components/launch-pad";

// ══════════════════════════════════════════════════════════
// Pulse check — the biweekly client survey, built on the Launch
// Pad visual system (same shell, cards, icon chips, pills, confetti).
// Questions come from src/lib/survey-questions.ts — never hardcode them here.
// ══════════════════════════════════════════════════════════

interface SurveyMeta {
  clientName: string;
  weekStart: string;
  submitted: boolean;
  results: {
    answers: SurveyAnswers | null;
    valueAnswer: string | null;
    npsScore: number | null;
    comment: string | null;
    /** Single 1–5 "confidence" score from surveys before the seven-question revision. */
    legacyScore: number | null;
  } | null;
}

const QUESTION_ICON: Record<SurveyQuestion["id"], React.ReactNode> = {
  overall: PATHS.rocket,
  lead_quality: PATHS.star,
  communication: PATHS.monitor,
  responsiveness: PATHS.zap,
  value: PATHS.circleDollar,
  nps: PATHS.heart,
  comment: PATHS.messageSquare,
};

const CHOICE_BASE =
  "font-black transition-all disabled:cursor-default";
const CHOICE_IDLE =
  "bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 hover:scale-[1.04] active:scale-[0.96]";
const CHOICE_IDLE_LOCKED = "bg-white/5 border border-white/10 text-neutral-500 opacity-50";
const CHOICE_ACTIVE = "bg-blue-600 text-white shadow-xl shadow-blue-600/30 scale-105";

function choiceCls(active: boolean, locked: boolean): string {
  if (active) return `${CHOICE_BASE} ${CHOICE_ACTIVE}`;
  return `${CHOICE_BASE} ${locked ? CHOICE_IDLE_LOCKED : CHOICE_IDLE}`;
}

function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ─── Question card ─────────────────────────────────────────

function QuestionCard({
  q,
  index,
  answered,
  children,
}: {
  q: SurveyQuestion;
  index: number;
  answered: boolean;
  children: React.ReactNode;
}) {
  return (
    <LpCard className="lp-card" style={{ animationDelay: `${0.1 + 0.05 * index}s` }}>
      <div className="flex items-start gap-3">
        <IconChip accent={q.accent} delay={`${index * 0.35}s`}>
          <Icon d={QUESTION_ICON[q.id]} size={22} className={ACCENT[q.accent].icon} />
        </IconChip>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white flex-1 min-w-0">
              {q.number}. {q.prompt}
            </h3>
            {answered ? (
              <Pill tone="done" accent={q.accent}>
                Answered ✓
              </Pill>
            ) : (
              <Pill tone="neutral">{q.required ? "Required" : "Optional"}</Pill>
            )}
          </div>
          {q.help && (
            <p className="text-xs sm:text-[13px] mt-1 leading-relaxed text-neutral-400">
              {q.help}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </LpCard>
  );
}

// ─── Answer controls ───────────────────────────────────────

function ScaleControl({
  q,
  value,
  locked,
  onChange,
}: {
  q: SurveyQuestion;
  value: number | null;
  locked: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div className="max-w-[340px] mx-auto sm:mx-0">
      <div className="flex items-center justify-between gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={locked}
              onClick={() => onChange(n)}
              aria-pressed={active}
              aria-label={`${n} of 5`}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${choiceCls(active, locked)}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[11px] text-neutral-500">
        <span>{q.lowLabel}</span>
        <span>{q.highLabel}</span>
      </div>
    </div>
  );
}

function ValueControl({
  value,
  locked,
  onChange,
}: {
  value: ValueAnswer | null;
  locked: boolean;
  onChange: (v: ValueAnswer) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {VALUE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={locked}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`h-12 rounded-full text-sm ${choiceCls(active, locked)}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NpsControl({
  q,
  value,
  locked,
  onChange,
}: {
  q: SurveyQuestion;
  value: number | null;
  locked: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
        {Array.from({ length: 11 }, (_, n) => {
          const active = value === n;
          const color = npsColor(n);
          return (
            <button
              key={n}
              type="button"
              disabled={locked}
              onClick={() => onChange(n)}
              aria-pressed={active}
              aria-label={`${n} of 10`}
              className={`w-11 h-11 sm:w-10 sm:h-10 rounded-full text-sm ${CHOICE_BASE} ${
                active
                  ? "text-white shadow-xl scale-105"
                  : locked
                    ? CHOICE_IDLE_LOCKED
                    : CHOICE_IDLE
              }`}
              style={
                active
                  ? { background: color, boxShadow: `0 12px 24px -8px ${color}99` }
                  : undefined
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[11px] text-neutral-500">
        <span>{q.lowLabel}</span>
        <span>{q.highLabel}</span>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────

export function SurveyClient({
  token,
  initialAnswers,
}: {
  token: string;
  initialAnswers: Partial<SurveyAnswers>;
}) {
  const [meta, setMeta] = useState<SurveyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"ok" | "not_found" | "expired">("ok");
  const [answers, setAnswers] = useState<SurveyAnswers>(initialAnswers);
  const [valueAnswer, setValueAnswer] = useState<ValueAnswer | null>(null);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);

  // /survey/preview renders the real page with sample data and never saves —
  // so Marcel (and prospects on a call) can see exactly what clients get.
  const isPreview = token === "preview";

  useEffect(() => {
    if (isPreview) {
      const d = new Date();
      const dow = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
      setMeta({
        clientName: "Sample Client",
        weekStart: d.toISOString().slice(0, 10),
        submitted: false,
        results: null,
      });
      setLoading(false);
      return;
    }
    fetch(`/api/survey/${token}`)
      .then(async (r) => {
        if (r.status === 404) {
          setStatus("not_found");
          return;
        }
        if (r.status === 410) {
          setStatus("expired");
          return;
        }
        if (!r.ok) throw new Error("load_failed");
        setMeta(await r.json());
      })
      .catch(() => setStatus("not_found"))
      .finally(() => setLoading(false));
  }, [token, isPreview]);

  const complete = surveyComplete(answers, valueAnswer, npsScore);

  function finish() {
    setDone(true);
    setBurst((b) => b + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!complete || valueAnswer == null || npsScore == null) return;
    if (isPreview) {
      finish();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          valueAnswer,
          npsScore,
          comment: comment.trim() || undefined,
        }),
      });
      if (res.status === 409) {
        finish();
        return;
      }
      if (res.status === 410) {
        setStatus("expired");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      finish();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const badgeIcon = <Icon d={PATHS.star} size={14} className="text-amber-400" />;

  // ─── Loading / error states ───
  if (status === "not_found") {
    return (
      <LpMessage
        emoji="🔍"
        title="Link Unavailable"
        body="Double-check the link from your email, or reply to any of our emails and we'll send a fresh one."
      />
    );
  }
  if (status === "expired") {
    return (
      <LpMessage
        emoji="⏳"
        title="This one's closed"
        body="This pulse check has expired — no worries. A fresh one lands in your inbox every other Monday, and you can always reply to any of our emails to reach Marcel directly."
      />
    );
  }
  if (loading || !meta) {
    return (
      <LaunchPadShell maxWidth="xl" badge="Pulse Check" badgeIcon={badgeIcon} burst={burst}>
        <LpSpinner />
      </LaunchPadShell>
    );
  }

  // ─── Derived view state ───
  const saved = meta.submitted && meta.results ? meta.results : null;
  const readOnly = done || saved !== null;
  const isLegacy = saved !== null && saved.answers == null && saved.legacyScore != null;

  const shownAnswers: SurveyAnswers = saved ? saved.answers ?? {} : answers;
  const shownValue: ValueAnswer | null = saved
    ? isValueAnswer(saved.valueAnswer)
      ? saved.valueAnswer
      : null
    : valueAnswer;
  const shownNps: number | null = saved ? saved.npsScore : npsScore;
  const shownComment = saved ? saved.comment ?? "" : comment;

  const answeredRequired = readOnly
    ? SURVEY_REQUIRED_COUNT
    : SCALE_QUESTION_IDS.filter((id) => answers[id] != null).length +
      (valueAnswer != null ? 1 : 0) +
      (npsScore != null ? 1 : 0);
  const percent = Math.round((answeredRequired / SURVEY_REQUIRED_COUNT) * 100);
  const firstName = (meta.clientName || "there").split(" ")[0];

  function isAnswered(q: SurveyQuestion): boolean {
    switch (q.kind) {
      case "scale5":
        return shownAnswers[q.id as ScaleQuestionId] != null;
      case "value":
        return shownValue != null;
      case "nps":
        return shownNps != null;
      case "comment":
        return shownComment.trim().length > 0;
    }
  }

  return (
    <LaunchPadShell maxWidth="xl" badge="Pulse Check" badgeIcon={badgeIcon} burst={burst}>
      {/* ─── Thank-you banner ─── */}
      {done && (
        <ShimmerCard className="lp-card">
          <div className="text-3xl mb-1">🎉</div>
          <h2 className="text-xl font-black text-white" style={SYNE}>
            Thanks — Marcel reads every one of these.
          </h2>
          <p className="text-sm mt-1 text-neutral-300">
            You&apos;ll get the next one in two weeks.
          </p>
        </ShimmerCard>
      )}

      {/* ─── Hero ─── */}
      <section className="lp-card" style={{ animationDelay: "0.05s" }}>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1 text-center sm:text-left">
            {isPreview && (
              <p className="mb-3 inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300">
                Preview — nothing you enter here is saved
              </p>
            )}
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              Week of {weekLabel(meta.weekStart)}
            </p>
            <h1
              className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tighter text-white mt-1"
              style={SYNE}
            >
              Quick pulse check,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                {firstName}.
              </span>
            </h1>
            <p className="text-sm mt-3 leading-relaxed text-neutral-300">
              {readOnly
                ? "Here's what you sent us."
                : `About ${SURVEY_ESTIMATED_SECONDS} seconds. Honest answers help us fix things early.`}
            </p>
          </div>
          <ProgressRing percent={percent} />
        </div>
      </section>

      {/* ─── Questions ─── */}
      {isLegacy && saved ? (
        <LpCard className="lp-card" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-start gap-3">
            <IconChip accent="blue">
              <Icon d={PATHS.rocket} size={22} className={ACCENT.blue.icon} />
            </IconChip>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white">
                You rated that week {saved.legacyScore}/5
              </h3>
              {saved.valueAnswer && (
                <p className="text-xs sm:text-[13px] mt-1 leading-relaxed text-neutral-400">
                  Getting what you pay for:{" "}
                  <span className="text-white font-semibold">
                    {valueAnswerLabel(saved.valueAnswer)}
                  </span>
                </p>
              )}
              {saved.comment && (
                <p className="text-xs sm:text-[13px] mt-2 leading-relaxed text-neutral-300 whitespace-pre-wrap">
                  {saved.comment}
                </p>
              )}
            </div>
          </div>
        </LpCard>
      ) : (
        <div className="space-y-4">
          {SURVEY_QUESTIONS.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i} answered={isAnswered(q)}>
              {q.kind === "scale5" && (
                <ScaleControl
                  q={q}
                  value={shownAnswers[q.id as ScaleQuestionId] ?? null}
                  locked={readOnly}
                  onChange={(n) =>
                    setAnswers((prev) => ({ ...prev, [q.id as ScaleQuestionId]: n }))
                  }
                />
              )}
              {q.kind === "value" && (
                <ValueControl value={shownValue} locked={readOnly} onChange={setValueAnswer} />
              )}
              {q.kind === "nps" && (
                <NpsControl q={q} value={shownNps} locked={readOnly} onChange={setNpsScore} />
              )}
              {q.kind === "comment" && (
                <textarea
                  value={shownComment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={readOnly}
                  rows={4}
                  maxLength={2000}
                  placeholder={
                    readOnly
                      ? "No comment left."
                      : "A lead that went cold, a question about the ads, anything on your mind…"
                  }
                  className="lp-input resize-none disabled:opacity-70"
                />
              )}
            </QuestionCard>
          ))}
        </div>
      )}

      {/* ─── Submit ─── */}
      {!readOnly && (
        <LpCard
          className="lp-card"
          style={{ animationDelay: `${0.1 + 0.05 * SURVEY_QUESTIONS.length}s` }}
        >
          {error && <p className="text-xs font-semibold text-rose-400 mb-3">{error}</p>}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!complete || submitting}
              className={CTA_CLASSES}
            >
              {submitting ? "Sending…" : "Send to Marcel →"}
            </button>
            <div className="flex items-center gap-1.5">
              <Icon d={PATHS.lock} size={14} className="text-emerald-400 shrink-0" />
              <span className="text-[11px] text-neutral-500">
                Private to you and the Nexli team.
              </span>
            </div>
          </div>
          {!complete && (
            <p className="mt-3 text-[11px] text-neutral-500">
              {answeredRequired} of {SURVEY_REQUIRED_COUNT} required answers in — finish the
              rest to send.
            </p>
          )}
        </LpCard>
      )}
    </LaunchPadShell>
  );
}
