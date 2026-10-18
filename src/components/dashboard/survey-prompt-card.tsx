import Link from "next/link";
import { SURVEY_QUESTIONS, SURVEY_QUESTION_COUNT } from "@/lib/survey-questions";

/**
 * One-line pulse-check prompt on the client's Overview: question 1 with five
 * 1-click buttons. Each lands on the client's own survey page with that
 * answer pre-selected; the page asks the remaining questions. Pure
 * presentational — rendered server-side.
 */
export function SurveyPromptCard({ token }: { token: string }) {
  const q1 = SURVEY_QUESTIONS[0];
  return (
    <div className="glass-card p-4 md:p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
          {q1.prompt}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Tap a number — {SURVEY_QUESTION_COUNT} quick questions, about 90 seconds, straight to Marcel.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Link
            key={n}
            href={`/survey/${token}?overall=${n}`}
            title={n === 1 ? `1 — ${q1.lowLabel}` : n === 5 ? `5 — ${q1.highLabel}` : String(n)}
            className="w-10 h-10 rounded-xl border flex items-center justify-center text-sm font-black transition-colors hover:border-blue-500 hover:text-blue-500"
            style={{ borderColor: "var(--card-border)", background: "var(--input-bg)", color: "var(--text-main)" }}
          >
            {n}
          </Link>
        ))}
      </div>
    </div>
  );
}
