import Link from "next/link";

const SCORE_TITLES: Record<number, string> = {
  1: "Not at all",
  2: "Slightly",
  3: "Somewhat",
  4: "Mostly",
  5: "Very",
};

/**
 * One-line pulse-check prompt with five 1-click score buttons. Each lands on
 * the client's own survey page with that score pre-selected. Pure
 * presentational — rendered server-side on the Overview.
 */
export function SurveyPromptCard({ token }: { token: string }) {
  return (
    <div className="glass-card p-4 md:p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
          How confident are you in the results you&apos;re seeing this week?
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Tap a number — it takes 60 seconds and goes straight to Marcel.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Link
            key={n}
            href={`/survey/${token}?s=${n}`}
            title={`${n} — ${SCORE_TITLES[n]}`}
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
