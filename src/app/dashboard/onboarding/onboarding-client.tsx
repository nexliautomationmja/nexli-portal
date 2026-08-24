"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { RocketIcon, CopyIcon, XIcon } from "@/components/ui/icons";

// ─── Types ─────────────────────────────────────────────────

interface RawPhaseState {
  status: "pending" | "in_progress" | "done";
}

interface RawTaskState {
  status: "todo" | "submitted" | "approved" | "needs_attention";
}

interface RawOnboardingState {
  phases?: Record<string, RawPhaseState>;
  tasks?: Record<string, RawTaskState>;
  targetLaunchDate?: string | null;
}

interface EngagementRow {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  metadata?: { onboarding?: RawOnboardingState } | null;
  signers: {
    id: string;
    name: string;
    email: string;
    order: number;
    status: string;
    signedAt?: string | null;
  }[];
}

interface AdminPhase {
  id: string;
  title: string;
  emoji: string;
  description: string;
  status: "pending" | "in_progress" | "done";
  targetDate: string | null;
  note: string | null;
}

interface AdminTask {
  id: string;
  title: string;
  emoji: string;
  type: "credentials" | "confirm" | "upload";
  optional: boolean;
  status: "todo" | "submitted" | "approved" | "needs_attention";
  submittedAt: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  submission: unknown;
}

interface AdminDetail {
  engagementId: string;
  subject: string;
  onboarding: {
    startedAt: string;
    targetLaunchDate: string | null;
    progressPercent: number;
    phases: AdminPhase[];
    tasks: AdminTask[];
    activity: { at: string; actor: string; type: string; message: string }[];
  };
  clientSigners: { id: string; name: string; email: string; token: string; order: number }[];
}

// ─── Helpers ───────────────────────────────────────────────

function clientNameFor(eng: EngagementRow): string {
  const client = eng.signers.find((s) => s.order > 0);
  return client?.name || "Unknown client";
}

function roughProgress(state: RawOnboardingState): {
  phasesDone: number;
  phaseCount: number;
  pendingReview: number;
} {
  const phases = Object.values(state.phases || {});
  const tasks = Object.values(state.tasks || {});
  return {
    phasesDone: phases.filter((p) => p.status === "done").length,
    phaseCount: phases.length,
    pendingReview: tasks.filter((t) => t.status === "submitted").length,
  };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main ──────────────────────────────────────────────────

export function OnboardingDashboardClient() {
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/engagements");
      if (res.ok) {
        const body = await res.json();
        setEngagements(body.engagements || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const active = engagements.filter((e) => e.metadata?.onboarding);
  const startable = engagements.filter(
    (e) => e.status === "signed" && !e.metadata?.onboarding
  );

  async function startOnboarding(engagementId: string) {
    setStarting(engagementId);
    try {
      const res = await fetch(
        `/api/dashboard/engagements/${engagementId}/onboarding`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setToast(body.error || "Failed to start onboarding");
        return;
      }
      await load();
      setDetailId(engagementId);
      setToast("Onboarding started 🚀");
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
            Onboarding
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Client Launch Pads — track build-outs and review submitted items
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ─── Active launch pads ─── */}
          <section>
            <p className="section-header">Active Launch Pads</p>
            {active.length === 0 ? (
              <GlassCard>
                <div className="empty-state py-8">
                  <RocketIcon className="empty-state-icon" />
                  <p className="text-sm font-medium">No active onboardings yet</p>
                  <p className="text-xs mt-1">
                    Start one from a signed engagement below.
                  </p>
                </div>
              </GlassCard>
            ) : (
              <div className="space-y-3">
                {active.map((eng) => {
                  const state = eng.metadata!.onboarding!;
                  const { phasesDone, phaseCount, pendingReview } =
                    roughProgress(state);
                  return (
                    <button
                      key={eng.id}
                      onClick={() => setDetailId(eng.id)}
                      className="glass-card w-full p-5 text-left hover:border-blue-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-sm font-bold"
                              style={{ color: "var(--text-main)" }}
                            >
                              {clientNameFor(eng)}
                            </span>
                            {pendingReview > 0 && (
                              <span className="badge badge-amber">
                                {pendingReview} to review
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs mt-0.5 truncate"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {eng.subject}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span
                              className="text-[10px] font-black uppercase tracking-[0.15em] block"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Launch
                            </span>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: "var(--text-main)" }}
                            >
                              {formatDate(state.targetLaunchDate)}
                            </span>
                          </div>
                          <div className="w-28">
                            <div className="flex justify-between mb-1">
                              <span
                                className="text-[10px] font-bold"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {phasesDone}/{phaseCount} phases
                              </span>
                            </div>
                            <div
                              className="h-1.5 rounded-full overflow-hidden"
                              style={{ background: "var(--input-bg)" }}
                            >
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-700"
                                style={{
                                  width: `${
                                    phaseCount
                                      ? Math.round((phasesDone / phaseCount) * 100)
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ─── Signed, not yet started ─── */}
          {startable.length > 0 && (
            <section>
              <p className="section-header">Signed — Ready to Onboard</p>
              <div className="space-y-3">
                {startable.map((eng) => (
                  <GlassCard key={eng.id} className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                        {clientNameFor(eng)}
                      </span>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                        {eng.subject}
                      </p>
                    </div>
                    <button
                      onClick={() => startOnboarding(eng.id)}
                      disabled={starting === eng.id}
                      className="px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
                      style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                    >
                      {starting === eng.id ? "Starting…" : "Start Onboarding 🚀"}
                    </button>
                  </GlassCard>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ─── Detail slide-over ─── */}
      {detailId && (
        <OnboardingDetail
          engagementId={detailId}
          onClose={() => {
            setDetailId(null);
            load();
          }}
          onToast={setToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] px-4 py-2.5 rounded-full text-sm font-semibold text-white shadow-xl"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Detail slide-over ─────────────────────────────────────

function OnboardingDetail({
  engagementId,
  onClose,
  onToast,
}: {
  engagementId: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateMsg, setUpdateMsg] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dashboard/engagements/${engagementId}/onboarding`);
    if (res.ok) setDetail(await res.json());
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(
        `/api/dashboard/engagements/${engagementId}/onboarding`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        setDetail(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        onToast(err.error || "Update failed");
      }
    },
    [engagementId, onToast]
  );

  function copyClientLink(token: string) {
    const url = `${window.location.origin}/onboarding/${token}`;
    navigator.clipboard.writeText(url);
    onToast("Client link copied 📋");
  }

  const ob = detail?.onboarding;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[70]" onClick={onClose} />
      <div
        className="fixed top-0 right-0 h-full w-full sm:w-[560px] z-[80] overflow-y-auto animate-slideInRight"
        style={{ background: "var(--bg-main)", borderLeft: "1px solid var(--card-border)" }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{
            background: "var(--nav-bg)",
            borderBottom: "1px solid var(--card-border)",
          }}
        >
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: "var(--text-main)" }}>
              {detail ? detail.clientSigners[0]?.name || detail.subject : "Loading…"}
            </h2>
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
              Launch Pad management
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--input-bg)] transition-colors shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {loading || !detail || !ob ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Progress + client links */}
            <GlassCard className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="stat-label">Overall progress</span>
                <span className="stat-value text-xl">{ob.progressPercent}%</span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "var(--input-bg)" }}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-700"
                  style={{ width: `${ob.progressPercent}%` }}
                />
              </div>
              {detail.clientSigners.map((s) => (
                <button
                  key={s.id}
                  onClick={() => copyClientLink(s.token)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors hover:border-blue-500/40"
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--card-border)",
                    color: "var(--text-main)",
                  }}
                >
                  <span className="truncate">
                    Copy Launch Pad link — {s.name}
                  </span>
                  <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
                    <CopyIcon className="w-4 h-4" />
                  </span>
                </button>
              ))}
              <div>
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Estimated launch date (shown to client)
                </label>
                <input
                  type="date"
                  defaultValue={ob.targetLaunchDate || ""}
                  onChange={(e) =>
                    patch({
                      action: "set_launch_date",
                      targetLaunchDate: e.target.value || null,
                    })
                  }
                  className="glass-input"
                />
              </div>
            </GlassCard>

            {/* Phases */}
            <section>
              <p className="section-header">Build Phases</p>
              <div className="space-y-3">
                {ob.phases.map((phase) => (
                  <GlassCard key={phase.id} variant="compact" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                        {phase.emoji} {phase.title}
                      </span>
                      <select
                        value={phase.status}
                        onChange={(e) =>
                          patch({
                            action: "set_phase",
                            phaseId: phase.id,
                            status: e.target.value,
                          })
                        }
                        className="glass-input w-auto! py-1.5! px-3! text-xs font-semibold"
                      >
                        <option value="pending">Queued</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          className="block text-[10px] font-black uppercase tracking-[0.15em] mb-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Target date
                        </label>
                        <input
                          type="date"
                          defaultValue={phase.targetDate || ""}
                          onChange={(e) =>
                            patch({
                              action: "set_phase",
                              phaseId: phase.id,
                              targetDate: e.target.value || null,
                            })
                          }
                          className="glass-input py-1.5!"
                        />
                      </div>
                      <div>
                        <label
                          className="block text-[10px] font-black uppercase tracking-[0.15em] mb-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Client-visible note
                        </label>
                        <input
                          type="text"
                          defaultValue={phase.note || ""}
                          placeholder="Homepage draft in review…"
                          onBlur={(e) => {
                            if ((phase.note || "") !== e.target.value.trim()) {
                              patch({
                                action: "set_phase",
                                phaseId: phase.id,
                                note: e.target.value.trim(),
                              });
                            }
                          }}
                          className="glass-input py-1.5!"
                        />
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </section>

            {/* Client tasks */}
            <section>
              <p className="section-header">Client Items</p>
              <div className="space-y-3">
                {ob.tasks.map((task) => (
                  <AdminTaskCard key={task.id} task={task} patch={patch} onToast={onToast} />
                ))}
              </div>
            </section>

            {/* Post update */}
            <section>
              <p className="section-header">Post an Update (client sees this)</p>
              <GlassCard variant="compact" className="space-y-2">
                <textarea
                  value={updateMsg}
                  onChange={(e) => setUpdateMsg(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Your homepage design is looking sharp — first preview coming Friday! 🎨"
                  className="glass-input resize-none"
                />
                <button
                  onClick={async () => {
                    if (!updateMsg.trim()) return;
                    setPosting(true);
                    await patch({ action: "post_update", message: updateMsg.trim() });
                    setUpdateMsg("");
                    setPosting(false);
                    onToast("Update posted 📡");
                  }}
                  disabled={posting || !updateMsg.trim()}
                  className="px-5 py-2 rounded-full text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                >
                  {posting ? "Posting…" : "Post to Mission Log"}
                </button>
              </GlassCard>
            </section>

            {/* Activity */}
            <section>
              <p className="section-header">Mission Log</p>
              <GlassCard variant="compact">
                {ob.activity.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    No activity yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {[...ob.activity].reverse().map((entry, i) => (
                      <div key={`${entry.at}-${i}`} className="flex gap-2.5 items-start">
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                          style={{
                            background:
                              entry.actor === "client"
                                ? "#06B6D4"
                                : entry.actor === "agency"
                                ? "#2563EB"
                                : "#10B981",
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs leading-snug" style={{ color: "var(--text-main)" }}>
                            {entry.message}
                          </p>
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {formatDate(entry.at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Task review card ──────────────────────────────────────

const TASK_STATUS_BADGE: Record<AdminTask["status"], { label: string; cls: string }> = {
  todo: { label: "Waiting on client", cls: "badge-gray" },
  submitted: { label: "Needs review", cls: "badge-amber" },
  approved: { label: "Approved", cls: "badge-emerald" },
  needs_attention: { label: "Sent back", cls: "badge-rose" },
};

function AdminTaskCard({
  task,
  patch,
  onToast,
}: {
  task: AdminTask;
  patch: (body: Record<string, unknown>) => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);
  const badge = TASK_STATUS_BADGE[task.status];

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value);
    onToast(`${label} copied 📋`);
  }

  const creds =
    task.type === "credentials"
      ? (task.submission as {
          registrar?: string;
          loginUrl?: string;
          username?: string;
          password?: string;
          notes?: string;
        } | null)
      : null;

  const confirmSub =
    task.type === "confirm"
      ? (task.submission as { confirmed?: boolean; notApplicable?: boolean } | null)
      : null;

  const files =
    task.type === "upload"
      ? (task.submission as {
          files?: Record<
            string,
            { fileName: string; signedUrl: string | null; mimeType: string } | null
          >;
        } | null)?.files
      : null;

  return (
    <GlassCard variant="compact" className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
          {task.emoji} {task.title}
        </span>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </div>

      {/* Submission detail */}
      {task.status !== "todo" && (
        <div
          className="rounded-lg p-3 space-y-2 text-xs"
          style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)" }}
        >
          {task.type === "credentials" && !creds && (
            <p style={{ color: "var(--text-muted)" }}>
              Submission couldn&apos;t be read (missing or invalid encryption
              key). Ask the client to resubmit, or check
              ONBOARDING_ENCRYPTION_KEY in Vercel.
            </p>
          )}
          {creds && (
            <>
              {[
                ["Registrar", creds.registrar],
                ["Login URL", creds.loginUrl],
                ["Username", creds.username],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span style={{ color: "var(--text-muted)" }}>{label}</span>
                    <button
                      onClick={() => copy(value!, label!)}
                      className="font-semibold truncate max-w-[60%] hover:text-blue-400"
                      style={{ color: "var(--text-main)" }}
                      title="Click to copy"
                    >
                      {value}
                    </button>
                  </div>
                ))}
              {creds.password && (
                <div className="flex items-center justify-between gap-2">
                  <span style={{ color: "var(--text-muted)" }}>Password</span>
                  <span className="flex items-center gap-2">
                    <button
                      onClick={() => copy(creds.password!, "Password")}
                      className="font-mono font-semibold hover:text-blue-400"
                      style={{ color: "var(--text-main)" }}
                      title="Click to copy"
                    >
                      {revealPassword ? creds.password : "••••••••"}
                    </button>
                    <button
                      onClick={() => setRevealPassword((s) => !s)}
                      className="text-[10px] font-bold uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {revealPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </div>
              )}
              {creds.notes && (
                <p style={{ color: "var(--text-muted)" }}>
                  <span className="font-bold">Notes: </span>
                  {creds.notes}
                </p>
              )}
            </>
          )}

          {confirmSub &&
            (confirmSub.notApplicable ? (
              <p style={{ color: "var(--text-muted)" }}>
                Client doesn&apos;t run Facebook Ads — marked not applicable.
              </p>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>
                Client confirmed the partner invite was sent — check Business
                Manager to accept it.
              </p>
            ))}

          {files && (
            <div className="grid grid-cols-2 gap-2">
              {(["front", "back"] as const).map((side) => {
                const f = files[side];
                return (
                  <div key={side} className="text-center">
                    <span
                      className="block text-[10px] font-black uppercase tracking-[0.15em] mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {side}
                    </span>
                    {f?.signedUrl ? (
                      <a href={f.signedUrl} target="_blank" rel="noreferrer" className="block">
                        {f.mimeType === "application/pdf" ? (
                          <span
                            className="block py-4 rounded-md text-xs font-semibold"
                            style={{
                              border: "1px solid var(--card-border)",
                              color: "var(--text-main)",
                            }}
                          >
                            📄 {f.fileName}
                          </span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={f.signedUrl}
                            alt={`License ${side}`}
                            className="w-full h-24 object-cover rounded-md"
                            style={{ border: "1px solid var(--card-border)" }}
                          />
                        )}
                      </a>
                    ) : (
                      <span
                        className="block py-4 rounded-md text-xs"
                        style={{
                          border: "1px dashed var(--card-border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        Not uploaded
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Review actions */}
      {(task.status === "submitted" || task.status === "needs_attention") && (
        <div className="space-y-2">
          {showNote && (
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="What should the client fix? (they'll see this)"
              className="glass-input py-2! text-xs"
              autoFocus
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => patch({ action: "review_task", taskId: task.id, status: "approved" })}
              className="px-4 py-2 rounded-full text-xs font-bold text-white transition-all active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #10B981, #06B6D4)" }}
            >
              Approve ✓
            </button>
            {showNote ? (
              <button
                onClick={() => {
                  patch({
                    action: "review_task",
                    taskId: task.id,
                    status: "needs_attention",
                    adminNote: note.trim(),
                  });
                  setShowNote(false);
                  setNote("");
                }}
                disabled={!note.trim()}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Send back with note
              </button>
            ) : (
              <button
                onClick={() => setShowNote(true)}
                className="px-4 py-2 rounded-full text-xs font-semibold transition-colors"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--card-border)",
                }}
              >
                Needs attention
              </button>
            )}
          </div>
        </div>
      )}

      {task.adminNote && task.status === "needs_attention" && (
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Note sent to client: &ldquo;{task.adminNote}&rdquo;
        </p>
      )}
    </GlassCard>
  );
}
