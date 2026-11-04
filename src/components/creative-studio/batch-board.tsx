"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BatchSummary, BatchVideo } from "@/lib/creative-studio/batch-service";
import type { EditStyle } from "@/remotion/types";
import type { CreativeRig } from "@/lib/creative-studio/tables";
import { EDIT_STYLES, STYLE_LABEL, suggestedStyle } from "@/lib/creative-studio/edit-styles";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { approveAndRender, runCut } from "@/components/creative-studio/pipeline";
import { AssistantCard, Chip, ErrorStrip, SP, StudioCanvas, SvgIcon } from "@/components/creative-studio/canvas";

type Tone = "neutral" | "blue" | "red" | "amber" | "green";

/** Where a video is, in words, and whether it's waiting on Marcel. */
function stageOf(v: BatchVideo): { label: string; tone: Tone; step: number; needsYou?: string } {
  if (!v.hasFrame) {
    if (v.manus?.waiting) return { label: "Manus has a question", tone: "amber", step: 0, needsYou: "Answer Manus" };
    if (v.manus?.status === "failed") return { label: "Frame failed", tone: "red", step: 0 };
    return { label: "Making the frame", tone: "blue", step: 0 };
  }
  if (v.clips.total === 0) return { label: "Writing the script", tone: "blue", step: 1 };
  if (v.status === "scripted") return { label: "Script ready", tone: "amber", step: 2, needsYou: "Review" };
  if (v.status === "approved" || v.status === "rendering") {
    return { label: `Kling ${v.clips.done}/${v.clips.total}${v.clips.failed ? ` · ${v.clips.failed} failed` : ""}`, tone: v.clips.failed ? "red" : "blue", step: 3 };
  }
  if (!v.finalCut) {
    if (v.cut?.status === "ready") return { label: "Cut ready", tone: "amber", step: 4, needsYou: "Approve cut" };
    if (v.cut?.status === "failed") return { label: "Cut failed", tone: "red", step: 4 };
    return { label: "Auto-cutting", tone: "blue", step: 4 };
  }
  if (!v.edit) return { label: "Ready to edit", tone: "amber", step: 5, needsYou: "Pick a style" };
  if (v.edit.status === "rendering") return { label: `Final render ${v.edit.progress}%`, tone: "blue", step: 6 };
  if (v.edit.status === "done") return { label: "Done", tone: "green", step: 7 };
  if (v.edit.status === "failed") return { label: "Render failed", tone: "red", step: 6 };
  return { label: "Edit ready", tone: "amber", step: 6, needsYou: "Render" };
}

const STEPS = ["Frame", "Script", "Review", "Kling", "Cut", "Edit", "Render", "Done"];

/** How many of each automatic step run at once across the batch. */
const LIMIT = { manus: 3, script: 2, cut: 1, edit: 2, copy: 2 };

type Kind = keyof typeof LIMIT | "poll" | "pick";

/**
 * The batch page: every video's stage, the steps that run on their own
 * (frames, scripts, Kling polling, auto-cut, final-render polling) and the
 * bulk actions at each decision (approve & render on Kling, approve cuts,
 * edit style, render finals, ad copy). It runs while the page is open and
 * picks up where it left off when you come back.
 */
export function BatchBoard({ batchId }: { batchId: string }) {
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState<string | null>(null);
  const [editChoice, setEditChoice] = useState<"suggested" | EditStyle>("suggested");
  const [describe, setDescribe] = useState("");

  const summaryRef = useRef<BatchSummary | null>(null);
  const errorsRef = useRef<Record<string, string>>({});
  const inflight = useRef(new Map<string, Kind>());
  const lastPoll = useRef(new Map<string, number>());

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/dashboard/creative-studio/batches/${batchId}`);
      const b = await r.json().catch(() => null);
      if (!r.ok) throw new Error(b?.error || `Request failed (${r.status})`);
      summaryRef.current = b as BatchSummary;
      setSummary(b as BatchSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the batch");
    }
  }, [batchId]);

  const fail = useCallback((id: string, msg: string) => {
    errorsRef.current = { ...errorsRef.current, [id]: msg };
    setErrors(errorsRef.current);
  }, []);
  const clearError = (id: string) => {
    const next = { ...errorsRef.current };
    delete next[id];
    errorsRef.current = next;
    setErrors(next);
  };

  /** Run one step for one video (one at a time per video), then refresh. */
  const run = useCallback(
    (id: string, kind: Kind, label: string, fn: () => Promise<{ ok: boolean; error?: string } | unknown>) => {
      if (inflight.current.has(id)) return;
      inflight.current.set(id, kind);
      setWorking((w) => ({ ...w, [id]: label }));
      void (async () => {
        try {
          const r = (await fn()) as { ok?: boolean; error?: string } | undefined;
          if (r && r.ok === false) fail(id, r.error || "That step failed");
        } catch (err) {
          fail(id, err instanceof Error ? err.message : "That step failed");
        } finally {
          inflight.current.delete(id);
          setWorking((w) => {
            const next = { ...w };
            delete next[id];
            return next;
          });
          void refresh();
        }
      })();
    },
    [fail, refresh]
  );

  // The driver: every few seconds, refresh and move each video along.
  useEffect(() => {
    let stopped = false;
    const count = (k: Kind) => [...inflight.current.values()].filter((x) => x === k).length;
    const due = (id: string, every: number) => {
      const last = lastPoll.current.get(id) ?? 0;
      if (Date.now() - last < every) return false;
      lastPoll.current.set(id, Date.now());
      return true;
    };
    const tick = async () => {
      await refresh();
      const s = summaryRef.current;
      if (!s || stopped) return;
      const manusRunning = s.videos.filter((v) => !v.hasFrame && (v.manus?.status === "running" || v.manus?.status === "waiting")).length;
      for (const v of s.videos) {
        if (inflight.current.has(v.id) || errorsRef.current[v.id]) continue;
        const p = v.id;
        if (!v.hasFrame) {
          if (v.firstOptionId) run(p, "pick", "Using Manus's frame…", () => send(api(`${p}/frame/pick`), "POST", { assetId: v.firstOptionId }));
          else if (v.manus && (v.manus.status === "running" || v.manus.status === "waiting")) {
            if (due(p, 8000)) run(p, "poll", "Manus is working…", () => send(api(`${p}/frame/poll`), "POST"));
          } else if (!v.manus && v.shot && manusRunning + count("manus") < LIMIT.manus) {
            run(p, "manus", "Starting Manus…", () => send(api(`${p}/frame/generate`), "POST", { shot: v.shot, count: 1 }));
          }
          continue;
        }
        if (v.clips.total === 0) {
          if (count("script") < LIMIT.script) run(p, "script", "Claude is writing the script…", () => send(api(`${p}/script`), "POST", {}));
          continue;
        }
        if ((v.status === "approved" || v.status === "rendering") && due(p, 20000)) {
          run(p, "poll", "Checking Kling…", () => send(api(`${p}/render/poll`), "POST"));
          continue;
        }
        if (v.status === "clips_ready" && !v.finalCut && (!v.cut || v.cut.status === "cutting") && count("cut") < LIMIT.cut) {
          run(p, "cut", "Auto-cutting…", () => runCut(p));
          continue;
        }
        if (v.edit?.status === "rendering" && due(p, 10000)) run(p, "poll", "Checking the render…", () => send(api(`${p}/edit/poll`), "POST"));
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 6000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [refresh, run]);

  if (!summary) {
    return (
      <StudioCanvas>
        <div className="mx-auto max-w-5xl px-4 py-10">{error ? <ErrorStrip>{error}</ErrorStrip> : <div className="h-40 animate-pulse rounded-2xl bg-white/5" />}</div>
      </StudioCanvas>
    );
  }

  const vids = summary.videos;
  const isAd = summary.format === "ad_9x16";
  const noun = isAd ? "ads" : "VSLs";
  const scripted = vids.filter((v) => v.status === "scripted" && v.clips.total > 0);
  const cutsReady = vids.filter((v) => !v.finalCut && v.cut?.status === "ready");
  const toEdit = vids.filter((v) => v.finalCut && !v.edit);
  const toRender = vids.filter((v) => v.edit && (v.edit.status === "draft" || v.edit.status === "failed"));
  const needCopy = isAd ? vids.filter((v) => v.clips.total > 0 && !v.adCopy) : [];
  const done = vids.filter((v) => v.edit?.status === "done").length;

  /** Run a bulk action over videos, `limit` at a time. */
  async function each(list: BatchVideo[], label: string, limit: number, fn: (v: BatchVideo) => Promise<unknown>) {
    const queue = [...list];
    let n = 0;
    setBulk(`${label} · 0 of ${list.length}`);
    const worker = async () => {
      while (queue.length) {
        const v = queue.shift()!;
        try {
          const r = (await fn(v)) as { ok?: boolean; error?: string } | undefined;
          if (r && r.ok === false) fail(v.id, r.error || "That step failed");
        } catch (err) {
          fail(v.id, err instanceof Error ? err.message : "That step failed");
        }
        n++;
        setBulk(`${label} · ${n} of ${list.length}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
    setBulk(null);
    void refresh();
  }

  function approveAll() {
    const clips = scripted.reduce((t, v) => t + v.clips.total, 0);
    const credits = scripted.reduce((t, v) => t + v.clips.credits, 0);
    if (!confirm(`Approve ${scripted.length} scripts and send ${clips} clips to Kling? About ${credits.toLocaleString("en-US")} credits from your kling.ai plan.`)) return;
    // One video at a time, so Kling's queue and rate limits aren't flooded.
    void each(scripted, "Sending to Kling", 1, (v) => approveAndRender(v.id));
  }
  function editAll() {
    const instruction = describe.trim();
    void each(toEdit, "Claude is laying out the edits", LIMIT.edit, (v) => {
      const style: EditStyle = instruction ? "custom" : editChoice === "suggested" ? suggestedStyle(summary!.format, v.rig as CreativeRig) : editChoice;
      return send(api(`${v.id}/edit/start`), "POST", { style, ...(instruction ? { instruction } : {}) });
    });
  }

  return (
    <StudioCanvas>
      <div className="mx-auto max-w-5xl px-3 pb-16 sm:px-6">
        <header className="flex items-center gap-3 border-b border-white/5 py-4">
          <Link href="/dashboard/creative-studio" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Back to Creative Studio">
            <SvgIcon d={SP.chevronLeft} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white sm:text-lg" style={SYNE}>
              Batch · {vids.length} {noun}
            </h1>
            <p className="truncate text-xs text-neutral-500">{summary.brief}</p>
          </div>
          <Chip tone={done === vids.length ? "green" : "blue"}>
            {done}/{vids.length} done
          </Chip>
        </header>

        <div className="space-y-5 py-6">
          <AssistantCard accent="cyan" icon={SP.wand} title="Next steps" right={bulk ? <Chip tone="blue">{bulk}</Chip> : null}>
            <p className="mb-3 text-xs text-neutral-400">
              Frames, scripts, Kling progress, auto-cuts and final renders move along by themselves while this page is open. If you close it, everything picks up where it left off when you come back. Open any video to work on it by hand.
            </p>
            <div className="space-y-2.5">
              {scripted.length > 0 && (
                <Action
                  text={`${scripted.length} script${scripted.length > 1 ? "s" : ""} ready. Review them (open each video), then send them all to Kling.`}
                  button={`Approve & render ${scripted.length} on Kling`}
                  sub={`≈ ${scripted.reduce((t, v) => t + v.clips.credits, 0).toLocaleString("en-US")} credits`}
                  onClick={approveAll}
                  disabled={Boolean(bulk)}
                />
              )}
              {cutsReady.length > 0 && (
                <Action
                  text={`${cutsReady.length} auto-cut${cutsReady.length > 1 ? "s" : ""} ready to watch.`}
                  button={`Approve ${cutsReady.length} cut${cutsReady.length > 1 ? "s" : ""}`}
                  onClick={() => void each(cutsReady, "Approving cuts", 3, (v) => send(api(`${v.id}/cut/approve`), "POST"))}
                  disabled={Boolean(bulk)}
                />
              )}
              {toEdit.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-sm text-neutral-200">
                    {toEdit.length} video{toEdit.length > 1 ? "s" : ""} ready for the Remotion edit. How should they be edited?
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(["suggested", ...EDIT_STYLES.map((s) => s.id)] as ("suggested" | EditStyle)[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setEditChoice(st);
                          setDescribe("");
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                          editChoice === st && !describe.trim() ? "border-cyan-400 bg-cyan-500/20 text-white" : "border-white/10 bg-white/5 text-neutral-300 hover:text-white"
                        }`}
                      >
                        {st === "suggested" ? "Suggested for each" : STYLE_LABEL[st]}
                      </button>
                    ))}
                  </div>
                  <input
                    value={describe}
                    onChange={(e) => setDescribe(e.target.value)}
                    placeholder="…or describe it once for all, e.g. captions, title at the top, zoom in on the numbers"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-cyan-400/50 focus:outline-none"
                  />
                  <button type="button" onClick={editAll} disabled={Boolean(bulk)} className={`${CTA_CLASSES} mt-2 disabled:opacity-50`}>
                    Edit {toEdit.length} {describe.trim() ? "your way" : editChoice === "suggested" ? "with the suggested style" : `as ${STYLE_LABEL[editChoice as EditStyle]}`}
                  </button>
                </div>
              )}
              {toRender.length > 0 && (
                <Action
                  text={`${toRender.length} edit${toRender.length > 1 ? "s" : ""} ready. Check them (open each video), then render the finals.`}
                  button={`Render ${toRender.length} final${toRender.length > 1 ? "s" : ""}`}
                  onClick={() => void each(toRender, "Starting final renders", 2, (v) => send(api(`${v.id}/edit/render`), "POST"))}
                  disabled={Boolean(bulk)}
                />
              )}
              {needCopy.length > 0 && (
                <Action
                  text={`Meta ad copy for ${needCopy.length} ad${needCopy.length > 1 ? "s" : ""}.`}
                  button="Write ad copy for all"
                  onClick={() => void each(needCopy, "Writing ad copy", LIMIT.copy, (v) => send(api(`${v.id}/copy`), "POST", {}))}
                  disabled={Boolean(bulk)}
                />
              )}
              {!scripted.length && !cutsReady.length && !toEdit.length && !toRender.length && !needCopy.length && (
                <p className="text-sm text-neutral-300">{done === vids.length ? "Every video is done. 🎉" : "Nothing needs you right now. The videos are moving along."}</p>
              )}
            </div>
          </AssistantCard>

          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vids.map((v) => {
              const st = stageOf(v);
              const busy = working[v.id];
              const err = errors[v.id];
              return (
                // Phones: a compact row (thumbnail left); from sm up: a card.
                <div key={v.id} className="lp-card flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] sm:flex-col">
                  <div className={`relative w-24 shrink-0 bg-black sm:w-auto ${isAd ? "aspect-[4/5]" : "aspect-video max-sm:aspect-[4/5]"}`}>
                    {v.frameUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                      <img src={v.frameUrl} alt="" className="h-full w-full object-cover opacity-90" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[11px] text-neutral-500">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-300" />
                        <span className="hidden sm:inline">{v.shot ? `Manus: ${v.shot}` : "Waiting for a frame"}</span>
                      </div>
                    )}
                    <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-[11px] font-black text-white">{v.index + 1}</span>
                    <span className="absolute right-2 top-2 hidden sm:block">
                      <Chip tone={st.tone}>{st.label}</Chip>
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                    <p className="truncate text-sm font-semibold text-white" title={v.title}>
                      {v.title}
                    </p>
                    <span className="sm:hidden">
                      <Chip tone={st.tone}>{st.label}</Chip>
                    </span>
                    <div className="flex gap-0.5" aria-label={`Step ${st.step + 1} of ${STEPS.length}: ${STEPS[st.step]}`}>
                      {STEPS.map((s, i) => (
                        <span key={s} title={s} className={`h-1 flex-1 rounded-full ${i < st.step ? "bg-cyan-400" : i === st.step ? (st.tone === "green" ? "bg-emerald-400" : "bg-cyan-400/50") : "bg-white/10"}`} />
                      ))}
                    </div>
                    {busy && !err && (
                      <p className="flex items-center gap-1.5 text-[11px] text-cyan-200" style={NUM_FONT}>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-300" />
                        {busy}
                      </p>
                    )}
                    {(err || (v.manus?.status === "failed" && !v.hasFrame && v.manus.error)) && (
                      <p className="line-clamp-3 rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">{err ?? v.manus?.error}</p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                      <Link href={`/dashboard/creative-studio/${v.id}`} className="inline-flex min-h-9 items-center rounded-full bg-white/10 px-3.5 text-xs font-bold text-white hover:bg-white/20">
                        {st.needsYou ?? "Open"} →
                      </Link>
                      {(err || st.tone === "red") && (
                        <button
                          type="button"
                          onClick={() => {
                            clearError(v.id);
                            if (!v.hasFrame && v.manus?.status === "failed" && v.shot) {
                              run(v.id, "manus", "Starting Manus again…", () => send(api(`${v.id}/frame/generate`), "POST", { shot: v.shot, count: 1 }));
                            } else if (v.cut?.status === "failed") {
                              run(v.id, "cut", "Auto-cutting again…", () => runCut(v.id));
                            } else if (v.edit?.status === "failed") {
                              run(v.id, "poll", "Starting the render again…", () => send(api(`${v.id}/edit/render`), "POST"));
                            }
                          }}
                          className="min-h-9 px-2 text-xs font-semibold text-neutral-400 hover:text-white"
                        >
                          ↻ Retry
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </StudioCanvas>
  );
}

function Action({ text, button, sub, onClick, disabled }: { text: string; button: string; sub?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="min-w-0 flex-1 text-sm text-neutral-200">{text}</p>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        {sub && (
          <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
            {sub}
          </span>
        )}
        <button type="button" onClick={onClick} disabled={disabled} className={`${CTA_CLASSES} w-full disabled:opacity-50 sm:w-auto`}>
          {button}
        </button>
      </div>
    </div>
  );
}
