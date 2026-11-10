"use client";

import { useEffect, useRef, useState } from "react";
import { CTA_CLASSES, SECONDARY_BTN, SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { SP, SvgIcon } from "@/components/creative-studio/canvas";
import { FeedRow, StepDot, toolIcon } from "@/components/creative-studio/manus-activity";
import { money } from "@/lib/ads/format";
import type { AnalysisSummaryRow, AnalysisView, StepView } from "@/lib/ads/analysis-service";
import type { ResearchSummaryRow, ResearchView } from "@/lib/ads/research-service";
import type { AdSettingsView } from "@/lib/ads/settings";
import type { ParsedEvidence } from "@/lib/ads/parse";
import { EvidenceChips, ScoreRing, VerdictPill, when } from "@/components/ads/analysis-bits";
import { Glass, Ico } from "@/components/ads/parts";

/** The words on the live / waiting panels (the analysis or Ad Library research). */
export interface RunCopy {
  title: string;
  gathering: string;
  reading: string;
  saving: string;
  eta: string;
  confirmNote: string;
  stopLabel: string;
}

export const ANALYSIS_COPY: RunCopy = {
  title: "Manus is analyzing the ad account",
  gathering: "Gathering the whole account — Meta, GoHighLevel and the history",
  reading: "Reading the data pack and the playbook…",
  saving: "Saving the analysis and the next steps",
  eta: "Usually 5–15 minutes. You can leave this page — the ready email comes to mail@nexli.net.",
  confirmNote: "Only allow it if it just reads data. The analysis is advise-only — nothing in Meta should change.",
  stopLabel: "Stop the analysis",
};

export const RESEARCH_COPY: RunCopy = {
  title: "Manus is researching the Ad Library",
  gathering: "Packing up your top creatives, results and competitors to check",
  reading: "Reading the research pack and the playbook…",
  saving: "Saving the ads, screenshots and briefs",
  eta: "Usually 20–45 minutes while Manus browses the Ad Library. You can leave this page — the ready email comes to mail@nexli.net.",
  confirmNote: "Look only — allow it only if it's just opening a public page — never a login, form or message.",
  stopLabel: "Stop the research",
};

export interface AnalysisState {
  configured: boolean;
  manus: { configured: boolean; connector: { id: string; name: string | null } | null; libraryConnector?: { id: string; name: string | null } | null };
  active: AnalysisView | null;
  latest: AnalysisView | null;
  steps: StepView[];
  history: AnalysisSummaryRow[];
  settings: AdSettingsView;
  timezone: string;
  nextWeeklyAt: string | null;
  research: { active: AnalysisView | null; latest: ResearchView | null; history: ResearchSummaryRow[] };
}

function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Manus at work: what it's doing, its plan, its activity. */
export function LiveRun({ a, onStop, busy, copy = ANALYSIS_COPY }: { a: AnalysisView; onStop: () => void; busy: boolean; copy?: RunCopy }) {
  const [now, setNow] = useState(() => Date.now());
  const stream = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const act = a.activity;
  const feedLen = act?.feed.length ?? 0;
  useEffect(() => {
    const el = stream.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [feedLen]);
  const started = new Date(a.startedAt ?? a.createdAt).getTime();
  const plan = act?.plan ?? [];
  const doneSteps = plan.filter((s) => s.status === "done").length;
  const lastTool = [...(act?.feed ?? [])].reverse().find((f) => f.kind === "tool");
  const phase = a.status === "queued" || a.status === "building" ? copy.gathering : a.status === "saving" ? copy.saving : act?.now || lastTool?.title || copy.reading;

  return (
    <div className="overflow-hidden rounded-3xl border border-blue-400/25 bg-gradient-to-br from-blue-600/[0.12] via-[#0b1220] to-violet-600/[0.08]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/20 text-blue-200" style={{ animation: "cs-pulse-ring 2s infinite" }}>
          <SvgIcon d={SP.sparkles} size={17} />
        </span>
        <h3 className="text-[15px] font-bold text-white" style={SYNE}>
          {copy.title}
        </h3>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs text-neutral-400" style={NUM_FONT}>
            {clock(now - started)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-300" />
            Working
          </span>
        </span>
      </div>
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3.5 py-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <SvgIcon d={toolIcon(lastTool?.tool ?? null)} size={15} />
          </span>
          <p className="cs-shimmer-text min-w-0 flex-1 truncate text-sm font-semibold">{phase}</p>
        </div>
        {plan.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Manus&apos;s plan</span>
              <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
                {doneSteps} of {plan.length}
              </span>
            </div>
            <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 transition-all duration-700" style={{ width: `${Math.max(4, (doneSteps / plan.length) * 100)}%` }} />
            </div>
            <ol className="space-y-1.5">
              {plan.map((step, i) => (
                <li key={`${step.title}-${i}`} className="flex items-start gap-2.5">
                  <StepDot status={step.status} />
                  <span className={`min-w-0 flex-1 text-[13px] leading-snug ${step.status === "done" ? "text-neutral-400" : step.status === "doing" ? "cs-shimmer-text font-semibold" : "text-neutral-500"}`}>{step.title}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {act && act.feed.length > 0 && (
          <div>
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Activity</span>
            <div ref={stream} className="cs-scroll max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {act.feed.map((item, i) => (
                <FeedRow key={item.id} item={item} now={now} latest={i === act.feed.length - 1} />
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-neutral-400">{copy.eta}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-2.5 text-[11px] sm:px-5">
        {a.taskUrl ? (
          <a href={a.taskUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 font-semibold text-neutral-400 hover:text-white">
            Open in Manus <SvgIcon d={SP.external} size={12} />
          </a>
        ) : (
          <span className="text-neutral-600">Updates every few seconds</span>
        )}
        <button type="button" onClick={onStop} disabled={busy} className="min-h-9 px-2 font-semibold text-neutral-500 hover:text-rose-300 disabled:opacity-50">
          Stop
        </button>
      </div>
    </div>
  );
}

export function WaitingPanel({ a, busy, onAct, copy = ANALYSIS_COPY }: { a: AnalysisView; busy: boolean; onAct: (action: "reply" | "allow" | "stop", text?: string) => void; copy?: RunCopy }) {
  const [text, setText] = useState("");
  const w = a.waiting;
  if (!w) return null;
  return (
    <div className="rounded-3xl border border-amber-400/30 bg-amber-500/[0.08] p-4 sm:p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">{w.kind === "confirm" ? "Manus wants your OK" : "Manus has a question"}</p>
      <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-amber-50">{w.prompt}</p>
      {w.kind === "confirm" ? (
        <>
          <p className="mt-2 text-xs text-amber-100/70">{copy.confirmNote}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onAct("allow")} className="min-h-10 rounded-full bg-amber-300 px-4 text-sm font-bold text-black disabled:opacity-50">
              Allow
            </button>
            <button type="button" disabled={busy} onClick={() => onAct("stop")} className="min-h-10 px-3 text-sm font-semibold text-amber-200">
              {copy.stopLabel}
            </button>
          </div>
        </>
      ) : (
        <>
          {w.options.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {w.options.map((o) => (
                <button key={o} type="button" disabled={busy} onClick={() => onAct("reply", o)} className="min-h-9 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 text-xs font-semibold text-amber-50 hover:bg-amber-300/20">
                  {o}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Answer Manus"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[16px] text-white placeholder:text-neutral-500 focus:border-amber-300/50 focus:outline-none sm:text-sm"
            />
            <button type="button" disabled={busy || !text.trim()} onClick={() => onAct("reply", text)} className="min-h-10 shrink-0 rounded-full bg-amber-300 px-4 text-sm font-bold text-black disabled:opacity-50">
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AnalysisPanel({
  state,
  busy,
  onAnalyze,
  onAct,
  onRetry,
  onOpenReport,
  onJump,
}: {
  state: AnalysisState;
  busy: boolean;
  onAnalyze: () => void;
  onAct: (id: string, action: "reply" | "allow" | "stop", text?: string) => void;
  onRetry: (id: string) => void;
  onOpenReport: (id: string) => void;
  onJump: (e: ParsedEvidence) => void;
}) {
  const { active, latest, manus, nextWeeklyAt, timezone, settings } = state;
  const tz = timezone;
  const lastFailed = state.history[0] && (state.history[0].status === "failed" || state.history[0].status === "stopped") && (!latest || new Date(state.history[0].createdAt) > new Date(latest.finishedAt ?? 0)) ? state.history[0] : null;
  const r = latest?.result ?? null;

  const scheduleLine = (
    <p className="text-[11px] text-neutral-400" style={NUM_FONT}>
      {nextWeeklyAt ? <>Next automatic analysis {when(nextWeeklyAt, tz)} · </> : <>Weekly analysis is off · </>}
      {manus.connector ? <>Manus also uses its Meta Ads Manager connector</> : <>Tip: connect Meta Ads Manager in Manus → Connectors to let it dig deeper</>}
    </p>
  );

  if (!manus.configured) {
    return (
      <Glass className="p-5">
        <p className="text-sm text-neutral-300">Manus isn&apos;t connected yet — add MANUS_API_KEY in Vercel to get the analysis and next steps. Everything else on this page works without it.</p>
      </Glass>
    );
  }

  return (
    <div className="space-y-3">
      {active && (active.status === "waiting" ? <WaitingPanel a={active} busy={busy} onAct={(action, text) => onAct(active.id, action, text)} /> : <LiveRun a={active} busy={busy} onStop={() => onAct(active.id, "stop")} />)}

      {!active && lastFailed && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-300">
            <Ico d={<path d="M18 6 6 18M6 6l12 12" />} size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-100">The last analysis didn&apos;t finish</p>
            <p className="text-xs text-rose-200/80">{lastFailed.error ?? "It stopped before Manus answered."}</p>
          </div>
          <button type="button" disabled={busy} onClick={() => onRetry(lastFailed.id)} className="min-h-10 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/20">
            Try again
          </button>
        </div>
      )}

      {latest && r ? (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-6">
            <div className="flex items-center gap-4 sm:block">
              <ScoreRing score={latest.healthScore} />
              <div className="sm:hidden">
                <VerdictPill verdict={latest.verdict} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="hidden sm:block">
                <VerdictPill verdict={latest.verdict} />
              </div>
              <h3 className="mt-2 text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl" style={SYNE}>
                {r.headline}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">{r.summary}</p>
              <p className="mt-2 text-[11px] text-neutral-400" style={NUM_FONT}>
                {latest.trigger === "weekly" ? "Weekly analysis" : "On-demand analysis"} · {when(latest.finishedAt, tz)} · data through {latest.throughDate ?? "—"} · confidence {r.dataConfidence}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {latest.hasReport && (
                  <button type="button" onClick={() => onOpenReport(latest.id)} className={CTA_CLASSES}>
                    <SvgIcon d={SP.file} size={15} /> Read the full report
                  </button>
                )}
                <button type="button" onClick={onAnalyze} disabled={busy || Boolean(active)} className={SECONDARY_BTN}>
                  {active ? "Analysis running…" : "Analyze now"}
                </button>
                <a href={`/api/dashboard/ads/analysis/${latest.id}/pack`} className={`${SECONDARY_BTN} inline-flex items-center gap-1.5`}>
                  <SvgIcon d={SP.download} size={14} /> What Manus saw
                </a>
              </div>
            </div>
          </div>
          {(r.whatsWorking.length > 0 || r.whatsNot.length > 0) && (
            <div className="grid gap-px border-t border-white/5 bg-white/5 md:grid-cols-2">
              {[
                { title: "What's working", list: r.whatsWorking, color: "text-emerald-300", icon: <path d="M20 6 9 17l-5-5" /> },
                { title: "What's not", list: r.whatsNot, color: "text-rose-300", icon: <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /> },
              ].map((col) => (
                <div key={col.title} className="bg-[#0b1220] p-4 sm:p-5">
                  <p className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] ${col.color}`}>
                    <Ico d={col.icon} size={12} />
                    {col.title}
                  </p>
                  {col.list.length === 0 ? (
                    <p className="mt-2 text-xs text-neutral-400">Nothing to flag.</p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {col.list.map((f, i) => (
                        <li key={i}>
                          <p className="text-sm font-semibold text-white">{f.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">{f.detail}</p>
                          <div className="mt-1.5">
                            <EvidenceChips items={f.evidence} onJump={onJump} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3 border-t border-white/5 p-4 sm:p-5">
            {(r.budget.rationale || r.budget.moves.length > 0) && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  Budget · <span className="text-white">{r.budget.recommendation}</span>
                  {r.budget.suggestedDailyCents !== null && (
                    <span className="text-neutral-400" style={NUM_FONT}>
                      {" "}
                      {money(r.budget.currentDailyCents)}/day → {money(r.budget.suggestedDailyCents)}/day
                    </span>
                  )}
                </p>
                {r.budget.rationale && <p className="mt-1 text-xs leading-relaxed text-neutral-300">{r.budget.rationale}</p>}
                {r.budget.moves.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-neutral-400">
                    {r.budget.moves.map((m, i) => (
                      <li key={i}>
                        {m.from?.name ?? "—"} → {m.to?.name ?? "—"}
                        {m.dailyCents !== null ? ` · ${money(m.dailyCents)}/day` : ""} — {m.why}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {r.watchlist.length > 0 && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400">Watchlist</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-neutral-300">
                  {r.watchlist.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.dataNotes.length > 0 && <p className="text-[11px] text-amber-200/80">Data notes: {r.dataNotes.join(" · ")}</p>}
            {scheduleLine}
            {!settings.weeklyAuto && <p className="text-[11px] text-neutral-400">Turn the weekly run back on in Goals below.</p>}
          </div>
        </div>
      ) : (
        !active && (
          <div className="rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-600/[0.12] via-[#0b1220] to-blue-600/[0.08] p-5 sm:p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-300">Manus · ads strategist</p>
            <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl" style={SYNE}>
              Get a full read on the account
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-300">
              {[
                "Reads every campaign, ad set and creative with 7, 30 and 90 days of history",
                "Spots fatigue, wasted spend, learning problems and tracking gaps",
                "Gives you a short, dated checklist — exact clicks in Ads Manager, when to check back",
                "Hands creative refreshes straight to Creative Studio",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <Ico d={<path d="M20 6 9 17l-5-5" />} size={14} className="mt-0.5 shrink-0 text-violet-300" />
                  {x}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={onAnalyze} disabled={busy} className={CTA_CLASSES}>
                <SvgIcon d={SP.sparkles} size={15} /> Analyze now
              </button>
              <span className="text-xs text-neutral-500">Takes 5–15 minutes · uses Manus credits</span>
            </div>
            <div className="mt-4">{scheduleLine}</div>
          </div>
        )
      )}
    </div>
  );
}
