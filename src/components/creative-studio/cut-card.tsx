"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { CTA_CLASSES } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, downloadHref, send, videoFileName } from "@/components/creative-studio/client";
import { AssistantCard, Chip, SP, SvgIcon, UserBubble } from "@/components/creative-studio/canvas";
import { TrimEditor } from "@/components/creative-studio/trim-editor";
import { assembleCut, cutPieces } from "@/components/creative-studio/pipeline";

type Cut = ProjectDetail["cuts"][number];

const secs = (s: number) => (s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

/**
 * Auto-cut: once every Kling clip is rendered, each clip is cut tight
 * (1.2×, pauses capped at ~0.25 s) and joined into a rough cut. Fix it in
 * plain words in the chat box; every version is kept, with undo.
 */
export function CutCard({
  detail,
  summary,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  summary: string | null;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const cuts = detail.cuts;
  const latest: Cut | undefined = cuts[cuts.length - 1];
  const clips = detail.clips;
  const allDone = clips.length > 0 && clips.every((c) => c.status === "done" && c.videoUrl);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [showWords, setShowWords] = useState(true);
  const [trimId, setTrimId] = useState<string | null>(null);
  const running = useRef<string | null>(null);
  const started = useRef<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  // Start the first cut, or a new one when clips got new takes.
  const takesKey = clips.map((c) => `${c.id}:${c.version}`).join(",");
  useEffect(() => {
    if (!allDone) return;
    const stale = latest && latest.status !== "cutting" && latest.plan.some((pl) => clips.find((c) => c.id === pl.clipId)?.version !== pl.version);
    if ((latest && !stale) || started.current === takesKey) return;
    started.current = takesKey;
    void send(api(`${p.id}/cut/start`), "POST", latest ? { note: "New takes" } : {}).then((r) => {
      if (r.ok) onChange(r.data);
      else onError(r.error);
    });
  }, [allDone, latest, clips, takesKey, p.id, onChange, onError]);

  // Drive a cut that's in progress: each clip's piece (3 at a time), then the join.
  useEffect(() => {
    if (!allDone || !latest || latest.status !== "cutting" || running.current === latest.id) return;
    const cutId = latest.id;
    running.current = cutId;
    void cutPieces(p.id, cutId, clips.map((c) => c.id), (done, total) => setProgress({ done, total })).then(async (failed) => {
      if (failed) {
        running.current = null;
        setProgress(null);
        onError(`Auto-cut stopped: ${failed}`);
        return;
      }
      const r = await assembleCut(p.id, cutId);
      running.current = null;
      setProgress(null);
      if (r.ok) onChange(r.data);
      else onError(r.error);
    });
  }, [allDone, latest, clips, p.id, onChange, onError]);

  const ready = cuts.filter((c) => c.status === "ready" || c.status === "approved");
  const shown = latest && latest.status !== "cutting" && latest.url ? latest : ready[ready.length - 1];
  const aspect = p.format === "vsl_16x9" ? "16 / 9" : "9 / 16";

  const flow = useMemo(() => {
    if (!shown) return [];
    const rows = clips.map((c) => {
      const plan = shown.plan.find((pl) => pl.clipId === c.id);
      return { clip: c, plan, out: plan ? plan.keptS / shown.settings.speed : 0 };
    });
    return rows.map((r, i) => ({ ...r, start: rows.slice(0, i).reduce((t, x) => t + x.out, 0) }));
  }, [shown, clips]);
  const before = flow.reduce((t, r) => t + (r.plan?.sourceS ?? 0), 0);
  const after = flow.reduce((t, r) => t + r.out, 0);

  async function approve() {
    const r = await send(api(`${p.id}/cut/approve`), "POST");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  async function undo() {
    const r = await send(api(`${p.id}/cut/undo`), "POST");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  async function retry() {
    if (!latest) return;
    running.current = null;
    const r = await send(api(`${p.id}/cut/start`), "POST", { note: "Retry" });
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  function jump(t: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = t + 0.01;
    void v.play().catch(() => {});
  }

  const notes = cuts.filter((c) => c.note && !["New takes", "Retry"].includes(c.note));

  return (
    <div className="space-y-4">
      {notes.slice(-3).map((c) => (
        <UserBubble key={c.id}>{c.note}</UserBubble>
      ))}

      <AssistantCard
        id="stage-cut"
        accent="emerald"
        icon={SP.wand}
        title="Auto-cut"
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            {shown && <Chip>v{shown.version}</Chip>}
            {shown && <Chip>{shown.settings.speed}× · {shown.settings.gap}s pauses</Chip>}
            {shown?.status === "approved" && <Chip tone="green">✓ Approved</Chip>}
          </div>
        }
      >
        {!allDone && !shown && (
          <p className="text-sm text-neutral-400">The auto-cut starts by itself as soon as every clip is rendered: 1.2× speed, dead air trimmed, pauses capped at about 0.25 s.</p>
        )}

        {latest?.status === "cutting" && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-white">
                {progress && progress.done >= progress.total ? "Joining the clips…" : `Cutting your clips · ${latest.settings.speed}× · tight pauses`}
              </span>
              {progress && (
                <span className="text-xs text-neutral-400" style={NUM_FONT}>
                  {Math.min(progress.done, progress.total)} / {progress.total}
                </span>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-500"
                style={{ width: `${progress ? Math.max(6, (progress.done / Math.max(1, progress.total)) * 100) : 6}%` }}
              />
            </div>
            {!allDone && <p className="mt-2 text-xs text-neutral-400">Waiting for the re-rendered takes to finish on Kling…</p>}
          </div>
        )}

        {latest?.status === "failed" && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{latest.error ?? "The cut didn't finish."}</span>
            <button type="button" onClick={retry} className="text-xs font-bold text-white hover:underline">
              Try again
            </button>
          </div>
        )}

        {summary && <p className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-neutral-300">{summary}</p>}

        {shown?.url && (
          <>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
              <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl shadow-emerald-500/10" style={{ aspectRatio: aspect }}>
                <video key={shown.url} ref={video} src={shown.url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Before", value: secs(before) },
                    { label: "After", value: secs(after) },
                    { label: "Speed", value: `${shown.settings.speed}×` },
                    { label: "Max pause", value: `${shown.settings.gap}s` },
                  ].map((t) => (
                    <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">{t.label}</p>
                      <p className="text-lg font-extrabold text-white" style={NUM_FONT}>
                        {t.value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-400">
                  {before > 0 ? `${Math.round((1 - after / before) * 100)}% shorter than the raw clips.` : ""} Watch it, then tell me in the box below what to tighten or loosen, e.g.{" "}
                  <span className="text-neutral-200">“tighter where she says ‘ten times’”</span>.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {shown.status === "ready" && shown.id === latest?.id && (
                    <button type="button" onClick={approve} className={CTA_CLASSES}>
                      Approve cut
                    </button>
                  )}
                  <a href={downloadHref(shown.url, videoFileName(p.title, "auto-cut", `v${shown.version}`))} download className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/10 hover:text-white">
                    <SvgIcon d={SP.download} size={15} /> Download
                  </a>
                  {latest && latest.version > 1 && latest.status !== "approved" && latest.status !== "cutting" && (
                    <button type="button" onClick={undo} className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-neutral-500 hover:text-white">
                      <SvgIcon d={SP.undo} size={14} /> Undo last change
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Flow strip */}
            <div className="cs-scroll mt-4 flex gap-1.5 overflow-x-auto pb-1">
              {flow.map((r) => {
                const trimmed = Boolean(r.plan?.manual) || (r.plan?.overrides ?? []).some((o) => o.action === "cut");
                return (
                  <div
                    key={r.clip.id}
                    className={`group relative shrink-0 rounded-lg border bg-white/[0.03] hover:bg-white/[0.06] ${trimmed ? "border-emerald-400/40" : "border-white/10 hover:border-emerald-400/40"}`}
                    style={{ minWidth: `${Math.max(76, Math.min(170, r.out * 18))}px` }}
                  >
                    <button type="button" onClick={() => jump(r.start)} className="block w-full px-2.5 py-1.5 pr-8 text-left" title={r.clip.line}>
                      <p className="text-[10px] font-bold text-white" style={NUM_FONT}>
                        #{r.clip.idx + 1} · {r.out.toFixed(1)}s
                      </p>
                      <p className="text-[10px] text-neutral-500" style={NUM_FONT}>
                        {trimmed ? "✂ trimmed" : `from ${(r.plan?.sourceS ?? 0).toFixed(1)}s`}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrimId(r.clip.id)}
                      disabled={latest?.status === "cutting" || !r.clip.videoUrl}
                      className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:bg-emerald-500/20 hover:text-emerald-200 disabled:opacity-30"
                      aria-label={`Trim clip ${r.clip.idx + 1}`}
                      title="Trim this clip by hand"
                    >
                      ✂
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Transcript with cut points */}
            <div className="mt-3">
              <button type="button" onClick={() => setShowWords((v) => !v)} className="text-[11px] font-semibold text-neutral-500 hover:text-white">
                {showWords ? "▾" : "▸"} Words and cut points
              </button>
              {showWords && (
                <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                  {flow.map((r) => (
                    <p key={r.clip.id} className="text-[13px] leading-relaxed text-neutral-200">
                      <button type="button" onClick={() => jump(r.start)} className="mr-1.5 align-baseline text-[10px] font-bold text-emerald-300 hover:text-white" style={NUM_FONT}>
                        #{r.clip.idx + 1}
                      </button>
                      <Words words={r.clip.words} segments={r.plan?.segments ?? []} fallback={r.clip.line} />
                      {latest?.status !== "cutting" && r.clip.videoUrl && (
                        <button type="button" onClick={() => setTrimId(r.clip.id)} className="ml-1 align-baseline text-[10px] font-bold text-neutral-500 hover:text-emerald-300">
                          ✂ Trim
                        </button>
                      )}
                    </p>
                  ))}
                  <p className="text-[10px] text-neutral-500">
                    <span className="text-cyan-300">⌁</span> = pause shortened · <span className="line-through">struck</span> = cut
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </AssistantCard>

      {trimId && shown && (() => {
        const clip = clips.find((c) => c.id === trimId);
        if (!clip) return null;
        return (
          <TrimEditor
            projectId={p.id}
            clip={clip}
            entry={shown.plan.find((pl) => pl.clipId === clip.id && pl.version === clip.version)}
            settings={shown.settings}
            aspect={aspect}
            onClose={() => setTrimId(null)}
            onApplied={onChange}
            onError={onError}
          />
        );
      })()}
    </div>
  );
}

function Words({
  words,
  segments,
  fallback,
}: {
  words: { text: string; start: number; end: number }[] | null;
  segments: { start: number; end: number }[];
  fallback: string;
}) {
  if (!words || words.length === 0) return <span>{fallback}</span>;
  const segOf = (w: { start: number; end: number }) => {
    const mid = (w.start + w.end) / 2;
    return segments.findIndex((s) => mid >= s.start && mid <= s.end);
  };
  const segs = words.map(segOf);
  // The segment of the nearest kept word before index i (−1 if none).
  const prevKept = (i: number) => {
    for (let j = i - 1; j >= 0; j--) if (segs[j] >= 0) return segs[j];
    return -1;
  };
  return (
    <>
      {words.map((w, i) => {
        const seg = segs[i];
        const cut = seg < 0;
        const before = prevKept(i);
        const marker = !cut && before >= 0 && seg !== before;
        return (
          <span key={i}>
            {marker && <span className="mx-0.5 text-cyan-300">⌁</span>}
            <span className={cut ? "text-neutral-600 line-through" : ""}>{w.text}</span>{" "}
          </span>
        );
      })}
    </>
  );
}
