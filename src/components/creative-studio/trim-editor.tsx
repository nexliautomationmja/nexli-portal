"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { CutOverride, CutSettings } from "@/lib/creative-studio/tables";
import { computeSegments, cutRanges, cutWordSet, inWindow, LEAD, TAIL } from "@/lib/creative-studio/cutplan";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { CANVAS_VARS, SP, SvgIcon } from "@/components/creative-studio/canvas";

type Clip = ProjectDetail["clips"][number];
type PlanEntry = ProjectDetail["cuts"][number]["plan"][number];

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Trim one clip by hand: drag the start/end, click the first real word to
 * skip opening gibberish, ✕ words to cut them, preview the result at the
 * cut's speed, then apply. Only this clip is re-cut.
 */
export function TrimEditor({
  projectId,
  clip,
  entry,
  settings,
  aspect,
  onClose,
  onApplied,
  onError,
}: {
  projectId: string;
  clip: Clip;
  entry: PlanEntry | undefined;
  settings: CutSettings;
  aspect: string;
  onClose: () => void;
  onApplied: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const words = useMemo(() => clip.words ?? [], [clip.words]);
  const initialDuration = entry?.sourceS || clip.durationS;
  const [duration, setDuration] = useState(initialDuration);
  const [start, setStart] = useState(entry?.manual?.start ?? 0);
  const [end, setEnd] = useState(entry?.manual?.end ?? initialDuration);
  const [cut, setCut] = useState<Set<number>>(() => cutWordSet(words.length, (entry?.overrides ?? []) as CutOverride[]));
  const [preview, setPreview] = useState(true);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<"start" | "end" | null>(null);

  const timing = useMemo(
    () => ((entry?.overrides ?? []) as CutOverride[]).filter((o) => o.action !== "cut" && o.action !== "restore"),
    [entry?.overrides]
  );
  const plan = useMemo(
    () =>
      computeSegments({
        transcript: { version: clip.version, durationS: duration, words, text: "" },
        sourceS: duration,
        settings,
        overrides: [...timing, ...cutRanges([...cut])],
        manual: { start, end },
      }),
    [clip.version, duration, words, settings, timing, cut, start, end]
  );

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Waveform from the clip's audio (skipped quietly if it can't be decoded).
  useEffect(() => {
    if (!clip.videoUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const buf = await (await fetch(clip.videoUrl!)).arrayBuffer();
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const audio = await ctx.decodeAudioData(buf);
        void ctx.close();
        const data = audio.getChannelData(0);
        const bars = 220;
        const step = Math.max(1, Math.floor(data.length / bars));
        const out: number[] = [];
        for (let i = 0; i < bars; i++) {
          let max = 0;
          for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 8) max = Math.max(max, Math.abs(data[j]));
          out.push(max);
        }
        const top = Math.max(...out, 0.01);
        if (!cancelled) setPeaks(out.map((v) => v / top));
      } catch {
        /* no waveform */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clip.videoUrl]);

  // Preview playback: play only kept segments, at the cut's speed.
  const onTimeUpdate = useCallback(() => {
    const v = video.current;
    if (!v) return;
    const t = v.currentTime;
    setTime(t);
    if (!preview || v.paused) return;
    const segs = plan.segments;
    const inside = segs.find((s) => t >= s.start - 0.02 && t < s.end);
    if (inside) return;
    const next = segs.find((s) => s.start > t);
    if (next) v.currentTime = next.start;
    else {
      v.pause();
      v.currentTime = segs[0]?.start ?? 0;
    }
  }, [preview, plan.segments]);

  useEffect(() => {
    const v = video.current;
    if (v) v.playbackRate = preview ? settings.speed : 1;
  }, [preview, settings.speed]);

  function playPause() {
    const v = video.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      return;
    }
    if (preview) {
      const t = v.currentTime;
      const ok = plan.segments.some((s) => t >= s.start && t < s.end - 0.05);
      if (!ok) v.currentTime = plan.segments[0]?.start ?? 0;
    }
    void v.play().catch(() => {});
  }

  const pct = (t: number) => `${(Math.min(Math.max(t, 0), duration) / Math.max(duration, 0.001)) * 100}%`;
  const timeAt = (clientX: number) => {
    const el = track.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return r3(Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1) * duration);
  };

  function setStartSafe(t: number) {
    setStart(Math.max(0, Math.min(t, end - 0.2)));
  }
  function setEndSafe(t: number) {
    setEnd(Math.min(duration, Math.max(t, start + 0.2)));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const t = timeAt(e.clientX);
    if (drag.current === "start") setStartSafe(t);
    else setEndSafe(t);
    if (video.current) video.current.currentTime = t;
  }

  async function apply() {
    setSaving(true);
    const r = await send(api(`${projectId}/cut/manual`), "POST", { clipId: clip.id, start: r3(start), end: r3(end), cutWords: [...cut] });
    setSaving(false);
    if (r.ok) {
      onApplied(r.data);
      onClose();
    } else onError(r.error);
  }

  const after = plan.keptS / settings.speed;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" style={CANVAS_VARS} onClick={onClose}>
      <div
        className="lp-card relative flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#020617] text-white shadow-2xl shadow-black/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
            <SvgIcon d={SP.wand} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white" style={SYNE}>
              Trim clip {clip.idx + 1}
            </h2>
            <p className="truncate text-xs text-neutral-400">{clip.line}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <SvgIcon d={SP.x} />
          </button>
        </div>

        <div className="cs-scroll grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,260px)_1fr]">
          {/* Player */}
          <div className="space-y-3">
            <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/15 bg-black" style={{ aspectRatio: aspect }}>
              {clip.videoUrl && (
                <video
                  ref={video}
                  src={clip.videoUrl}
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) {
                      setDuration(r3(d));
                      if (!entry?.manual) setEnd(r3(d));
                    }
                  }}
                  onTimeUpdate={onTimeUpdate}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onClick={playPause}
                  className="h-full w-full cursor-pointer object-contain"
                />
              )}
            </div>
            <div className="flex items-center justify-center gap-2">
              <button type="button" onClick={playPause} className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30" aria-label={playing ? "Pause" : "Play"}>
                {playing ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="5" y="4" width="5" height="16" rx="1" />
                    <rect x="14" y="4" width="5" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
                  </svg>
                )}
              </button>
              <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-bold">
                <button type="button" onClick={() => setPreview(true)} className={`rounded-full px-3 py-1 ${preview ? "bg-emerald-600 text-white" : "text-neutral-400"}`}>
                  Preview {settings.speed}×
                </button>
                <button type="button" onClick={() => setPreview(false)} className={`rounded-full px-3 py-1 ${!preview ? "bg-white/15 text-white" : "text-neutral-400"}`}>
                  Original
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-neutral-500" style={NUM_FONT}>
              {fmt(time)} / {fmt(duration)}
            </p>
          </div>

          {/* Timeline + words */}
          <div className="min-w-0 space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]" style={NUM_FONT}>
                <span className="font-bold text-emerald-300">Start {fmt(start)}</span>
                <span className="text-neutral-500">Click to jump · drag the handles</span>
                <span className="font-bold text-emerald-300">End {fmt(end)}</span>
              </div>
              <div
                ref={track}
                className="relative h-24 cursor-pointer select-none overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                onPointerDown={(e) => {
                  if (drag.current) return;
                  const t = timeAt(e.clientX);
                  if (video.current) video.current.currentTime = t;
                  setTime(t);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={() => (drag.current = null)}
                onPointerLeave={() => (drag.current = null)}
              >
                {/* Waveform */}
                {peaks && (
                  <div className="absolute inset-x-0 inset-y-3 flex items-center gap-px px-px">
                    {peaks.map((v, i) => (
                      <span key={i} className="flex-1 rounded-full bg-white/25" style={{ height: `${Math.max(4, v * 100)}%` }} />
                    ))}
                  </div>
                )}
                {/* Kept segments */}
                {plan.segments.map((s, i) => (
                  <span key={i} className="absolute inset-y-0 border-x border-emerald-400/40 bg-emerald-400/15" style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }} />
                ))}
                {/* Outside the trim window */}
                <span className="absolute inset-y-0 left-0 bg-black/60" style={{ width: pct(start), backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 6px, transparent 6px 12px)" }} />
                <span className="absolute inset-y-0 right-0 bg-black/60" style={{ left: pct(end), backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 6px, transparent 6px 12px)" }} />
                {/* Cut words */}
                {words.map((w, i) =>
                  cut.has(i) ? (
                    <span key={i} className="absolute inset-y-0 bg-rose-500/25" style={{ left: pct(w.start), width: `calc(${pct(w.end)} - ${pct(w.start)})` }} />
                  ) : null
                )}
                {/* Playhead */}
                <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,.8)]" style={{ left: pct(time) }} />
                {/* Handles */}
                {(["start", "end"] as const).map((h) => (
                  <span
                    key={h}
                    role="slider"
                    aria-label={h === "start" ? "Trim start" : "Trim end"}
                    aria-valuenow={h === "start" ? start : end}
                    tabIndex={0}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      drag.current = h;
                      (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onKeyDown={(e) => {
                      const d = e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0;
                      if (!d) return;
                      e.preventDefault();
                      if (h === "start") setStartSafe(start + d);
                      else setEndSafe(end + d);
                    }}
                    className="absolute inset-y-0 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center outline-none"
                    style={{ left: pct(h === "start" ? start : end) }}
                  >
                    <span className="h-full w-1 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
                    <span className="absolute top-1/2 h-8 w-3 -translate-y-1/2 rounded-md border border-emerald-300 bg-emerald-500" />
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                <button type="button" onClick={() => setStartSafe(time)} className="rounded-full bg-white/5 px-3 py-1.5 text-neutral-200 hover:bg-white/10">
                  Set start here
                </button>
                <button type="button" onClick={() => setStartSafe(start - 0.05)} className="rounded-full bg-white/5 px-2 py-1.5 text-neutral-400 hover:bg-white/10" aria-label="Start earlier">
                  ◂
                </button>
                <button type="button" onClick={() => setStartSafe(start + 0.05)} className="rounded-full bg-white/5 px-2 py-1.5 text-neutral-400 hover:bg-white/10" aria-label="Start later">
                  ▸
                </button>
                <span className="mx-1 h-4 w-px bg-white/10" />
                <button type="button" onClick={() => setEndSafe(time)} className="rounded-full bg-white/5 px-3 py-1.5 text-neutral-200 hover:bg-white/10">
                  Set end here
                </button>
                <button type="button" onClick={() => setEndSafe(end - 0.05)} className="rounded-full bg-white/5 px-2 py-1.5 text-neutral-400 hover:bg-white/10" aria-label="End earlier">
                  ◂
                </button>
                <button type="button" onClick={() => setEndSafe(end + 0.05)} className="rounded-full bg-white/5 px-2 py-1.5 text-neutral-400 hover:bg-white/10" aria-label="End later">
                  ▸
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStart(0);
                    setEnd(duration);
                    setCut(new Set());
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-neutral-500 hover:text-white"
                >
                  <SvgIcon d={SP.undo} size={12} /> Reset to auto
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] text-neutral-400">
                <b className="text-white">Click a word</b> to start the clip there (skips any gibberish before it) · <b className="text-white">Alt-click</b> to end there · <b className="text-white">✕</b> cuts a single word
              </p>
              {words.length === 0 ? (
                <p className="rounded-xl border border-white/10 px-3 py-3 text-xs text-neutral-500">No word timings for this take yet. Use the handles to trim.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {words.map((w, i) => {
                    const out = !inWindow(w, { start, end });
                    const isCut = cut.has(i);
                    const active = time >= w.start && time <= w.end;
                    return (
                      <span
                        key={i}
                        className={`group inline-flex items-center overflow-hidden rounded-lg border text-xs transition-colors ${
                          active ? "border-cyan-300/60 bg-cyan-400/15" : out || isCut ? "border-white/5 bg-white/[0.02]" : "border-white/10 bg-white/[0.05]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            if (e.altKey) setEndSafe(Math.min(duration, w.end + TAIL));
                            else setStartSafe(Math.max(0, w.start - LEAD));
                            if (video.current) video.current.currentTime = w.start;
                          }}
                          className={`px-2 py-1 ${out || isCut ? "text-neutral-600 line-through" : "text-neutral-100 hover:text-white"}`}
                          title={`${w.start.toFixed(2)}s · click = start here, Alt-click = end here`}
                        >
                          {w.text}
                          <span className="ml-1 text-[9px] text-neutral-500" style={NUM_FONT}>
                            {w.start.toFixed(1)}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCut((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            })
                          }
                          className={`border-l border-white/10 px-1.5 py-1 ${isCut ? "bg-rose-500/20 text-rose-200" : "text-neutral-600 opacity-60 hover:text-rose-300 group-hover:opacity-100"}`}
                          aria-label={isCut ? `Keep "${w.text}"` : `Cut "${w.text}"`}
                          title={isCut ? "Keep this word" : "Cut this word"}
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-5 py-4">
          <p className="text-xs text-neutral-400" style={NUM_FONT}>
            Keeps <b className="text-white">{plan.keptS.toFixed(1)}s</b> of {duration.toFixed(1)}s → <b className="text-emerald-300">{after.toFixed(1)}s</b> at {settings.speed}×
          </p>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/5">
              Cancel
            </button>
            <button type="button" onClick={apply} disabled={saving} className={CTA_CLASSES}>
              {saving ? "Applying…" : "Apply trim"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
