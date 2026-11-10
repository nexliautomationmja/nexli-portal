"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  type Accent,
  ACCENT,
  SYNE,
  SHIMMER_CONIC,
  CTA_CLASSES,
  SECONDARY_BTN,
  labelCls,
  Icon,
  PATHS,
  FacebookLogo,
  GoogleGLogo,
  ProgressRing,
  SubmittedNote,
  LpCard,
  IconChip,
  LpSpinner,
  LpMessage,
  ShimmerCard,
  LaunchPadShell,
  NexliLegalFooter,
} from "@/components/launch-pad";
import {
  PROCESSORS,
  OTHER_PROCESSOR,
  NO_PROCESSOR,
  asPaymentSetup,
  cleanPaymentSetup,
  coverageGaps,
  gapLine,
  cardLine,
  achLine,
  wireLine,
  processorName,
  parseAmount,
  type PaymentSetup,
  type CardMode,
  type AchMode,
  type WireMode,
} from "@/lib/payment-setup";

// ══════════════════════════════════════════════════════════
// Launch Pad — client-facing onboarding page, styled to match
// the Digital Rainmaker page (nexli.net/rainmaker): #020617 bg,
// Syne gradient headlines, color-coded sections (website=blue,
// automations=violet, portal=cyan, reputation=amber), floating
// tinted icon chips, Step timeline, shimmer conic borders.
// ══════════════════════════════════════════════════════════

// ─── Types (mirror serializePublicOnboarding) ──────────────

interface PhaseData {
  id: string;
  title: string;
  description: string;
  emoji: string;
  features?: string[];
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
  type: "credentials" | "confirm" | "upload" | "form";
  optional: boolean;
  status: "todo" | "submitted" | "approved" | "needs_attention";
  submittedAt: string | null;
  adminNote: string | null;
  files?: {
    front: { fileName: string; uploadedAt: string } | null;
    back: { fileName: string; uploadedAt: string } | null;
  };
  /** fb_ads_invite: confirmed / notApplicable. payment_setup: the answers, or legacyStripe. */
  submission?: ({
    confirmed?: boolean;
    notApplicable?: boolean;
    legacyStripe?: boolean;
  } & Partial<PaymentSetup>) | null;
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
  /** True when Nexli itself issued this engagement (shows Nexli's legal footer). */
  nexli?: boolean;
  onboarding: {
    startedAt: string;
    targetLaunchDate: string | null;
    /** YYYY-MM-DD deadline for the client's items; null on legacy records. */
    clientDueAt: string | null;
    /** YYYY-MM-DD the ad campaigns went live; null until launch. */
    campaignLaunchedAt: string | null;
    /** 0 = due today, negative = overdue, null = no deadline. */
    daysUntilDue: number | null;
    isOverdue: boolean;
    clientItemsComplete: boolean;
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

/** Deadline status pill for the "What we need from you" header. */
function DuePill({ ob }: { ob: LaunchPadData["onboarding"] }) {
  if (ob.clientItemsComplete) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        All in ✓
      </span>
    );
  }
  if (!ob.clientDueAt || ob.daysUntilDue === null) return null;
  if (ob.isOverdue) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
        Overdue · was due {formatDate(ob.clientDueAt)}
      </span>
    );
  }
  const days = ob.daysUntilDue;
  const label =
    days === 0 ? "Due today" : days === 1 ? "1 day left" : `${days} days left`;
  const urgent = days <= 2;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
        urgent
          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
          : "bg-white/5 text-neutral-300 border-white/10"
      }`}
    >
      {label}
    </span>
  );
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

// ─── Color system (shared ACCENT in @/components/launch-pad) ────

const PHASE_ACCENT: Record<string, Accent> = {
  website: "blue",
  automations: "violet",
  portal: "cyan",
};

const TASK_ACCENT: Record<string, Accent> = {
  payment_setup: "cyan",
  dns_access: "blue",
  fb_ads_invite: "emerald",
  drivers_license: "amber",
};

const PHASE_ICON: Record<string, React.ReactNode> = {
  website: PATHS.globe,
  automations: PATHS.bot,
  portal: PATHS.layoutDashboard,
};

const TASK_ICON: Record<string, React.ReactNode> = {
  payment_setup: PATHS.creditCard,
  dns_access: PATHS.globe,
  drivers_license: PATHS.idCard,
};

// ─── Status pills ──────────────────────────────────────────

function PhasePill({ status, accent }: { status: PhaseData["status"]; accent: Accent }) {
  const a = ACCENT[accent];
  if (status === "done") {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${a.badgeDone}`}>
        Done ✓
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${a.badgeDone}`}>
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: a.dotBg }}
        />
        In the works
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-neutral-400 border border-white/10">
      Queued up
    </span>
  );
}

function TaskPill({ task, accent }: { task: TaskData; accent: Accent }) {
  const a = ACCENT[accent];
  if (task.status === "approved") {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${a.badgeDone}`}>
        Approved ✓
      </span>
    );
  }
  if (task.status === "submitted") {
    if (task.submission?.notApplicable) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-neutral-400 border border-white/10">
          Skipped
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${a.badgeDone}`}>
        Submitted ✓
      </span>
    );
  }
  if (task.status === "needs_attention") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
        Needs attention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-white/70 border border-white/10">
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
    // The background poll also recovers the not_started screen: once the
    // setup invoice is paid the API returns 200, load() stores the data and
    // clears errorKind, and the Launch Pad renders without a manual reload.
    const interval = setInterval(() => {
      if (!document.hidden) load(false);
    }, 45_000);
    // Re-check right away when the tab regains focus (e.g. after paying the
    // invoice in another tab) instead of waiting for the next tick.
    const onVisible = () => {
      if (!document.hidden) load(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
    return <LpSpinner fullScreen />;
  }

  if (errorKind || !data) {
    const notStarted = errorKind === "not_started";
    return (
      <LpMessage
        emoji={notStarted ? "🚧" : "🔍"}
        title={
          notStarted
            ? "Your Launch Pad isn't live yet"
            : "This link isn't active"
        }
        body={
          notStarted
            ? "Your Launch Pad opens as soon as your setup invoice is paid. Check your inbox for the invoice, or reach out to your Nexli team."
            : "Double-check the link from your email, or contact your Nexli team for a fresh one."
        }
      />
    );
  }

  const ob = data.onboarding;
  const firstName = (data.clientName || "there").split(" ")[0];
  const tasksDone = ob.tasks.filter(
    (t) => t.status === "submitted" || t.status === "approved"
  ).length;
  const allDone = ob.progressPercent === 100;

  return (
    <LaunchPadShell
      badge="Launch Pad"
      badgeIcon={<Icon d={PATHS.rocket} size={14} className="text-blue-400" />}
      burst={burst}
    >
      {/* ─── Celebration banner ─── */}
      {allDone && (
        <ShimmerCard className="lp-card">
          <div className="text-3xl mb-1">🎉</div>
          <h2 className="text-xl font-bold text-white" style={SYNE}>
            Everything&apos;s done — you&apos;re cleared for launch!
          </h2>
          <p className="text-sm mt-1 text-neutral-300">
            Your Nexli team will be in touch with go-live details.
          </p>
        </ShimmerCard>
      )}

      {/* ─── Hero ─── */}
      <section className="lp-card" style={{ animationDelay: "0.05s" }}>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1 text-center sm:text-left">
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight text-white"
              style={SYNE}
            >
              Welcome aboard,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                {firstName}.
              </span>
            </h1>
            <p className="text-sm mt-3 leading-relaxed text-neutral-300">
              We&apos;re already building. This page updates in real time, so
              you always know exactly where everything stands — no guessing,
              no waiting on hold.
            </p>
            <p className="text-sm mt-2 leading-relaxed">
              <span className="text-white font-semibold">
                The faster we get what we need from you, the faster we can
                build this out for you.
              </span>{" "}
              ⚡
            </p>

            {/* Floating icon chips — website / automations / portal / reviews / ads */}
            <div className="flex flex-wrap gap-3 mt-5 justify-center sm:justify-start">
              {(
                [
                  ["blue", <Icon key="b" d={PATHS.monitor} size={28} className={ACCENT.blue.icon} />],
                  ["violet", <Icon key="v" d={PATHS.bot} size={28} className={ACCENT.violet.icon} />],
                  ["cyan", <Icon key="c" d={PATHS.layoutDashboard} size={28} className={ACCENT.cyan.icon} />],
                  ["amber", <GoogleGLogo key="g" size={26} />],
                  ["emerald", <FacebookLogo key="f" size={26} />],
                  ["stripe", <Icon key="s" d={PATHS.creditCard} size={26} className="text-white" />],
                ] as [Accent, React.ReactNode][]
              ).map(([accent, icon], i) => (
                <div
                  key={accent}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${ACCENT[accent].chip}`}
                  style={{
                    filter: ACCENT[accent].chipGlow,
                    animation: `lp-float 3s ease-in-out ${i * 0.35}s infinite`,
                  }}
                >
                  {icon}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap justify-center sm:justify-start gap-x-8 gap-y-4">
              <div className="inline-flex flex-col items-center sm:items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Estimated Launch
                </span>
                <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                  {ob.targetLaunchDate
                    ? formatDate(ob.targetLaunchDate)
                    : "Being scheduled"}
                </span>
              </div>
              <div className="inline-flex flex-col items-center sm:items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Your items due
                </span>
                <span
                  className={`text-lg font-bold ${
                    ob.clientItemsComplete
                      ? "text-emerald-300"
                      : ob.isOverdue
                        ? "text-rose-400"
                        : ob.daysUntilDue !== null && ob.daysUntilDue <= 2
                          ? "text-amber-300"
                          : "text-white"
                  }`}
                >
                  {ob.clientDueAt ? formatDate(ob.clientDueAt) : "—"}
                </span>
              </div>
            </div>
            {ob.campaignLaunchedAt && (
              <p className="mt-4 text-xs text-center sm:text-left text-neutral-400">
                <span className="text-emerald-300 font-semibold">
                  Campaigns live since {formatDate(ob.campaignLaunchedAt)}
                </span>
              </p>
            )}
          </div>
          <ProgressRing percent={ob.progressPercent} />
        </div>
      </section>

      {/* ─── Build phases — Step timeline ─── */}
      <section className="lp-card" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white" style={SYNE}>
            What we&apos;re building for you
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {ob.phases.filter((p) => p.status === "done").length} of{" "}
            {ob.phases.length} done
          </span>
        </div>

        <div className="relative">
          {/* Vertical timeline line */}
          <div
            className="absolute left-[19px] top-3 bottom-3 w-[2px]"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, #334155 12%, #334155 88%, transparent 100%)",
            }}
          />

          <div className="space-y-10">
            {ob.phases.map((phase, i) => {
              const accent = PHASE_ACCENT[phase.id] || "blue";
              const isCenterpiece = phase.id === "portal";
              return (
                <div key={phase.id} className="relative flex gap-4 sm:gap-6">
                  {/* Timeline dot */}
                  <div className="relative z-10 shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black border border-white/10">
                      {phase.status === "done" ? (
                        <div
                          className="h-5 w-5 rounded-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-cyan-500"
                          style={{ animation: "lp-check-bounce 0.5s ease-out" }}
                        >
                          <Icon d={PATHS.check} size={12} className="text-white" />
                        </div>
                      ) : (
                        <div
                          className={`h-4 w-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 border border-blue-600 ${
                            phase.status === "in_progress" ? "animate-pulse" : "opacity-60"
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-xl font-bold text-neutral-500 mb-3"
                      style={SYNE}
                    >
                      Step {i + 1}
                    </h3>

                    {isCenterpiece ? (
                      <CenterpiecePhaseCard phase={phase} />
                    ) : (
                      <PhaseCard phase={phase} accent={accent} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Client tasks ─── */}
      <section className="lp-card" style={{ animationDelay: "0.15s" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white" style={SYNE}>
            What we need from you
          </h2>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {tasksDone} of {ob.tasks.length} done
            </span>
            <DuePill ob={ob} />
          </div>
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
      <section
        className="lp-card rounded-2xl p-6 sm:p-8 bg-white/5 border border-white/10"
        style={{ animationDelay: "0.2s" }}
      >
        <h2 className="text-lg font-bold text-white mb-4" style={SYNE}>
          Mission log 📡
        </h2>
        {ob.activity.length === 0 ? (
          <p className="text-sm text-neutral-400">
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
                        ? "#3B82F6"
                        : "#8B5CF6",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug text-neutral-300">
                    {entry.message}
                  </p>
                  <span className="text-[11px] text-neutral-500">
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
        <p className="text-[11px] text-neutral-400">
          Questions? Your Nexli team is one message away.
        </p>
        {data.nexli ? (
          <NexliLegalFooter />
        ) : (
          <p className="text-[10px] text-neutral-400">
            {data.from.company || data.from.name} • Powered by the Digital
            Rainmaker System
          </p>
        )}
      </footer>
    </LaunchPadShell>
  );
}

// ─── Phase cards ───────────────────────────────────────────

function PhaseMeta({ phase, accent }: { phase: PhaseData; accent: Accent }) {
  const a = ACCENT[accent];
  return (
    <>
      {phase.targetDate && phase.status !== "done" && (
        <span className="text-[11px] font-semibold text-neutral-500">
          ETA {formatDate(phase.targetDate)}
        </span>
      )}
      {phase.completedAt && phase.status === "done" && (
        <span className="text-[11px] font-semibold text-neutral-500">
          Finished {formatDate(phase.completedAt)}
        </span>
      )}
      {phase.note && (
        <div className={`w-full mt-3 px-3 py-2 rounded-lg text-xs text-neutral-200 ${a.noteStrip}`}>
          <span className="font-bold text-white">Latest: </span>
          {phase.note}
        </div>
      )}
    </>
  );
}

function FeatureGrid({ features, accent }: { features: string[]; accent: Accent }) {
  const a = ACCENT[accent];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
      {features.map((f) => (
        <div key={f} className="flex items-start gap-2 text-sm">
          <Icon d={PATHS.circleCheck} size={16} className={`${a.check} shrink-0 mt-0.5`} />
          <span className="text-neutral-300 text-[13px]">{f}</span>
        </div>
      ))}
    </div>
  );
}

function PhaseCard({ phase, accent }: { phase: PhaseData; accent: Accent }) {
  const a = ACCENT[accent];
  return (
    <LpCard>
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`p-2 rounded-xl ${a.headerTile}`}>
          <Icon d={PHASE_ICON[phase.id] || PATHS.globe} size={24} className={a.headerIcon} />
        </div>
        <h4 className="text-lg sm:text-xl font-bold text-white flex-1 min-w-0">
          {phase.title}
        </h4>
        <PhasePill status={phase.status} accent={accent} />
      </div>
      <p className="text-sm leading-relaxed text-neutral-300 mt-3">
        {phase.description}
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <PhaseMeta phase={phase} accent={accent} />
      </div>
      {phase.features && <FeatureGrid features={phase.features} accent={accent} />}

      {/* Reputation management — the amber "secret weapon" callout */}
      {phase.id === "automations" && (
        <div className="mt-5 rounded-2xl p-4 sm:p-5 border-2 border-dashed border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20 shrink-0">
              <GoogleGLogo size={20} />
            </div>
            <div>
              <p className="font-bold mb-1 text-yellow-400">
                Reputation Management — Your Secret Weapon
              </p>
              <p className="text-sm text-neutral-300">
                Automatic review requests route your happiest customers straight
                to Google. Most local businesses have 4 to 12 reviews sitting
                there — the ones dominating search have 80 or more. We build
                that engine for you.
              </p>
            </div>
          </div>
        </div>
      )}
    </LpCard>
  );
}

// The portal build-out gets the Rainmaker "Centerpiece" treatment:
// shimmer conic border, cyan-tinted gradient interior, glowing icon.
function CenterpiecePhaseCard({ phase }: { phase: PhaseData }) {
  return (
    <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden p-[1.5px]">
      <span
        className="absolute inset-[-200%] animate-[shimmer_6s_linear_infinite] opacity-90"
        style={{ background: SHIMMER_CONIC }}
      />
      <span
        className="absolute inset-[-200%] animate-[shimmer_6s_linear_infinite] blur-xl opacity-30"
        style={{ background: SHIMMER_CONIC }}
      />
      <div className="relative z-10 rounded-[14px] sm:rounded-[22px] p-5 sm:p-7 bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative shrink-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-500/20 border border-cyan-500/30"
                style={{ filter: "drop-shadow(0 0 20px rgba(6, 182, 212, 0.3))" }}
              >
                <Icon d={PATHS.layoutDashboard} size={26} className="text-cyan-500" />
              </div>
              <span
                className="absolute inset-0 rounded-xl animate-ping opacity-20 bg-cyan-500"
                style={{ animationDuration: "3s" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.15em] uppercase text-cyan-300">
                <Icon d={PATHS.star} size={11} className="text-cyan-400" style={{ fill: "currentColor" }} />
                The Centerpiece
              </span>
              <h4 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                {phase.title}
              </h4>
            </div>
            <PhasePill status={phase.status} accent="cyan" />
          </div>

          <p className="text-sm leading-relaxed text-neutral-300 mt-3">
            {phase.description}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <PhaseMeta phase={phase} accent="cyan" />
          </div>

          {phase.features && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-4">
              {phase.features.map((f) => (
                <div
                  key={f}
                  className="rounded-xl p-3 border bg-white/5 border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300"
                >
                  <Icon d={PATHS.circleCheck} size={16} className="text-cyan-500 mb-1.5" />
                  <p className="text-[11px] sm:text-xs font-semibold text-white/80 leading-snug">
                    {f}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
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
  const accent = TASK_ACCENT[task.id] || "blue";
  const a = ACCENT[accent];
  return (
    <LpCard>
      <div className="flex items-start gap-3">
        <IconChip accent={accent}>
          {task.id === "fb_ads_invite" ? (
            <FacebookLogo size={24} />
          ) : (
            <Icon d={TASK_ICON[task.id] || PATHS.globe} size={24} className={a.icon} />
          )}
        </IconChip>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white">{task.title}</h3>
            <TaskPill task={task} accent={accent} />
          </div>
          <p className="text-xs sm:text-[13px] mt-1 leading-relaxed text-neutral-400">
            {task.description}
          </p>
          {task.adminNote && task.status === "needs_attention" && (
            <div className="mt-2 px-3 py-2 rounded-lg text-xs text-neutral-200 bg-yellow-500/10 border border-yellow-500/25">
              <span className="font-bold text-yellow-400">From your Nexli team: </span>
              {task.adminNote}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        {task.type === "credentials" && (
          <DnsForm task={task} token={token} onSubmitted={onSubmitted} accent={accent} />
        )}
        {task.type === "form" && task.id === "payment_setup" && (
          <PaymentSetupForm task={task} token={token} onSubmitted={onSubmitted} accent={accent} />
        )}
        {task.type === "confirm" && (
          <FbConfirm task={task} token={token} onSubmitted={onSubmitted} accent={accent} />
        )}
        {task.type === "upload" && (
          <LicenseUpload task={task} token={token} onSubmitted={onSubmitted} accent={accent} />
        )}
      </div>
    </LpCard>
  );
}

// ── DNS / registrar credentials form ──

function DnsForm({
  task,
  token,
  onSubmitted,
  accent,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
  accent: Accent;
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
      <SubmittedNote accent={accent}>
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

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Where&apos;s your domain? *</label>
          <select
            value={registrar}
            onChange={(e) => setRegistrar(e.target.value)}
            className="lp-input"
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
          <label className={labelCls}>Login URL (optional)</label>
          <input
            type="url"
            value={loginUrl}
            onChange={(e) => setLoginUrl(e.target.value)}
            placeholder="https://…"
            className="lp-input"
          />
        </div>
        <div>
          <label className={labelCls}>Username / Email *</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@business.com"
            className="lp-input"
            autoComplete="off"
          />
        </div>
        <div>
          <label className={labelCls}>Password *</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="lp-input pr-16"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className={labelCls}>Anything else we should know?</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="2FA codes go to my cell, the account is under my partner's name, etc."
          className="lp-input resize-none"
        />
      </div>

      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={handleSubmit} disabled={submitting} className={CTA_CLASSES}>
          {submitting ? "Sending securely…" : "Send access securely →"}
        </button>
        <div className="flex items-center gap-1.5">
          <Icon d={PATHS.lock} size={14} className="text-emerald-400 shrink-0" />
          <span className="text-[11px] text-neutral-500">
            Sent over an encrypted connection — visible only to your Nexli team
          </span>
        </div>
      </div>
    </div>
  );
}

// ── How you get paid (processor + card / ACH / wire amounts) ──

const CARD_OPTIONS: [CardMode, string][] = [
  ["limit", "Up to an amount"],
  ["any", "Any amount"],
  ["none", "No cards"],
];
const ACH_OPTIONS: [AchMode, string][] = [
  ["any", "Any amount"],
  ["range", "Set amounts"],
  ["none", "No ACH"],
];
const WIRE_OPTIONS: [WireMode, string][] = [
  ["over", "Over an amount"],
  ["any", "Any amount"],
  ["none", "No wires"],
];

/** "2500" → "2,500" once the field loses focus (what's typed stays if it isn't a number). */
const tidyAmount = (v: string) => {
  const n = parseAmount(v);
  return n ? n.toLocaleString("en-US") : v;
};
const amountText = (n: number | null | undefined) => (n ? n.toLocaleString("en-US") : "");

function ChoicePills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([v, text]) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={`min-h-9 px-3.5 rounded-full text-xs font-bold transition-all ${
              on
                ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
                : "bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10"
            }`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

function AmountInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[220px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-400">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onChange(tidyAmount(e.target.value))}
            placeholder={placeholder}
            className="lp-input"
            // Inline: .lp-input's own padding would beat a pl-* utility.
            style={{ paddingLeft: "1.85rem" }}
            autoComplete="off"
          />
        </div>
        {suffix && <span className="text-xs text-neutral-400">{suffix}</span>}
      </div>
    </div>
  );
}

function MethodBox({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-3.5 sm:p-4 bg-white/[0.03] border border-white/10 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-cyan-500/15 border border-cyan-500/25">
          <Icon d={icon} size={18} className="text-cyan-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** What the firm told us, read back (submitted state). */
function PaymentSummary({ p }: { p: PaymentSetup }) {
  const rows: [string, string][] = [
    ["Processor", processorName(p)],
    ["Cards", cardLine(p)],
    ["ACH", achLine(p)],
    ["Wire", wireLine(p)],
  ];
  return (
    <div className="rounded-xl px-4 py-3 bg-white/5 border border-white/10">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 sm:block">
            <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">{k}</dt>
            <dd className="text-[13px] font-semibold text-white sm:mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>
      {p.notes && <p className="text-xs text-neutral-400 mt-3 leading-relaxed">“{p.notes}”</p>}
    </div>
  );
}

function PaymentSetupForm({
  task,
  token,
  onSubmitted,
  accent,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
  accent: Accent;
}) {
  // Sent back (needs attention): start from what they told us last time.
  const saved = asPaymentSetup(task.submission);
  const [processor, setProcessor] = useState(saved?.processor ?? "");
  const [processorOther, setProcessorOther] = useState(saved?.processorOther ?? "");
  const [cardMode, setCardMode] = useState<CardMode>(saved?.card.mode ?? "limit");
  const [cardMax, setCardMax] = useState(amountText(saved?.card.max));
  const [achMode, setAchMode] = useState<AchMode>(saved?.ach.mode ?? "any");
  const [achMin, setAchMin] = useState(amountText(saved?.ach.min));
  const [achMax, setAchMax] = useState(amountText(saved?.ach.max));
  const [wireMode, setWireMode] = useState<WireMode>(saved?.wire.mode ?? "over");
  const [wireMin, setWireMin] = useState(amountText(saved?.wire.min));
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState<PaymentSetup | null>(null);

  const done = Boolean(justSent) || task.status === "submitted" || task.status === "approved";
  if (done) {
    const answers = justSent ?? saved;
    if (!answers) {
      // Onboardings from before this question: the Stripe login stands in.
      return (
        <SubmittedNote accent={accent}>
          You already sent us your Stripe login — we&apos;re all set here.
        </SubmittedNote>
      );
    }
    return (
      <div className="space-y-3">
        <SubmittedNote accent={accent}>
          Got it — we&apos;ll check what {processorName(answers)} connects to and
          set up your invoicing around these amounts.
        </SubmittedNote>
        <PaymentSummary p={answers} />
      </div>
    );
  }

  const payload = {
    processor,
    processorOther,
    card: { mode: cardMode, max: cardMax },
    ach: { mode: achMode, min: achMin, max: achMax },
    wire: { mode: wireMode, min: wireMin },
    notes,
  };
  // Live check for amounts no method would cover (only once each amount is filled in).
  const draft = cleanPaymentSetup({ ...payload, processor: processor || NO_PROCESSOR, processorOther: processorOther || "—" });
  const gaps = draft.ok ? coverageGaps(draft.value) : [];

  async function handleSubmit() {
    const checked = cleanPaymentSetup(payload);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: "payment_setup", submission: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setJustSent(checked.value);
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Who processes payments */}
      <div className="space-y-2">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Who processes your payments today? *</label>
            <select value={processor} onChange={(e) => setProcessor(e.target.value)} className="lp-input">
              <option value="">Select your processor…</option>
              {PROCESSORS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value={OTHER_PROCESSOR}>Other</option>
              <option value={NO_PROCESSOR}>{NO_PROCESSOR}</option>
            </select>
          </div>
          {processor === OTHER_PROCESSOR && (
            <div>
              <label className={labelCls}>Which one? *</label>
              <input
                type="text"
                value={processorOther}
                onChange={(e) => setProcessorOther(e.target.value)}
                placeholder="e.g. Heartland, Payroll, Chase"
                className="lp-input"
                autoComplete="off"
              />
            </div>
          )}
        </div>
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          Not sure? It&apos;s whoever runs your card payments today — often your
          accounting software or your bank. We&apos;ll check whether it connects
          to your new portal so clients can pay invoices right there.
        </p>
      </div>

      {/* Card / ACH / wire */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-2">
          How should clients pay each invoice?
        </p>
        <div className="space-y-3">
          <MethodBox
            icon={PATHS.creditCard}
            title="Credit & debit cards"
            sub="Quickest for clients to pay, but card fees come out of what you collect."
          >
            <ChoicePills label="Card payments" options={CARD_OPTIONS} value={cardMode} onChange={setCardMode} />
            {cardMode === "limit" && (
              <AmountInput
                label="Most you'll take by card *"
                value={cardMax}
                onChange={setCardMax}
                placeholder="2,500"
                suffix="per invoice"
              />
            )}
          </MethodBox>

          <MethodBox
            icon={PATHS.landmark}
            title="ACH bank transfer"
            sub="Low fees, straight from your client's bank account. Takes a few business days to clear."
          >
            <ChoicePills label="ACH payments" options={ACH_OPTIONS} value={achMode} onChange={setAchMode} />
            {achMode === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <AmountInput label="From" value={achMin} onChange={setAchMin} placeholder="0" />
                <AmountInput label="Up to" value={achMax} onChange={setAchMax} placeholder="No limit" />
              </div>
            )}
          </MethodBox>

          <MethodBox
            icon={PATHS.arrowLeftRight}
            title="Wire transfer"
            sub="For your biggest invoices: same-day, and the bank charges a flat fee instead of a percentage."
          >
            <ChoicePills label="Wire payments" options={WIRE_OPTIONS} value={wireMode} onChange={setWireMode} />
            {wireMode === "over" && (
              <AmountInput label="Wire for invoices over *" value={wireMin} onChange={setWireMin} placeholder="25,000" />
            )}
          </MethodBox>
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="rounded-xl px-4 py-3 bg-amber-500/10 border border-amber-500/25">
          <p className="text-xs text-neutral-200 leading-relaxed">
            <span className="font-bold text-amber-300">Heads up: </span>
            invoices {gaps.map(gapLine).join(" and ")} wouldn&apos;t have a way to
            pay. Change an amount above, or tell us below how you handle them.
          </p>
        </div>
      )}

      <div>
        <label className={labelCls}>Anything else we should know?</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="We add a 3% card fee, retainers always go by ACH, etc."
          className="lp-input resize-none"
        />
      </div>

      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={handleSubmit} disabled={submitting} className={CTA_CLASSES}>
          {submitting ? "Sending…" : "Send how I get paid →"}
        </button>
        <div className="flex items-center gap-1.5">
          <Icon d={PATHS.lock} size={14} className="text-emerald-400 shrink-0" />
          <span className="text-[11px] text-neutral-500">
            Only your Nexli team sees this — no logins or card numbers needed
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
  accent,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
  accent: Accent;
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
      <SubmittedNote accent={accent}>
        No problem — we&apos;ve marked this one as not applicable.
      </SubmittedNote>
    ) : (
      <SubmittedNote accent={accent}>
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
      <ol className="text-xs sm:text-[13px] space-y-1.5 pl-4 list-decimal leading-relaxed text-neutral-400">
        <li>
          Open{" "}
          <span className="font-semibold text-white">
            Meta Business Settings → Partners
          </span>
        </li>
        <li>
          Click{" "}
          <span className="font-semibold text-white">
            Add → Give a partner access to your assets
          </span>
        </li>
        <li>
          Enter our Business ID (from your welcome email) and grant access to
          your ad account
        </li>
      </ol>

      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => submit(false)}
          disabled={submitting}
          className={CTA_CLASSES}
        >
          I sent the invite ✓
        </button>
        <button
          onClick={() => submit(true)}
          disabled={submitting}
          className={SECONDARY_BTN}
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
  accent,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
  accent: Accent;
}) {
  const done = task.status === "submitted" || task.status === "approved";

  if (done) {
    return (
      <SubmittedNote accent={accent}>
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
        className={`w-full rounded-xl p-4 text-center transition-all active:scale-[0.99] disabled:opacity-60 ${
          uploadedName
            ? "bg-amber-500/10 border border-amber-500/30"
            : "bg-white/5 border-2 border-dashed border-white/15 hover:border-amber-500/40"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-neutral-400">Uploading…</span>
          </div>
        ) : uploadedName ? (
          <div className="flex flex-col items-center gap-1 py-1">
            <Icon d={PATHS.circleCheck} size={20} className="text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              {side} uploaded
            </span>
            <span className="text-xs font-semibold text-white truncate max-w-full">
              {uploadedName}
            </span>
            <span className="text-[10px] text-neutral-500">Tap to replace</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Icon d={PATHS.idCard} size={20} className="text-amber-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
              License {side}
            </span>
            <span className="text-[11px] text-neutral-500">
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
        <p className="text-xs font-semibold mt-1.5 text-rose-400">{error}</p>
      )}
    </div>
  );
}
