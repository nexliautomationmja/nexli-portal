"use client";

import { useEffect, useState } from "react";

type ValueAnswer = "yes" | "somewhat" | "no";

interface SurveyMeta {
  clientName: string;
  weekStart: string;
  submitted: boolean;
  results: { score: number | null; valueAnswer: string | null; comment: string | null } | null;
}

const SCORE_LABELS: Record<number, string> = {
  1: "Not at all",
  2: "Slightly",
  3: "Somewhat",
  4: "Mostly",
  5: "Very",
};

const VALUE_OPTIONS: { value: ValueAnswer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "somewhat", label: "Somewhat" },
  { value: "no", label: "No" },
];

const GRADIENT = "linear-gradient(135deg, #2563EB, #06B6D4)";

function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.08) 0%, transparent 60%)",
        }}
      />
      <div className="relative max-w-xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <span className="text-lg font-black tracking-tight">NEXLI</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Centered({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-xl font-black text-white mb-2">{title}</h1>
        <p className="text-sm text-gray-400">{body}</p>
      </div>
    </div>
  );
}

export function SurveyClient({
  token,
  initialScore,
}: {
  token: string;
  initialScore: number | null;
}) {
  const [meta, setMeta] = useState<SurveyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"ok" | "not_found" | "expired">("ok");
  const [score, setScore] = useState<number | null>(initialScore);
  const [valueAnswer, setValueAnswer] = useState<ValueAnswer | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
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
  }, [token]);

  async function submit() {
    if (!score || !valueAnswer) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultsScore: score, valueAnswer, comment: comment.trim() || undefined }),
      });
      if (res.status === 409) {
        setDone(true);
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
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (status === "not_found" || !meta) {
    return (
      <Centered
        title="Link Unavailable"
        body="This survey link isn't valid. If you think that's a mistake, just reply to the email it came from."
      />
    );
  }
  if (status === "expired") {
    return (
      <Centered
        title="This one's closed"
        body="This week's pulse check has expired — no worries. A fresh one lands in your inbox every Monday, and you can always reply to any of our emails to reach Marcel directly."
      />
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2">Thanks — Marcel reads every one of these.</h1>
          <p className="text-sm text-gray-400">
            If anything needs attention, you&rsquo;ll hear from us this week.
          </p>
        </div>
      </Shell>
    );
  }

  const readOnly = meta.submitted && meta.results;
  const shownScore = readOnly ? meta.results?.score ?? null : score;
  const shownValue = readOnly ? (meta.results?.valueAnswer as ValueAnswer | null) : valueAnswer;
  const shownComment = readOnly ? meta.results?.comment || "" : comment;

  return (
    <Shell>
      <div className="text-center mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">
          Week of {weekLabel(meta.weekStart)}
        </p>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">60-second pulse check</h1>
        <p className="text-gray-400 text-sm">
          {readOnly ? (
            <>You already answered this one — here&rsquo;s what you told us.</>
          ) : (
            <>
              Hi <span className="text-white font-medium">{meta.clientName}</span> — three quick taps so we
              catch anything early.
            </>
          )}
        </p>
      </div>

      <div className="space-y-6">
        {/* Q1 */}
        <section className="p-5 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-sm font-bold mb-4">
            1. How confident are you in the results you&rsquo;re seeing this week?
          </p>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = shownScore === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={Boolean(readOnly)}
                  onClick={() => setScore(n)}
                  className={`h-14 rounded-xl text-xl font-black transition-all border ${
                    active
                      ? "border-transparent text-white shadow-lg shadow-blue-500/20"
                      : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                  } disabled:cursor-default`}
                  style={active ? { background: GRADIENT } : undefined}
                  aria-pressed={active}
                  aria-label={`${n} — ${SCORE_LABELS[n]}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-gray-500">
            <span>Not at all</span>
            <span>Very</span>
          </div>
          {shownScore && (
            <p className="mt-2 text-xs text-cyan-400 font-semibold text-center">{SCORE_LABELS[shownScore]}</p>
          )}
        </section>

        {/* Q2 */}
        <section className="p-5 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-sm font-bold mb-4">2. Are you getting what you&rsquo;re paying for?</p>
          <div className="grid grid-cols-3 gap-2">
            {VALUE_OPTIONS.map((opt) => {
              const active = shownValue === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={Boolean(readOnly)}
                  onClick={() => setValueAnswer(opt.value)}
                  className={`h-12 rounded-xl text-sm font-bold transition-all border ${
                    active
                      ? "border-transparent text-white"
                      : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                  } disabled:cursor-default`}
                  style={active ? { background: GRADIENT } : undefined}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Q3 */}
        <section className="p-5 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-sm font-bold mb-1">3. Anything we should address this week?</p>
          <p className="text-xs text-gray-500 mb-3">Optional — goes straight to Marcel.</p>
          {readOnly ? (
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {shownComment || <span className="text-gray-500">No comment left.</span>}
            </p>
          ) : (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 2000))}
              placeholder="A lead that went cold, a question about the ads, anything on your mind…"
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500 resize-none transition-colors"
            />
          )}
        </section>

        {!readOnly && (
          <div className="text-center space-y-3">
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={!score || !valueAnswer || submitting}
              className="px-8 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: GRADIENT }}
            >
              {submitting ? "Sending…" : "Send to Marcel"}
            </button>
            <p className="text-[11px] text-gray-600">Private to you and the Nexli team.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
