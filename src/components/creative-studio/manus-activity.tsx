"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { ManusActivitySnapshot } from "@/lib/creative-studio/tables";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { SP, SvgIcon } from "@/components/creative-studio/canvas";

type ManusTask = ProjectDetail["manus"][number];
type FeedItem = ManusActivitySnapshot["feed"][number];

export function toolIcon(tool: string | null): React.ReactNode {
  const t = (tool ?? "").toLowerCase();
  if (/browser|web|url|page/.test(t)) return SP.globe;
  if (/code|shell|terminal|python|exec|command/.test(t)) return SP.terminal;
  if (/image|draw|generat|render|picture|photo/.test(t)) return SP.image;
  if (/search/.test(t)) return SP.search;
  if (/file|read|write|edit|save/.test(t)) return SP.file;
  return SP.sparkles;
}

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
}

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Manus at work — the studio's version of watching a Manus task: what it's
 * doing right now, its plan with live progress, the tools it's using and what
 * it says, while placeholders wait for the frames. Questions and approvals
 * appear inline when Manus pauses.
 */
export function ManusActivity({
  projectId,
  task,
  aspect,
  onChange,
  onError,
  onRetry,
}: {
  projectId: string;
  task: ManusTask;
  aspect: string;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
  onRetry: (shot: string) => void;
}) {
  const a = task.activity;
  const waiting = task.status === "waiting" && task.waiting;
  const failed = task.status === "failed";
  const [now, setNow] = useState(() => Date.now());
  const stream = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (failed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [failed]);

  const feedLen = a?.feed.length ?? 0;
  useEffect(() => {
    const el = stream.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [feedLen]);

  if (failed) {
    return (
      <div className="lp-card flex flex-wrap items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-300">
          <SvgIcon d={SP.x} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rose-100">Manus didn&apos;t finish the frames</p>
          <p className="truncate text-xs text-rose-200/80">{task.error ?? "It stopped before returning images."}</p>
        </div>
        {task.shot && (
          <button type="button" onClick={() => onRetry(task.shot)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">
            Try again
          </button>
        )}
      </div>
    );
  }

  const started = a?.startedAt ?? new Date(task.startedAt).getTime();
  const plan = a?.plan ?? [];
  const doneSteps = plan.filter((s) => s.status === "done").length;
  const lastTool = [...(a?.feed ?? [])].reverse().find((f) => f.kind === "tool");
  const nowLine = waiting ? "Waiting for your answer" : a?.now || lastTool?.title || "Reading your brief and the reference photos…";
  const accent = waiting ? "amber" : "blue";

  return (
    <div className="lp-card flex gap-3">
      {/* Avatar */}
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          waiting ? "border-amber-500/30 bg-amber-500/15 text-amber-300" : "border-blue-500/30 bg-blue-500/20 text-blue-300"
        }`}
        style={waiting ? undefined : { animation: "cs-pulse-ring 2s infinite" }}
      >
        <SvgIcon d={SP.sparkles} size={18} />
      </div>

      <div className={`min-w-0 flex-1 overflow-hidden rounded-2xl border bg-white/[0.04] ${waiting ? "border-amber-500/30" : "border-white/10"}`}>
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-3 sm:px-5">
          <h2 className="text-[15px] font-bold text-white" style={SYNE}>
            Manus is creating the frames
          </h2>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs tabular-nums text-neutral-500" style={NUM_FONT}>
              {clock(now - started)}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                waiting ? "border-amber-500/30 bg-amber-500/15 text-amber-200" : "border-blue-500/30 bg-blue-500/15 text-blue-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${waiting ? "bg-amber-300" : "animate-pulse bg-blue-300"}`} />
              {waiting ? "Waiting on you" : "Working"}
            </span>
          </span>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          {task.shot && <p className="border-l-2 border-white/15 pl-3 text-xs italic text-neutral-400">“{task.shot}”</p>}

          {/* Now */}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3.5 py-3">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${waiting ? "bg-amber-500/15 text-amber-300" : "bg-cyan-500/15 text-cyan-300"}`}>
              <SvgIcon d={waiting ? SP.sparkles : toolIcon(lastTool?.tool ?? null)} size={15} />
            </span>
            <p className={`min-w-0 flex-1 truncate text-sm font-semibold ${waiting ? "text-amber-100" : "cs-shimmer-text"}`}>{nowLine}</p>
          </div>

          {/* Plan */}
          {plan.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Plan</span>
                <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
                  {doneSteps} of {plan.length} steps
                </span>
              </div>
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 transition-all duration-700"
                  style={{ width: `${Math.max(4, (doneSteps / plan.length) * 100)}%` }}
                />
              </div>
              <ol className="space-y-1.5">
                {plan.map((step, i) => (
                  <li key={`${step.title}-${i}`} className="flex items-start gap-2.5">
                    <StepDot status={step.status} />
                    <span
                      className={`min-w-0 flex-1 text-[13px] leading-snug ${
                        step.status === "done"
                          ? "text-neutral-400"
                          : step.status === "doing"
                            ? "cs-shimmer-text font-semibold"
                            : step.status === "failed"
                              ? "text-rose-300"
                              : "text-neutral-500"
                      }`}
                    >
                      {step.title}
                    </span>
                    {step.status === "done" && step.startedAt && step.endAt && (
                      <span className="shrink-0 text-[10px] text-neutral-600" style={NUM_FONT}>
                        {Math.max(1, Math.round((step.endAt - step.startedAt) / 1000))}s
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Activity stream */}
          {a && a.feed.length > 0 && (
            <div>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Activity</span>
              <div ref={stream} className="cs-scroll max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {a.feed.map((item, i) => (
                  <FeedRow key={item.id} item={item} now={now} latest={i === a.feed.length - 1 && !waiting} />
                ))}
              </div>
            </div>
          )}

          {/* Placeholders for the frames: two options, or one per scene of a storyboard */}
          {!waiting && (
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: (task.scenes?.length ?? 0) > 1 ? task.scenes.length : 2 }, (_, i) => i + 1).map((n) => (
                <div key={n} className="cs-sweep w-24 rounded-xl border border-white/10 bg-white/[0.03] sm:w-28" style={{ aspectRatio: aspect }}>
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 text-neutral-600">
                    <SvgIcon d={SP.image} size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{(task.scenes?.length ?? 0) > 1 ? "Scene" : "Image"} {n}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {waiting && <WaitingPanel projectId={projectId} task={task} onChange={onChange} onError={onError} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-2.5 text-[11px] sm:px-5">
          {task.taskUrl ? (
            <a href={task.taskUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-neutral-400 hover:text-white">
              Open in Manus <SvgIcon d={SP.external} size={12} />
            </a>
          ) : (
            <span className="text-neutral-600">Updates every few seconds</span>
          )}
          <CancelButton projectId={projectId} taskId={task.id} accent={accent} onChange={onChange} onError={onError} />
        </div>
      </div>
    </div>
  );
}

export function StepDot({ status }: { status: "todo" | "doing" | "done" | "failed" }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white" style={{ animation: "lp-check-bounce 0.5s ease-out both" }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (status === "doing") {
    return (
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="absolute h-4 w-4 animate-ping rounded-full bg-cyan-400/30" />
        <span className="h-2 w-2 rounded-full bg-gradient-to-br from-blue-400 to-cyan-300" />
      </span>
    );
  }
  if (status === "failed") return <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-bold text-rose-400">✕</span>;
  return <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-white/20" />;
}

export function FeedRow({ item, now, latest }: { item: FeedItem; now: number; latest: boolean }) {
  if (item.kind === "explanation" || item.kind === "message") {
    return (
      <div className="lp-card flex gap-2">
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/70" />
        <p className="rounded-xl rounded-tl-sm border border-violet-500/15 bg-violet-500/[0.07] px-3 py-1.5 text-xs leading-relaxed text-violet-100/90">{item.title}</p>
      </div>
    );
  }
  return (
    <div className="lp-card group flex items-start gap-2.5 rounded-lg px-1.5 py-1 hover:bg-white/[0.03]">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${item.kind === "step" ? "bg-blue-500/15 text-blue-300" : "bg-white/5 text-neutral-400"}`}>
        <SvgIcon d={item.kind === "step" ? SP.script : toolIcon(item.tool)} size={12} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs ${latest ? "cs-shimmer-text font-semibold" : "text-neutral-300"}`}>
          {item.kind === "step" ? `New step: ${item.title}` : item.title}
        </p>
        {item.detail && <p className="truncate text-[11px] text-neutral-400 [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:block">{item.detail}</p>}
      </div>
      {item.status === "error" && <span className="text-[10px] font-bold text-rose-400">error</span>}
      <span className="shrink-0 text-[10px] text-neutral-600" style={NUM_FONT}>
        {ago(item.at, now)}
      </span>
    </div>
  );
}

function WaitingPanel({
  projectId,
  task,
  onChange,
  onError,
}: {
  projectId: string;
  task: ManusTask;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const w = task.waiting!;

  async function respond(body: Record<string, unknown>) {
    setBusy(true);
    const r = await send(api(`${projectId}/frame/reply`), "POST", { taskId: task.id, ...body });
    setBusy(false);
    if (r.ok) {
      onChange(r.data);
      setAnswer("");
    } else onError(r.error);
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/90">{w.kind === "confirm" ? "Manus wants your OK" : "Manus asks"}</p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-amber-50">{w.prompt}</p>
      {w.kind === "confirm" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => respond({ allow: true })} disabled={busy} className={CTA_CLASSES}>
            Allow
          </button>
          <button type="button" onClick={() => respond({ cancel: true })} disabled={busy} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/5">
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {w.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {w.options.map((o) => (
                <button key={o} type="button" onClick={() => respond({ answer: o })} disabled={busy} className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20">
                  {o}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && answer.trim() && !busy && respond({ answer })}
              placeholder="Answer Manus…"
              className="lp-input !rounded-full !px-4"
              autoFocus
            />
            <button type="button" onClick={() => respond({ answer })} disabled={busy || !answer.trim()} className={`${CTA_CLASSES} shrink-0 !py-2`}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CancelButton({
  projectId,
  taskId,
  accent,
  onChange,
  onError,
}: {
  projectId: string;
  taskId: string;
  accent: "blue" | "amber";
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Stop this Manus task?")) return;
        setBusy(true);
        const r = await send(api(`${projectId}/frame/reply`), "POST", { taskId, cancel: true });
        setBusy(false);
        if (r.ok) onChange(r.data);
        else onError(r.error);
      }}
      className={`font-semibold ${accent === "amber" ? "text-amber-300/70 hover:text-amber-200" : "text-neutral-500 hover:text-white"}`}
    >
      {busy ? "Stopping…" : "Cancel"}
    </button>
  );
}
