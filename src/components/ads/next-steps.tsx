"use client";

import { useState } from "react";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { money } from "@/lib/ads/format";
import type { StepView } from "@/lib/ads/analysis-service";
import type { ParsedEvidence, ParsedTest } from "@/lib/ads/parse";
import { day, EvidenceChips, KIND, KindChip, PRIORITY } from "@/components/ads/analysis-bits";
import { ExternalIcon, Glass, Ico } from "@/components/ads/parts";
import { fullBrief, photosHref, videosHref } from "@/components/ads/handoff";

const GROUPS: { id: string; label: string }[] = [
  { id: "now", label: "Do now" },
  { id: "this_week", label: "This week" },
  { id: "next_week", label: "Next week" },
  { id: "later", label: "Later" },
];
const EFFORT: Record<string, string> = { "5_min": "5 min", "30_min": "30 min", "1_hour_plus": "1 hour+" };
const OUTCOME: Record<string, string> = { worked: "Worked", partly_worked: "Partly worked", no_change: "No change", worse: "Made it worse", too_early: "Too early to tell", not_done: "Not done", unknown: "Unclear" };

export type StepPatch = { status?: "done" | "skipped" | "open"; snoozeDays?: 1 | 3 | 7; skippedReason?: string; note?: string; selfOutcome?: "better" | "same" | "worse"; checked?: boolean; handoff?: "photos" | "videos" };

function HowList({ how }: { how: string }) {
  const lines = how
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean);
  if (lines.length <= 1) return <p className="text-sm leading-relaxed text-neutral-200">{how}</p>;
  return (
    <ol className="space-y-1.5">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-neutral-200">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white" style={NUM_FONT}>
            {i + 1}
          </span>
          {l}
        </li>
      ))}
    </ol>
  );
}

function StepCard({
  step,
  tz,
  studioKey,
  busy,
  onPatch,
  onJump,
  defaultOpen,
}: {
  step: StepView;
  tz: string;
  studioKey: string;
  busy: boolean;
  onPatch: (id: string, patch: StepPatch) => Promise<void>;
  onJump: (e: ParsedEvidence) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(step.note ?? "");
  const [copied, setCopied] = useState(false);
  const done = step.status === "done";
  const skipped = step.status === "skipped";
  const k = KIND[step.kind] ?? KIND.other;
  const p = PRIORITY[step.priority] ?? PRIORITY.later;
  const refresh = step.creativeRefresh;
  const brief = refresh ? fullBrief(refresh) : "";
  const v = step.verification;

  const handoff = (kind: "photos" | "videos", count: number) => {
    void onPatch(step.id, { handoff: kind });
    window.location.href = kind === "photos" ? photosHref(studioKey, brief, count, step.id) : videosHref(studioKey, brief, count);
  };

  return (
    <article className={`overflow-hidden rounded-2xl border ${step.due ? "border-amber-400/40" : "border-white/10"} ${done || skipped ? "bg-white/[0.02]" : "bg-white/[0.04]"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-3.5 text-left sm:p-4" aria-expanded={open}>
        <KindChip kind={step.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex rounded-full border px-2 py-px text-[10px] font-black uppercase tracking-wider ${p.cls}`}>{p.label}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{k.label}</span>
            {done && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-px text-[10px] font-bold text-emerald-200">✓ Done {day(step.doneAt, tz)}</span>}
            {skipped && <span className="rounded-full bg-white/5 px-2 py-px text-[10px] font-bold text-neutral-400">Skipped</span>}
            {step.due && <span className="rounded-full bg-amber-500/20 px-2 py-px text-[10px] font-bold text-amber-200">Check-back due</span>}
          </div>
          <h4 className={`mt-1 text-[15px] font-bold leading-snug ${done || skipped ? "text-neutral-300" : "text-white"}`}>{step.title}</h4>
          {!open && step.why && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{step.why}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500" style={NUM_FONT}>
            {step.checkBackAt && <span className={step.due ? "font-semibold text-amber-200" : ""}>Check back {day(step.checkBackAt, tz)}</span>}
            <span>{step.confidence} confidence</span>
            {step.effort && <span>{EFFORT[step.effort] ?? step.effort}</span>}
            {step.carried && <span>First suggested {day(step.firstSuggestedAt, tz)}</span>}
            {v && (
              <span className={v.state === "verified" ? "font-semibold text-emerald-300" : v.state === "partly" ? "text-amber-200" : ""}>
                {v.state === "verified" ? "✓ " : ""}
                {v.detail}
              </span>
            )}
          </div>
        </div>
        <Ico d={<path d={open ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />} size={16} className="mt-1 shrink-0 text-neutral-500" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/5 px-3.5 pb-4 pt-3 sm:px-4">
          {step.why && <p className="text-sm leading-relaxed text-neutral-300">{step.why}</p>}
          {step.how && (
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">How, in Ads Manager</p>
              <HowList how={step.how} />
            </div>
          )}
          {step.targets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {step.targets.map((t, i) =>
                t.adsManagerUrl ? (
                  <a
                    key={i}
                    href={t.adsManagerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-8 max-w-full items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold ${t.unverified ? "border-amber-400/40 text-amber-100" : "border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/10"}`}
                    title={t.unverified ? "Manus named this, but it isn't in the data it was given — check it exists" : `Open the ${t.level} in Ads Manager`}
                  >
                    <span className="text-neutral-500">{t.level === "adset" ? "Ad set" : t.level === "ad" ? "Ad" : t.level === "campaign" ? "Campaign" : "Account"}</span>
                    <span className="truncate">{t.name}</span>
                    <ExternalIcon />
                  </a>
                ) : (
                  <span key={i} className="inline-flex min-h-8 items-center rounded-lg border border-white/10 px-2 text-[11px] text-neutral-300">
                    {t.name}
                  </span>
                )
              )}
            </div>
          )}
          <EvidenceChips items={step.evidence} onJump={onJump} />
          {step.budgetChange && (step.budgetChange.fromCents !== null || step.budgetChange.toCents !== null) && (
            <p className="text-xs text-neutral-300" style={NUM_FONT}>
              Daily budget: {money(step.budgetChange.fromCents)} → <b className="text-white">{money(step.budgetChange.toCents)}</b>
            </p>
          )}
          {step.successCheck && step.successCheck.targetDisplay && (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300">
              <span className="font-bold text-white">Success looks like: </span>
              {step.successCheck.targetDisplay}
              {step.successCheck.checkAfterDays ? ` — check after ${step.successCheck.checkAfterDays} days` : ""}
            </p>
          )}
          {(step.expectedImpact || step.risk) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {step.expectedImpact && (
                <p className="text-xs text-neutral-400">
                  <span className="font-bold text-neutral-200">Expected: </span>
                  {step.expectedImpact}
                </p>
              )}
              {step.risk && (
                <p className="text-xs text-amber-200/90">
                  <span className="font-bold">Risk: </span>
                  {step.risk}
                </p>
              )}
            </div>
          )}

          {refresh && (
            <div className="rounded-2xl border border-violet-400/25 bg-violet-500/[0.07] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-violet-300">
                Refresh with {refresh.count} new {refresh.format === "video" ? "video" : refresh.format === "both" ? "creative" : "photo ad"}
                {refresh.count === 1 ? "" : "s"}
              </p>
              {refresh.angles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {refresh.angles.map((a, i) => (
                    <span key={i} className="rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-0.5 text-[11px] text-violet-100">
                      {a}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-violet-50/90">{refresh.brief}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {refresh.format !== "video" && (
                  <button type="button" onClick={() => handoff("photos", refresh.format === "both" ? Math.ceil(refresh.count / 2) : refresh.count)} className="min-h-10 rounded-full bg-violet-500 px-4 text-xs font-bold text-white hover:bg-violet-400">
                    Make {refresh.format === "both" ? Math.ceil(refresh.count / 2) : refresh.count} photo ads
                  </button>
                )}
                {refresh.format !== "photo" && (
                  <button type="button" onClick={() => handoff("videos", refresh.format === "both" ? Math.floor(refresh.count / 2) || 1 : Math.min(10, refresh.count))} className="min-h-10 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15">
                    Make {refresh.format === "both" ? Math.floor(refresh.count / 2) || 1 : Math.min(10, refresh.count)} videos
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(brief).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                  className="min-h-10 px-2 text-xs font-semibold text-violet-200 hover:underline"
                >
                  {copied ? "Copied" : "Copy the brief"}
                </button>
                {step.handoff && <span className="text-[11px] text-violet-200/70">Sent to Creative Studio {day(step.handoff.at, tz)}</span>}
              </div>
            </div>
          )}

          {(step.manusOutcome || step.selfOutcome) && (
            <p className="text-xs text-neutral-400">
              {step.selfOutcome && <>You said: <b className="text-neutral-200">{step.selfOutcome}</b>. </>}
              {step.manusOutcome && (
                <>
                  Manus&apos;s follow-up: <b className="text-neutral-200">{OUTCOME[step.manusOutcome] ?? step.manusOutcome}</b>
                  {step.manusOutcomeNote ? ` — ${step.manusOutcomeNote}` : ""}
                </>
              )}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            {!done ? (
              <button type="button" disabled={busy} onClick={() => void onPatch(step.id, { status: "done" })} className="min-h-10 rounded-full bg-emerald-500 px-4 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-50">
                ✓ Mark done
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void onPatch(step.id, { status: "open" })} className="min-h-10 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15">
                Undo done
              </button>
            )}
            {!skipped && !done && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt("Why skip it? (Manus reads this next time)", "");
                  if (reason !== null) void onPatch(step.id, { status: "skipped", skippedReason: reason });
                }}
                className="min-h-10 rounded-full border border-white/10 px-3 text-xs font-semibold text-neutral-300 hover:text-white"
              >
                Skip
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
              Remind me in
              {([1, 3, 7] as const).map((d) => (
                <button key={d} type="button" disabled={busy} onClick={() => void onPatch(step.id, { snoozeDays: d })} className="min-h-9 rounded-full border border-white/10 px-2.5 text-[11px] font-semibold text-neutral-300 hover:text-white">
                  {d}d
                </button>
              ))}
            </span>
            {(done || step.due) && (
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                How did it go?
                {(["better", "same", "worse"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    disabled={busy}
                    onClick={() => void onPatch(step.id, { selfOutcome: o })}
                    className={`min-h-9 rounded-full border px-2.5 text-[11px] font-semibold ${step.selfOutcome === o ? "border-cyan-400/50 bg-cyan-400/15 text-white" : "border-white/10 text-neutral-300 hover:text-white"}`}
                  >
                    {o}
                  </button>
                ))}
              </span>
            )}
            <button type="button" onClick={() => setNoteOpen((x) => !x)} className="min-h-9 px-2 text-[11px] font-semibold text-cyan-300 hover:underline">
              {step.note ? "Edit note" : "Add a note"}
            </button>
          </div>
          {noteOpen && (
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What you did, or why — Manus reads it next time"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[16px] text-white placeholder:text-neutral-500 focus:border-cyan-400/50 focus:outline-none sm:text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void onPatch(step.id, { note });
                  setNoteOpen(false);
                }}
                className="min-h-10 shrink-0 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"
              >
                Save
              </button>
            </div>
          )}
          {step.note && !noteOpen && <p className="text-[11px] text-neutral-400">Note: {step.note}</p>}
        </div>
      )}
    </article>
  );
}

export function NextSteps({
  steps,
  tests,
  tz,
  studioKey,
  busy,
  onPatch,
  onJump,
}: {
  steps: StepView[];
  tests: ParsedTest[];
  tz: string;
  studioKey: string;
  busy: boolean;
  onPatch: (id: string, patch: StepPatch) => Promise<void>;
  onJump: (e: ParsedEvidence) => void;
}) {
  if (!steps.length && !tests.length) {
    return (
      <Glass className="p-5">
        <p className="text-sm text-neutral-300">No next steps yet. They appear here after Manus&apos;s first analysis — each one with the exact change, where to make it, and when to check back.</p>
      </Glass>
    );
  }
  const live = steps.filter((s) => s.status !== "superseded");
  const doneCount = live.filter((s) => s.status === "done").length;
  return (
    <div className="space-y-5">
      {live.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400" style={NUM_FONT}>
            <span>
              <b className="text-white">{doneCount}</b> of {live.length} done
            </span>
            <span>{live.filter((s) => s.due).length ? `${live.filter((s) => s.due).length} check-back due` : ""}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700" style={{ width: `${(doneCount / Math.max(1, live.length)) * 100}%` }} />
          </div>
        </div>
      )}
      {GROUPS.map((g) => {
        const list = live.filter((s) => s.priority === g.id);
        if (!list.length) return null;
        return (
          <div key={g.id}>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
              {g.label} <span style={NUM_FONT}>· {list.length}</span>
            </p>
            <div className="space-y-2">
              {list.map((s) => (
                <StepCard key={s.id} step={s} tz={tz} studioKey={studioKey} busy={busy} onPatch={onPatch} onJump={onJump} defaultOpen={g.id === "now" && s.status === "open"} />
              ))}
            </div>
          </div>
        );
      })}
      {tests.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Tests Manus suggests</p>
          <div className="grid gap-2 md:grid-cols-2">
            {tests.map((t, i) => (
              <Glass key={i} className="p-3.5">
                <p className="text-sm font-bold text-white">{t.hypothesis}</p>
                <p className="mt-1 text-xs text-neutral-400">
                  <b className="text-neutral-200">Control:</b> {t.control} · <b className="text-neutral-200">Variant:</b> {t.variant}
                </p>
                <p className="mt-1 text-xs text-neutral-400">{t.setup}</p>
                <p className="mt-1 text-[11px] text-neutral-400" style={NUM_FONT}>
                  {t.durationDays} days{t.dailyBudgetCents ? ` · ${money(t.dailyBudgetCents)}/day` : ""}
                  {t.minSample ? ` · ${t.minSample}` : ""}
                </p>
                {t.decisionRule && <p className="mt-1 text-xs text-cyan-100/90">Decide: {t.decisionRule}</p>}
              </Glass>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
