import Link from "next/link";
import { FeatureCard } from "@/components/rainmaker";
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
    <FeatureCard tone="blue" eyebrow="Pulse check · 90 seconds" title={q1.prompt}>
      <p className="-mt-1 mb-4 text-xs text-neutral-400">Tap a number: {SURVEY_QUESTION_COUNT} quick questions, straight to Marcel.</p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Link
            key={n}
            href={`/survey/${token}?overall=${n}`}
            aria-label={n === 1 ? `1, ${q1.lowLabel}` : n === 5 ? `5, ${q1.highLabel}` : String(n)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-sm font-black text-white transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/15"
          >
            {n}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex w-[15.5rem] justify-between text-[10px] text-neutral-400">
        <span>{q1.lowLabel}</span>
        <span>{q1.highLabel}</span>
      </div>
    </FeatureCard>
  );
}
