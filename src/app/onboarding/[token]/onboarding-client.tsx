"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NexliLogo } from "@/components/ui/nexli-logo";

// ─── Types (mirror serializePublicOnboarding) ──────────────

interface PhaseData {
  id: string;
  title: string;
  description: string;
  emoji: string;
  status: "pending" | "in_progress" | "done";
  targetDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
}

interface TaskData {
  id: string;
  title: string;
  description: string;
  emoji: string;
  type: "credentials" | "confirm" | "upload";
  optional: boolean;
  status: "todo" | "submitted" | "approved" | "needs_attention";
  submittedAt: string | null;
  adminNote: string | null;
  files?: {
    front: { fileName: string; uploadedAt: string } | null;
    back: { fileName: string; uploadedAt: string } | null;
  };
  submission?: { confirmed?: boolean; notApplicable?: boolean } | null;
}

interface ActivityEntry {
  at: string;
  actor: "agency" | "client" | "system";
  type: string;
  message: string;
}

interface LaunchPadData {
  clientName: string;
  subject: string;
  signedAt: string | null;
  from: { name: string; company: string };
  onboarding: {
    startedAt: string;
    targetLaunchDate: string | null;
    progressPercent: number;
    phases: PhaseData[];
    tasks: TaskData[];
    activity: ActivityEntry[];
  };
}

// ─── Helpers ───────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  // Date-only strings get a fixed time so they don't shift a day in local TZ
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

const REGISTRARS = [
  "GoDaddy",
  "Namecheap",
  "Squarespace / Google Domains",
  "Cloudflare",
  "Wix",
  "Bluehost",
  "HostGator",
  "IONOS",
  "Other",
];

// ─── Confetti ──────────────────────────────────────────────

const CONFETTI_COLORS = ["#2563EB", "#06B6D4", "#10B981", "#8B5CF6", "#F59E0B"];

function ConfettiBurst({ burst }: { burst: number }) {
  if (!burst) return null;
  return (
    <div
      key={burst}
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {Array.from({ length: 36 }).map((_, i) => {
        const left = 10 + Math.random() * 80;
        const size = 6 + Math.random() * 8;
        const delay = Math.random() * 0.25;
        const duration = 1.6 + Math.random() * 1.2;
        const drift = -120 + Math.random() * 240;
        const spin = 360 + Math.random() * 720;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        return (
          <span
            key={i}
            style={
              {
                position: "absolute",
                top: "-20px",
                left: `${left}%`,
                width: `${size}px`,
                height: `${size * (Math.random() > 0.5 ? 1 : 0.4)}px`,
                background: color,
                borderRadius: Math.random() > 0.6 ? "50%" : "2px",
                animation: `lp-confetti-fall ${duration}s cubic-bezier(0.25, 0.4, 0.45, 1) ${delay}s forwards`,
                "--lp-drift": `${drift}px`,
                "--lp-spin": `${spin}deg`,
                opacity: 0,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

// ─── Progress Ring ─────────────────────────────────────────

function ProgressRing({ percent }: { percent: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const offset = C - (percent / 100) * C;
  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="lp-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--card-border)"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="url(#lp-ring)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-3xl font-black"
          style={{ color: "var(--text-main)", letterSpacing: "-0.03em" }}
        >
          {percent}%
        </span>
        <span
          className="text-[9px] font-black uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          Complete
        </span>
      </div>
    </div>
  );
}

// ─── Status pills ──────────────────────────────────────────

function PhasePill({ status }: { status: PhaseData["status"] }) {
  if (status === "done") return <span className="badge badge-emerald">Done ✓</span>;
  if (status === "in_progress")
    return <span className="badge badge-blue">In the works</span>;
  return <span className="badge badge-gray">Queued up</span>;
}

function TaskPill({ task }: { task: TaskData }) {
  if (task.status === "approved")
    return <span className="badge badge-emerald">Approved ✓</span>;
  if (task.status === "submitted") {
    if (task.submission?.notApplicable)
      return <span className="badge badge-gray">Skipped</span>;
    return <span className="badge badge-blue">Submitted ✓</span>;
  }
  if (task.status === "needs_attention")
    return <span className="badge badge-amber">Needs attention</span>;
  return (
    <span className="badge badge-amber">
      {task.optional ? "If applicable" : "Action needed"}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────

export function OnboardingClient({ token }: { token: string }) {
  const [data, setData] = useState<LaunchPadData | null>(null);
  const [errorKind, setErrorKind] = useState<"not_found" | "not_started" | "network" | null>(null);
  const [loading, setLoading] = useState(true);
  const [burst, setBurst] = useState(0);
  const celebratedRef = useRef(false);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(`/api/onboarding/${token}`, { cache: "no-store" });
        if (!res.ok) {
          // A transient failure during a background poll shouldn't wipe an
          // already-loaded page — only surface errors on the initial load.
          if (showSpinner) {
            const body = await res.json().catch(() => ({}));
            setErrorKind(body.error === "not_started" ? "not_started" : "not_found");
          }
          return;
        }
        setData(await res.json());
        setErrorKind(null);
      } catch {
        if (showSpinner) setErrorKind("network");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load(true);
    const interval = setInterval(() => {
      if (!document.hidden) load(false);
    }, 45_000);
    return () => clearInterval(interval);
  }, [load]);

  function celebrate() {
    setBurst((b) => b + 1);
  }

  // Big celebration the first time we see 100%
  useEffect(() => {
    if (data?.onboarding.progressPercent === 100 && !celebratedRef.current) {
      celebratedRef.current = true;
      celebrate();
    }
  }, [data?.onboarding.progressPercent]);

  // ─── Loading / error states ───
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-main)" }}
      >
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (errorKind || !data) {
    const notStarted = errorKind === "not_started";
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ background: "var(--bg-main)" }}
      >
        <NexliLogo size="md" />
        <div className="glass-card max-w-md w-full p-8 mt-8 space-y-3">
          <div className="text-4xl">{notStarted ? "🚧" : "🔍"}</div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
            {notStarted
              ? "Your Launch Pad isn't live yet"
              : "This link isn't active"}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {notStarted
              ? "We're getting things ready behind the scenes. Check back soon, or reach out to your Nexli team."
              : "Double-check the link from your email, or contact your Nexli team for a fresh one."}
          </p>
        </div>
      </div>
    );
  }

  const ob = data.onboarding;
  const firstName = (data.clientName || "there").split(" ")[0];
  const tasksDone = ob.tasks.filter(
    (t) => t.status === "submitted" || t.status === "approved"
  ).length;
  const allDone = ob.progressPercent === 100;

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: "var(--bg-main)" }}
    >
      <style>{`
        @keyframes lp-confetti-fall {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--lp-drift), 105vh, 0) rotate(var(--lp-spin)); opacity: 0.9; }
        }
        @keyframes lp-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-check-bounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.25); opacity: 1; }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes lp-glow-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45); }
          50% { box-shadow: 0 0 0 7px rgba(37, 99, 235, 0); }
        }
        @keyframes lp-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .lp-card { animation: lp-fade-up 0.5s ease-out both; }
        .lp-dot-active { animation: lp-glow-pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Ambient brand glows */}
      <div
        className="pointer-events-none fixed -top-40 -right-32 w-[560px] h-[560px] rounded-full opacity-100"
        style={{
          background:
            "radial-gradient(circle, rgba(37, 99, 235, 0.10) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none fixed -bottom-32 -left-24 w-[480px] h-[480px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)",
        }}
      />

      <ConfettiBurst burst={burst} />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* ─── Header ─── */}
        <header className="flex items-center justify-between lp-card">
          <NexliLogo size="md" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            <span
              className="text-blue-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase"
              style={{ animation: "lp-float 3s ease-in-out infinite" }}
            >
              🚀 Launch Pad
            </span>
          </div>
        </header>

        {/* ─── Celebration banner ─── */}
        {allDone && (
          <div
            className="lp-card rounded-lg p-5 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.18), rgba(6,182,212,0.18))",
              border: "1px solid rgba(6,182,212,0.35)",
            }}
          >
            <div className="text-3xl mb-1">🎉</div>
            <h2 className="text-lg font-black" style={{ color: "var(--text-main)" }}>
              Everything&apos;s done — you&apos;re cleared for launch!
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Your Nexli team will be in touch with go-live details.
            </p>
          </div>
        )}

        {/* ─── Hero ─── */}
        <section className="glass-card p-6 sm:p-8 lp-card" style={{ animationDelay: "0.05s" }}>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 text-center sm:text-left">
              <h1
                className="text-2xl sm:text-3xl font-black leading-tight"
                style={{ color: "var(--text-main)" }}
              >
                Welcome aboard, {firstName}! 🚀
              </h1>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                We&apos;re already building. This page updates in real time, so you
                always know exactly where everything stands — no guessing, no
                waiting on hold.
              </p>
              <div className="mt-4 inline-flex flex-col items-center sm:items-start">
                <span
                  className="text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Estimated Launch
                </span>
                <span
                  className="text-lg font-bold"
                  style={{
                    background: "linear-gradient(135deg, #2563EB, #06B6D4)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {ob.targetLaunchDate
                    ? formatDate(ob.targetLaunchDate)
                    : "Being scheduled"}
                </span>
              </div>
            </div>
            <ProgressRing percent={ob.progressPercent} />
          </div>
        </section>

        {/* ─── Build phases ─── */}
        <section className="glass-card p-6 sm:p-8 lp-card" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>
              What we&apos;re building for you
            </h2>
            <span className="badge badge-blue">
              {ob.phases.filter((p) => p.status === "done").length} of{" "}
              {ob.phases.length} done
            </span>
          </div>

          <div className="space-y-0">
            {ob.phases.map((phase, i) => {
              const isLast = i === ob.phases.length - 1;
              return (
                <div key={phase.id} className="flex gap-4">
                  {/* Timeline dot + connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${
                        phase.status === "in_progress" ? "lp-dot-active" : ""
                      }`}
                      style={{
                        background:
                          phase.status === "done"
                            ? "linear-gradient(135deg, #10B981, #06B6D4)"
                            : phase.status === "in_progress"
                            ? "linear-gradient(135deg, #2563EB, #06B6D4)"
                            : "var(--input-bg)",
                        border:
                          phase.status === "pending"
                            ? "1px solid var(--card-border)"
                            : "none",
                      }}
                    >
                      {phase.status === "done" ? (
                        <svg
                          className="w-4 h-4 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ animation: "lp-check-bounce 0.5s ease-out" }}
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <span>{phase.emoji}</span>
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className="w-px flex-1 my-1"
                        style={{
                          background:
                            phase.status === "done"
                              ? "linear-gradient(#10B981, var(--card-border))"
                              : "var(--card-border)",
                        }}
                      />
                    )}
                  </div>

                  {/* Phase body */}
                  <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-6"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className="text-sm font-bold"
                        style={{ color: "var(--text-main)" }}
                      >
                        {phase.title}
                      </h3>
                      <PhasePill status={phase.status} />
                      {phase.targetDate && phase.status !== "done" && (
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: "var(--text-muted)" }}
                        >
                          ETA {formatDate(phase.targetDate)}
                        </span>
                      )}
                      {phase.completedAt && phase.status === "done" && (
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Finished {formatDate(phase.completedAt)}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs mt-1 leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {phase.description}
                    </p>
                    {phase.note && (
                      <div
                        className="mt-2 px-3 py-2 rounded-md text-xs"
                        style={{
                          background: "var(--accent-blue-bg)",
                          border: "1px solid var(--accent-blue-border)",
                          color: "var(--text-main)",
                        }}
                      >
                        <span className="font-bold">Latest: </span>
                        {phase.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Client tasks ─── */}
        <section className="lp-card" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>
              What we need from you
            </h2>
            <span className="badge badge-blue">
              {tasksDone} of {ob.tasks.length} done
            </span>
          </div>
          <div className="space-y-4">
            {ob.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                token={token}
                onSubmitted={() => {
                  celebrate();
                  load(false);
                }}
              />
            ))}
          </div>
        </section>

        {/* ─── Mission log ─── */}
        <section className="glass-card p-6 sm:p-8 lp-card" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-main)" }}>
            Mission log 📡
          </h2>
          {ob.activity.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Updates from your build will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {[...ob.activity].reverse().map((entry, i) => (
                <div key={`${entry.at}-${i}`} className="flex gap-3 items-start">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{
                      background:
                        entry.actor === "client"
                          ? "#06B6D4"
                          : entry.actor === "agency"
                          ? "#2563EB"
                          : "#10B981",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: "var(--text-main)" }}>
                      {entry.message}
                    </p>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {timeAgo(entry.at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Footer ─── */}
        <footer className="text-center pb-6 space-y-2">
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Questions? Your Nexli team is one message away.
          </p>
          <p className="text-[10px] opacity-60" style={{ color: "var(--text-muted)" }}>
            {data.from.company || data.from.name} • Powered by the Digital
            Rainmaker System
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─── Task cards ────────────────────────────────────────────

function TaskCard({
  task,
  token,
  onSubmitted,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
}) {
  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{
            background: "var(--accent-blue-bg)",
            border: "1px solid var(--accent-blue-border)",
          }}
        >
          {task.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
              {task.title}
            </h3>
            <TaskPill task={task} />
          </div>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {task.description}
          </p>
          {task.adminNote && task.status === "needs_attention" && (
            <div
              className="mt-2 px-3 py-2 rounded-md text-xs"
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                color: "var(--text-main)",
              }}
            >
              <span className="font-bold">From your Nexli team: </span>
              {task.adminNote}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        {task.type === "credentials" && (
          <DnsForm task={task} token={token} onSubmitted={onSubmitted} />
        )}
        {task.type === "confirm" && (
          <FbConfirm task={task} token={token} onSubmitted={onSubmitted} />
        )}
        {task.type === "upload" && (
          <LicenseUpload task={task} token={token} onSubmitted={onSubmitted} />
        )}
      </div>
    </div>
  );
}

function SubmittedNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3 rounded-lg"
      style={{
        background: "var(--accent-emerald-bg)",
        border: "1px solid var(--accent-emerald-border)",
      }}
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: "linear-gradient(135deg, #10B981, #06B6D4)",
          animation: "lp-check-bounce 0.5s ease-out",
        }}
      >
        <svg
          className="w-3.5 h-3.5 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <span className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>
        {children}
      </span>
    </div>
  );
}

// ── DNS / registrar credentials form ──

function DnsForm({
  task,
  token,
  onSubmitted,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
}) {
  const [registrar, setRegistrar] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local flag so the just-typed values vanish immediately on success
  const [justSent, setJustSent] = useState(false);

  const done =
    justSent || task.status === "submitted" || task.status === "approved";

  if (done) {
    return (
      <SubmittedNote>
        Got it — we&apos;ll take it from here. Your login details are locked away
        and only visible to your Nexli team.
      </SubmittedNote>
    );
  }

  async function handleSubmit() {
    if (!registrar || !username.trim() || !password) {
      setError("Registrar, username, and password are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: "dns_access",
          submission: { registrar, loginUrl, username, password, notes },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setJustSent(true);
      setPassword("");
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls = "block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5";

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            Where&apos;s your domain? *
          </label>
          <select
            value={registrar}
            onChange={(e) => setRegistrar(e.target.value)}
            className="glass-input"
          >
            <option value="">Select registrar…</option>
            {REGISTRARS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            Login URL (optional)
          </label>
          <input
            type="url"
            value={loginUrl}
            onChange={(e) => setLoginUrl(e.target.value)}
            placeholder="https://…"
            className="glass-input"
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            Username / Email *
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@business.com"
            className="glass-input"
            autoComplete="off"
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="glass-input pr-16"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className={labelCls} style={{ color: "var(--text-muted)" }}>
          Anything else we should know?
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="2FA codes go to my cell, the account is under my partner's name, etc."
          className="glass-input resize-none"
        />
      </div>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "#fb7185" }}>
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-3 rounded-full text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          {submitting ? "Sending securely…" : "Send access securely →"}
        </button>
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5 text-emerald-400 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Sent over an encrypted connection — visible only to your Nexli team
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Facebook Ads invite confirm ──

function FbConfirm({
  task,
  token,
  onSubmitted,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localResult, setLocalResult] = useState<"confirmed" | "skipped" | null>(null);

  const skipped =
    localResult === "skipped" || Boolean(task.submission?.notApplicable);
  const done =
    localResult !== null ||
    task.status === "submitted" ||
    task.status === "approved";

  if (done) {
    return skipped ? (
      <SubmittedNote>No problem — we&apos;ve marked this one as not applicable.</SubmittedNote>
    ) : (
      <SubmittedNote>
        Invite received on our end soon — we&apos;ll confirm once we&apos;re connected!
      </SubmittedNote>
    );
  }

  async function submit(notApplicable: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: "fb_ads_invite",
          submission: notApplicable ? { notApplicable: true } : { confirmed: true },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setLocalResult(notApplicable ? "skipped" : "confirmed");
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <ol
        className="text-xs space-y-1.5 pl-4 list-decimal leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        <li>
          Open{" "}
          <span className="font-semibold" style={{ color: "var(--text-main)" }}>
            Meta Business Settings → Partners
          </span>
        </li>
        <li>
          Click{" "}
          <span className="font-semibold" style={{ color: "var(--text-main)" }}>
            Add → Give a partner access to your assets
          </span>
        </li>
        <li>
          Enter our Business ID (from your welcome email) and grant access to
          your ad account
        </li>
      </ol>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "#fb7185" }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => submit(false)}
          disabled={submitting}
          className="px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          I sent the invite ✓
        </button>
        <button
          onClick={() => submit(true)}
          disabled={submitting}
          className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            color: "var(--text-muted)",
            border: "1px solid var(--card-border)",
            background: "var(--input-bg)",
          }}
        >
          I don&apos;t run Facebook Ads
        </button>
      </div>
    </div>
  );
}

// ── Driver's license upload ──

function LicenseUpload({
  task,
  token,
  onSubmitted,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
}) {
  const done = task.status === "submitted" || task.status === "approved";

  if (done) {
    return (
      <SubmittedNote>
        Both sides received — we&apos;re getting your business number verified. 🎉
      </SubmittedNote>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <LicenseSideDropzone
        side="front"
        existing={task.files?.front ?? null}
        token={token}
        onSubmitted={onSubmitted}
      />
      <LicenseSideDropzone
        side="back"
        existing={task.files?.back ?? null}
        token={token}
        onSubmitted={onSubmitted}
      />
    </div>
  );
}

function LicenseSideDropzone({
  side,
  existing,
  token,
  onSubmitted,
}: {
  side: "front" | "back";
  existing: { fileName: string; uploadedAt: string } | null;
  token: string;
  onSubmitted: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadedName = localFileName || existing?.fileName || null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("side", side);
      formData.append("file", file);
      const res = await fetch(`/api/onboarding/${token}/upload`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Upload failed. Please try again.");
        return;
      }
      setLocalFileName(file.name);
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full rounded-lg p-4 text-center transition-all active:scale-[0.99] disabled:opacity-60"
        style={{
          border: uploadedName
            ? "1px solid var(--accent-emerald-border)"
            : "2px dashed var(--card-border)",
          background: uploadedName ? "var(--accent-emerald-bg)" : "var(--input-bg)",
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Uploading…
            </span>
          </div>
        ) : uploadedName ? (
          <div className="flex flex-col items-center gap-1 py-1">
            <span className="text-lg">✅</span>
            <span
              className="text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--text-muted)" }}
            >
              {side} uploaded
            </span>
            <span
              className="text-xs font-semibold truncate max-w-full"
              style={{ color: "var(--text-main)" }}
            >
              {uploadedName}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Tap to replace
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="text-xl">📸</span>
            <span
              className="text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--text-main)" }}
            >
              License {side}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Tap to snap a photo or choose a file
            </span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="text-xs font-semibold mt-1.5" style={{ color: "#fb7185" }}>
          {error}
        </p>
      )}
    </div>
  );
}
