"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { CANVAS_VARS, SP, SvgIcon } from "@/components/creative-studio/canvas";
import type { AnalysisSummaryRow, AnalysisView, StepView } from "@/lib/ads/analysis-service";
import { PRIORITY, ScoreRing, VerdictPill, when } from "@/components/ads/analysis-bits";
import { Glass, Ico } from "@/components/ads/parts";
import { ReportMarkdown } from "@/components/ads/report-markdown";

export function History({ rows, tz, onOpen }: { rows: AnalysisSummaryRow[]; tz: string; onOpen: (id: string) => void }) {
  if (!rows.length) return <Glass className="p-5"><p className="text-sm text-neutral-400">Past analyses will collect here.</p></Glass>;
  return (
    <Glass className="divide-y divide-white/5">
      {rows.map((h) => (
        <button key={h.id} type="button" onClick={() => onOpen(h.id)} disabled={h.status !== "done"} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] disabled:cursor-default">
          <div className="w-16 shrink-0 text-center" style={NUM_FONT}>
            <p className="text-lg font-black text-white">{h.healthScore ?? "—"}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">health</p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {h.status === "done" ? <VerdictPill verdict={h.verdict} /> : <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-200">{h.status}</span>}
              <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
                {when(h.finishedAt ?? h.createdAt, tz)} · {h.trigger === "weekly" ? "weekly" : "on demand"}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-neutral-200">{h.status === "done" ? h.headline : (h.error ?? "Didn't finish")}</p>
          </div>
          {h.stepsTotal > 0 && (
            <span className="shrink-0 text-[11px] text-neutral-400" style={NUM_FONT}>
              {h.stepsDone}/{h.stepsTotal} done
            </span>
          )}
          {h.status === "done" && <Ico d={<path d="m9 18 6-6-6-6" />} size={14} className="shrink-0 text-neutral-500" />}
        </button>
      ))}
    </Glass>
  );
}

type Tab = "report" | "steps";

export function ReportModal({ id, tz, onClose }: { id: string; tz: string; onClose: () => void }) {
  const [data, setData] = useState<{ analysis: AnalysisView; report: string | null; steps: StepView[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("report");

  useEffect(() => {
    let live = true;
    fetch(`/api/dashboard/ads/analysis/${id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!live) return;
        if (!ok) setError(d?.error || "Couldn't open the report");
        else setData(d);
      })
      .catch(() => live && setError("Couldn't open the report"));
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      live = false;
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [id, onClose]);

  const a = data?.analysis;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 sm:items-center sm:p-6" style={CANVAS_VARS} onClick={onClose} role="dialog" aria-modal="true" aria-label="Ads analysis report">
      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden border border-white/10 bg-[#0b1220] text-white sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          {a && <ScoreRing score={a.healthScore} size={52} />}
          <div className="min-w-0 flex-1">
            {a && <VerdictPill verdict={a.verdict} />}
            <p className="mt-1 truncate text-[11px] text-neutral-400" style={NUM_FONT}>
              {a ? `${when(a.finishedAt, tz)} · data through ${a.throughDate ?? "—"}` : "Loading…"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <Ico d={<path d="M18 6 6 18M6 6l12 12" />} size={18} />
          </button>
        </div>
        <div className="flex gap-1 border-b border-white/10 px-4 py-2">
          {(["report", "steps"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`min-h-9 rounded-full px-3 text-xs font-bold ${tab === t ? "bg-blue-600 text-white" : "text-neutral-400 hover:text-white"}`}>
              {t === "report" ? "Report" : `Steps${data ? ` · ${data.steps.length}` : ""}`}
            </button>
          ))}
          {a && (
            <a href={`/api/dashboard/ads/analysis/${a.id}/pack`} className="ml-auto inline-flex min-h-9 items-center gap-1 px-2 text-xs font-semibold text-cyan-300 hover:underline">
              <SvgIcon d={SP.download} size={13} /> Data Manus saw
            </a>
          )}
        </div>
        <div className="cs-scroll flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error && <p className="text-sm text-rose-300">{error}</p>}
          {!data && !error && <div className="h-40 animate-pulse rounded-2xl bg-white/5" />}
          {data && tab === "report" && (data.report ? <ReportMarkdown text={data.report} /> : <p className="text-sm text-neutral-400">No written report for this analysis.</p>)}
          {data && tab === "steps" && (
            <ul className="space-y-2">
              {data.steps.map((s) => (
                <li key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-full border px-2 py-px text-[10px] font-black uppercase tracking-wider ${(PRIORITY[s.priority] ?? PRIORITY.later).cls}`}>{(PRIORITY[s.priority] ?? PRIORITY.later).label}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{s.status}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-white">{s.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">{s.why}</p>
                  {s.manusOutcome && <p className="mt-1 text-[11px] text-cyan-200/80">Follow-up: {s.manusOutcome.replace(/_/g, " ")}{s.manusOutcomeNote ? ` — ${s.manusOutcomeNote}` : ""}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
