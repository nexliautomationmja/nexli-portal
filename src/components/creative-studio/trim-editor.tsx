"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { CutOverride, CutSettings } from "@/lib/creative-studio/tables";
import {
  computeSegments,
  cutRanges,
  cutWordSet,
  inSections,
  inWindow,
  LEAD,
  MIN_KEPT,
  MIN_SECTION,
  normalizeSections,
  TAIL,
} from "@/lib/creative-studio/cutplan";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { CANVAS_VARS, SP, SvgIcon } from "@/components/creative-studio/canvas";

type Clip = ProjectDetail["clips"][number];
type PlanEntry = ProjectDetail["cuts"][number]["plan"][number];
/** A stretch cut out by hand (source seconds); `id` keeps the selection steady while edges move. */
type Section = { id: number; start: number; end: number };
type Drag = { kind: "start" | "end" | "scrub" } | { kind: "sec"; id: number; edge: "start" | "end" };

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
/** One frame of a take (Kling renders at 24–30 fps). */
const FRAME = 1 / 30;
const ZOOMS = [1, 2, 4, 8] as const;
/** Length of a new cut, before you drag its edges. */
const NEW_CUT = 0.5;
/** "Hear the join" plays this much (source seconds) either side of the cut. */
const JOIN_CONTEXT = 1.5;

/**
 * Trim one clip by hand: drag the start/end, cut out any stretch exactly
 * (red sections: the clip jumps straight from one edge to the other), click
 * words to start/end/cut there, preview at the cut's speed, then apply.
 * Only this clip is re-cut.
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
  // Handles open where the clip currently starts/ends (the auto-cut edges, or your last trim).
  const [start, setStart] = useState(() => entry?.manual?.start ?? entry?.segments[0]?.start ?? 0);
  const [end, setEnd] = useState(() => entry?.manual?.end ?? entry?.segments[entry.segments.length - 1]?.end ?? initialDuration);
  const [cut, setCut] = useState<Set<number>>(() => cutWordSet(words.length, (entry?.overrides ?? []) as CutOverride[]));
  const [sections, setSections] = useState<Section[]>(() => (entry?.sections ?? []).map((x, i) => ({ id: i + 1, start: x.start, end: x.end })));
  const [sel, setSel] = useState<number | null>(null);
  /** true once you move an edge: from then on the clip starts/ends exactly at the handles. */
  const [touched, setTouched] = useState(Boolean(entry?.manual));
  const [keepPauses, setKeepPauses] = useState(Boolean(entry?.manual?.keepPauses));
  const [reset, setReset] = useState(false);
  const [preview, setPreview] = useState(true);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  /** Where a touch went down on the track: a tap seeks, a sideways drag scrubs. */
  const tap = useRef<{ x: number; y: number } | null>(null);
  /** "Hear the join" pauses here (source seconds). */
  const stopAt = useRef<number | null>(null);
  const nextId = useRef(1000);
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  // What tapping a word does (phones have no Alt-click; desktop keeps Alt-click = end).
  const [wordMode, setWordMode] = useState<"start" | "end" | "cut">("start");

  const timing = useMemo(
    () => ((entry?.overrides ?? []) as CutOverride[]).filter((o) => o.action !== "cut" && o.action !== "restore"),
    [entry?.overrides]
  );
  const cleanSections = useMemo(() => normalizeSections(sections, duration), [sections, duration]);
  const plan = useMemo(
    () =>
      computeSegments({
        transcript: { version: clip.version, durationS: duration, words, text: "" },
        sourceS: duration,
        settings,
        overrides: [...timing, ...cutRanges([...cut])],
        manual: touched ? { start, end, keepPauses } : null,
        sections: cleanSections,
      }),
    [clip.version, duration, words, settings, timing, cut, start, end, touched, keepPauses, cleanSections]
  );
  // Cuts that swallow the whole clip: the maths falls back to the full window, which overlaps a cut.
  const nothingLeft =
    plan.keptS < MIN_KEPT || plan.segments.some((s) => cleanSections.some((x) => s.start < x.end - 0.001 && s.end > x.start + 0.001));
  const ordered = useMemo(() => [...sections].sort((a, b) => a.start - b.start), [sections]);
  const selected = sections.find((x) => x.id === sel) ?? null;
  const numberOf = (id: number) => ordered.findIndex((x) => x.id === id) + 1;

  // Esc closes; ← → / Space are wired up below, once the handlers exist.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    document.addEventListener("keydown", onKey);
    // The page scrolls on <html> (body clips overflow-x): hold that still behind the sheet.
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prev;
    };
  }, []);

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
        // Fine enough to stay sharp at 8× zoom.
        const bars = 1200;
        const step = Math.max(1, Math.floor(data.length / bars));
        const out: number[] = [];
        for (let i = 0; i < bars; i++) {
          let max = 0;
          for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 4) max = Math.max(max, Math.abs(data[j]));
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

  const wave = useMemo(() => {
    if (!peaks) return null;
    // A mirrored outline (one path scales to any zoom, unlike hundreds of bars).
    const y = (v: number, dir: 1 | -1) => (50 + dir * Math.max(1, v * 48)).toFixed(1);
    let d = "M0 50";
    for (let i = 0; i < peaks.length; i++) d += `L${i + 0.5} ${y(peaks[i], -1)}`;
    d += `L${peaks.length} 50`;
    for (let i = peaks.length - 1; i >= 0; i--) d += `L${i + 0.5} ${y(peaks[i], 1)}`;
    return `${d}Z`;
  }, [peaks]);

  const ticks = useMemo(() => {
    const minor = zoom >= 8 ? 0.1 : zoom >= 4 ? 0.25 : zoom >= 2 ? 0.5 : 1;
    const out: { t: number; major: boolean }[] = [];
    const count = Math.floor(duration / minor + 1e-6);
    for (let k = 0; k <= count; k++) {
      const t = r3(k * minor);
      out.push({ t, major: Math.abs(t - Math.round(t)) < 1e-6 });
    }
    return out;
  }, [duration, zoom]);

  // While playing: follow the playhead every frame, and in Preview jump over
  // everything that's cut the moment it's reached (timeupdate only fires ~4×
  // a second, which let ¼ s of a cut slip through and hid where it really ends).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const v = video.current;
      if (v && !v.paused) {
        let t = v.currentTime;
        if (preview) {
          const segs = plan.segments;
          if (!segs.some((s) => t >= s.start - 0.005 && t < s.end)) {
            const next = segs.find((s) => s.start > t);
            if (next) {
              v.currentTime = next.start;
              t = next.start;
            } else {
              v.pause();
              stopAt.current = null;
              v.currentTime = segs[0]?.start ?? 0;
              t = v.currentTime;
            }
          }
        }
        if (stopAt.current != null && t >= stopAt.current) {
          v.pause();
          stopAt.current = null;
        }
        if (now - last > 50) {
          last = now;
          setTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, preview, plan.segments]);

  useEffect(() => {
    const v = video.current;
    if (v) v.playbackRate = preview ? settings.speed : 1;
  }, [preview, settings.speed]);

  // Zoomed in: keep the playhead on screen (not while you're dragging something).
  useEffect(() => {
    const sc = scroller.current;
    const tr = track.current;
    if (!sc || !tr || drag.current || sc.scrollWidth <= sc.clientWidth + 1) return;
    const x = (time / Math.max(duration, 0.001)) * tr.offsetWidth;
    if (x < sc.scrollLeft + 12 || x > sc.scrollLeft + sc.clientWidth - 12) sc.scrollLeft = x - sc.clientWidth / 3;
  }, [time, duration]);

  const clampT = (t: number) => r3(Math.min(Math.max(t, 0), duration));
  const now = () => video.current?.currentTime ?? time;

  function seek(t: number) {
    const c = clampT(t);
    if (video.current) video.current.currentTime = c;
    setTime(c);
  }
  function pause() {
    stopAt.current = null;
    video.current?.pause();
  }
  function stepFrame(dir: number, frames = 1) {
    pause();
    seek(now() + dir * frames * FRAME);
  }

  function playPause() {
    const v = video.current;
    if (!v) return;
    if (!v.paused) {
      pause();
      return;
    }
    stopAt.current = null;
    if (preview) {
      // Sitting in a cut: carry on from the next kept part (or the top, at the end).
      const t = v.currentTime;
      const ok = plan.segments.some((s) => t >= s.start && t < s.end - 0.05);
      if (!ok) v.currentTime = plan.segments.find((s) => s.start > t)?.start ?? plan.segments[0]?.start ?? 0;
    }
    void v.play().catch(() => {});
  }

  function changeZoom(z: number) {
    setZoom(z);
    // Centre the playhead in the new zoom (after React has widened the track).
    requestAnimationFrame(() => {
      const sc = scroller.current;
      const tr = track.current;
      if (sc && tr) sc.scrollLeft = (now() / Math.max(duration, 0.001)) * tr.offsetWidth - sc.clientWidth / 2;
    });
  }

  const pct = (t: number) => `${(Math.min(Math.max(t, 0), duration) / Math.max(duration, 0.001)) * 100}%`;
  const timeAt = (clientX: number) => {
    const el = track.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return r3(Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1) * duration);
  };

  function setStartSafe(t: number) {
    setTouched(true);
    setReset(false);
    setStart(r3(Math.max(0, Math.min(t, end - 0.2))));
  }
  function setEndSafe(t: number) {
    setTouched(true);
    setReset(false);
    setEnd(r3(Math.min(duration, Math.max(t, start + 0.2))));
  }

  // ── Hand-cut sections ──────────────────────────────────────────────
  function addSection() {
    pause();
    const t = clampT(now());
    const hit = sections.find((x) => t >= x.start && t <= x.end);
    if (hit) {
      setSel(hit.id);
      return;
    }
    const next = ordered.find((x) => x.start > t);
    const stop = Math.min(duration, t + NEW_CUT, next ? next.start : Number.POSITIVE_INFINITY);
    // At the very end of the take (or right against the next cut) reach back instead.
    const begin = stop - t < MIN_SECTION ? Math.max(0, stop - NEW_CUT) : t;
    const id = nextId.current++;
    setSections((prev) => [...prev, { id, start: r3(begin), end: r3(stop) }]);
    setSel(id);
    seek(begin);
  }
  /** Move one edge; the other edge is pushed along if they'd cross. */
  function setEdge(id: number, edge: "start" | "end", t: number) {
    const c = clampT(t);
    setSections((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        if (edge === "start") {
          const s = Math.min(c, duration - MIN_SECTION);
          return { ...x, start: r3(s), end: r3(Math.max(x.end, s + MIN_SECTION)) };
        }
        const e = Math.max(c, MIN_SECTION);
        return { ...x, end: r3(e), start: r3(Math.min(x.start, e - MIN_SECTION)) };
      })
    );
  }
  function nudgeEdge(x: Section, edge: "start" | "end", dir: number) {
    pause();
    const t = x[edge] + dir * FRAME;
    setEdge(x.id, edge, t);
    seek(t);
  }
  function removeSection(id: number) {
    setSections((prev) => prev.filter((x) => x.id !== id));
    setSel((s) => (s === id ? null : s));
  }
  function hearJoin(x: Section) {
    const v = video.current;
    if (!v) return;
    setPreview(true);
    v.playbackRate = settings.speed;
    const from = Math.max(0, x.start - JOIN_CONTEXT);
    v.currentTime = from;
    setTime(from);
    stopAt.current = Math.min(duration, x.end + JOIN_CONTEXT);
    void v.play().catch(() => {});
  }
  function selectAt(t: number) {
    const hit = sections.find((x) => t >= x.start && t <= x.end);
    if (hit) setSel(hit.id);
  }

  // ── Pointer: drag handles / scrub ──────────────────────────────────
  function grab(e: React.PointerEvent, d: Drag) {
    e.stopPropagation();
    pause();
    drag.current = d;
    tap.current = null;
    track.current?.setPointerCapture(e.pointerId);
  }
  function beginScrub(e: React.PointerEvent) {
    grab(e, { kind: "scrub" });
    const t = timeAt(e.clientX);
    seek(t);
    selectAt(t);
  }
  /** Zoomed in and dragging against an edge of the timeline: scroll along. */
  function autoScroll(clientX: number) {
    const sc = scroller.current;
    if (!sc || sc.scrollWidth <= sc.clientWidth + 1) return;
    const r = sc.getBoundingClientRect();
    if (clientX > r.right - 32) sc.scrollLeft += 14;
    else if (clientX < r.left + 32) sc.scrollLeft -= 14;
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) {
      // A finger moving sideways on the track scrubs; up/down is left to scroll the sheet.
      const tp = tap.current;
      if (tp && Math.abs(e.clientX - tp.x) > 6 && Math.abs(e.clientX - tp.x) > Math.abs(e.clientY - tp.y)) beginScrub(e);
      return;
    }
    autoScroll(e.clientX);
    const t = timeAt(e.clientX);
    if (d.kind === "scrub") seek(t);
    else if (d.kind === "start") {
      setStartSafe(t);
      seek(t);
    } else if (d.kind === "end") {
      setEndSafe(t);
      seek(t);
    } else if (d.kind === "sec") {
      setEdge(d.id, d.edge, t);
      seek(t);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current && tap.current) {
      const t = timeAt(e.clientX);
      seek(t);
      selectAt(t);
    }
    tap.current = null;
    drag.current = null;
  }

  // Keyboard (desktop): Esc closes, ← → step a frame (Shift = ½ s), Space plays.
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [role=slider]")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        stepFrame(e.key === "ArrowLeft" ? -1 : 1, e.shiftKey ? 15 : 1);
      } else if (e.key === " " && el?.tagName !== "BUTTON") {
        e.preventDefault();
        playPause();
      }
    };
  });
  async function apply() {
    setSaving(true);
    const r = await send(api(`${projectId}/cut/manual`), "POST", {
      clipId: clip.id,
      start: r3(start),
      end: r3(end),
      cutWords: [...cut],
      sections: cleanSections,
      keepPauses,
      // Untouched edges: keep the auto-cut's own start/end (only word cuts and sections apply).
      edges: touched,
      reset,
    });
    setSaving(false);
    if (r.ok) {
      onApplied(r.data);
      onClose();
    } else onError(r.error);
  }

  const after = plan.keptS / settings.speed;
  const smallBtn = "min-h-9 rounded-full bg-white/5 px-3 text-neutral-200 hover:bg-white/10";
  const nudgeBtn = "min-h-9 min-w-9 rounded-full bg-white/5 px-2 text-neutral-400 hover:bg-white/10 hover:text-white";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" style={CANVAS_VARS} onClick={onClose}>
      <div
        className="lp-card relative flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#020617] text-white shadow-2xl shadow-black/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
            <SvgIcon d={SP.wand} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white" style={SYNE}>
              Trim clip {clip.idx + 1}
            </h2>
            <p className="truncate text-xs text-neutral-400">{clip.line}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <SvgIcon d={SP.x} />
          </button>
        </div>

        <div className="cs-scroll grid flex-1 gap-4 overflow-y-auto overscroll-contain p-3 sm:gap-5 sm:p-5 md:grid-cols-[minmax(0,260px)_1fr]">
          {/* Player — on phones it stays at the top while the timeline and words scroll under it */}
          <div className="space-y-2 max-md:sticky max-md:top-0 max-md:z-20 max-md:-mx-3 max-md:-mt-3 max-md:bg-[#020617]/95 max-md:px-3 max-md:pb-2 max-md:pt-3 max-md:backdrop-blur-xl sm:space-y-3">
            <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/15 bg-black max-md:max-h-[30dvh] max-md:w-auto" style={{ aspectRatio: aspect }}>
              {clip.videoUrl && (
                <video
                  ref={video}
                  src={clip.videoUrl}
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) setDuration(r3(d));
                  }}
                  onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onClick={playPause}
                  className="h-full w-full cursor-pointer object-contain"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button type="button" onClick={() => stepFrame(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white" aria-label="Back one frame" title="Back one frame (←)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="5" width="3" height="14" rx="1" />
                  <path d="M20 5.5v13a1 1 0 0 1-1.55.83l-9-6.5a1 1 0 0 1 0-1.66l9-6.5A1 1 0 0 1 20 5.5Z" />
                </svg>
              </button>
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
              <button type="button" onClick={() => stepFrame(1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white" aria-label="Forward one frame" title="Forward one frame (→)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="17" y="5" width="3" height="14" rx="1" />
                  <path d="M4 5.5v13a1 1 0 0 0 1.55.83l9-6.5a1 1 0 0 0 0-1.66l-9-6.5A1 1 0 0 0 4 5.5Z" />
                </svg>
              </button>
              <div className="ml-1 flex rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-bold">
                <button type="button" onClick={() => setPreview(true)} className={`min-h-8 rounded-full px-2.5 py-1 ${preview ? "bg-emerald-600 text-white" : "text-neutral-400"}`}>
                  Preview {settings.speed}×
                </button>
                <button type="button" onClick={() => setPreview(false)} className={`min-h-8 rounded-full px-2.5 py-1 ${!preview ? "bg-white/15 text-white" : "text-neutral-400"}`}>
                  Original
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-neutral-500" style={NUM_FONT}>
              {fmt(time)} / {fmt(duration)}
              <span className="hidden [@media(hover:hover)]:inline"> · ← → one frame · Space plays</span>
            </p>
          </div>

          {/* Timeline + cuts + words */}
          <div className="min-w-0 space-y-4">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]" style={NUM_FONT}>
                <span className="font-bold text-emerald-300">
                  Start {fmt(start)} · End {fmt(end)}
                  {!touched && <span className="font-normal text-neutral-500"> · auto</span>}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500">Zoom</span>
                  <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5 font-bold">
                    {ZOOMS.map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => changeZoom(z)}
                        className={`min-h-8 min-w-9 rounded-full px-2 ${zoom === z ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"}`}
                        aria-pressed={zoom === z}
                      >
                        {z}×
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div ref={scroller} className="cs-scroll isolate overflow-x-auto overflow-y-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="relative" style={{ width: `${zoom * 100}%` }}>
                  {/* Ruler */}
                  <div className="pointer-events-none relative h-5 border-b border-white/5" style={NUM_FONT}>
                    {ticks.map(({ t, major }) => (
                      <span key={t} className="absolute bottom-0" style={{ left: pct(t) }}>
                        <span className={`absolute bottom-0 w-px ${major ? "h-2.5 bg-white/30" : "h-1.5 bg-white/15"}`} />
                        {major && t > 0 && t < duration - 0.2 && <span className="absolute bottom-2.5 -translate-x-1/2 text-[9px] text-neutral-500">{t}s</span>}
                      </span>
                    ))}
                  </div>

                  <div
                    ref={track}
                    className="relative h-24 cursor-pointer touch-pan-y select-none"
                    onPointerDown={(e) => {
                      if (drag.current) return;
                      tap.current = { x: e.clientX, y: e.clientY };
                      if (e.pointerType === "mouse") beginScrub(e);
                    }}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => {
                      tap.current = null;
                      drag.current = null;
                    }}
                  >
                    {/* Waveform */}
                    {wave && (
                      <div className="pointer-events-none absolute inset-x-0 inset-y-3">
                        <svg viewBox={`0 0 ${peaks!.length} 100`} preserveAspectRatio="none" className="block h-full w-full">
                          <path d={wave} fill="rgba(255,255,255,.28)" />
                        </svg>
                      </div>
                    )}
                    {/* Kept segments */}
                    {plan.segments.map((s, i) => (
                      <span key={i} className="pointer-events-none absolute inset-y-0 border-x border-emerald-400/40 bg-emerald-400/15" style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }} />
                    ))}
                    {/* Outside the trim window */}
                    <span className="pointer-events-none absolute inset-y-0 left-0 bg-black/60" style={{ width: pct(start), backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 6px, transparent 6px 12px)" }} />
                    <span className="pointer-events-none absolute inset-y-0 right-0 bg-black/60" style={{ left: pct(end), backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 6px, transparent 6px 12px)" }} />
                    {/* Cut words */}
                    {words.map((w, i) =>
                      cut.has(i) ? (
                        <span key={i} className="pointer-events-none absolute inset-y-0 bg-rose-500/25" style={{ left: pct(w.start), width: `calc(${pct(w.end)} - ${pct(w.start)})` }} />
                      ) : null
                    )}
                    {/* Hand-cut sections */}
                    {ordered.map((x, k) => (
                      <span
                        key={x.id}
                        className={`pointer-events-none absolute inset-y-0 flex items-start justify-center overflow-hidden border-y-2 ${x.id === sel ? "z-[25] border-rose-300 bg-rose-500/40" : "z-[15] border-rose-400/50 bg-rose-500/25"}`}
                        style={{
                          left: pct(x.start),
                          width: `calc(${pct(x.end)} - ${pct(x.start)})`,
                          backgroundImage: "repeating-linear-gradient(135deg, rgba(0,0,0,.25) 0 5px, transparent 5px 10px)",
                        }}
                      >
                        <span className="mt-0.5 text-[10px] font-bold text-rose-50">✂{k + 1}</span>
                      </span>
                    ))}
                    {/* Playhead */}
                    <span className="pointer-events-none absolute inset-y-0 z-[35] w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,.8)]" style={{ left: pct(time) }} />
                    <span
                      aria-hidden="true"
                      onPointerDown={(e) => grab(e, { kind: "scrub" })}
                      className="absolute top-0 z-40 flex h-7 w-9 -translate-x-1/2 cursor-grab touch-none justify-center active:cursor-grabbing"
                      style={{ left: pct(time) }}
                    >
                      <span className="h-3 w-4 rounded-b-md bg-white shadow-[0_0_8px_rgba(255,255,255,.6)]" />
                    </span>
                    {/* Trim handles */}
                    {(["start", "end"] as const).map((h) => (
                      <span
                        key={h}
                        role="slider"
                        aria-label={h === "start" ? "Trim start" : "Trim end"}
                        aria-valuenow={h === "start" ? start : end}
                        tabIndex={0}
                        onPointerDown={(e) => grab(e, { kind: h })}
                        onKeyDown={(e) => {
                          const d = e.key === "ArrowLeft" ? -FRAME : e.key === "ArrowRight" ? FRAME : 0;
                          if (!d) return;
                          e.preventDefault();
                          if (h === "start") setStartSafe(start + d);
                          else setEndSafe(end + d);
                        }}
                        className="absolute inset-y-0 z-10 flex w-10 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none"
                        style={{ left: pct(h === "start" ? start : end) }}
                      >
                        <span className="h-full w-1 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
                        <span className="absolute top-1/2 h-8 w-3 -translate-y-1/2 rounded-md border border-emerald-300 bg-emerald-500" />
                      </span>
                    ))}
                    {/* Cut edges: brackets that reach outward, so even a tiny cut's two edges can each be grabbed */}
                    {ordered.map((x, k) =>
                      (["start", "end"] as const).map((edge) => (
                        <span
                          key={`${x.id}-${edge}`}
                          role="slider"
                          aria-label={edge === "start" ? `Cut ${k + 1} starts` : `Cut ${k + 1} resumes`}
                          aria-valuenow={x[edge]}
                          tabIndex={0}
                          onPointerDown={(e) => {
                            grab(e, { kind: "sec", id: x.id, edge });
                            setSel(x.id);
                            seek(x[edge]);
                          }}
                          onKeyDown={(e) => {
                            const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
                            if (!d) return;
                            e.preventDefault();
                            setSel(x.id);
                            nudgeEdge(x, edge, d);
                          }}
                          className={`absolute inset-y-0 ${x.id === sel ? "z-30" : "z-20"} w-9 cursor-ew-resize touch-none outline-none`}
                          style={{ left: pct(x[edge]), transform: `translateX(${edge === "start" ? -30 : -6}px)` }}
                        >
                          <span className={`absolute inset-y-0 w-0.5 bg-rose-300 ${edge === "start" ? "right-[5px]" : "left-[5px]"}`} />
                          <span
                            className={`absolute bottom-2 h-9 w-3.5 border border-rose-100 bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,.7)] ${
                              edge === "start" ? "right-[6px] rounded-l-md" : "left-[6px] rounded-r-md"
                            }`}
                          />
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                <button type="button" onClick={() => setStartSafe(now())} className={smallBtn}>
                  Set start here
                </button>
                <button type="button" onClick={() => setStartSafe(start - FRAME)} className={nudgeBtn} aria-label="Start one frame earlier">
                  ◂
                </button>
                <button type="button" onClick={() => setStartSafe(start + FRAME)} className={nudgeBtn} aria-label="Start one frame later">
                  ▸
                </button>
                <span className="mx-1 h-4 w-px bg-white/10" />
                <button type="button" onClick={() => setEndSafe(now())} className={smallBtn}>
                  Set end here
                </button>
                <button type="button" onClick={() => setEndSafe(end - FRAME)} className={nudgeBtn} aria-label="End one frame earlier">
                  ◂
                </button>
                <button type="button" onClick={() => setEndSafe(end + FRAME)} className={nudgeBtn} aria-label="End one frame later">
                  ▸
                </button>
                <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-2 text-neutral-300 sm:ml-auto">
                  <input
                    type="checkbox"
                    checked={!keepPauses}
                    onChange={(e) => {
                      setKeepPauses(!e.target.checked);
                      setTouched(true);
                      setReset(false);
                    }}
                    className="accent-emerald-500"
                  />
                  Tighten pauses inside
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const auto = computeSegments({
                      transcript: { version: clip.version, durationS: duration, words, text: "" },
                      sourceS: duration,
                      settings,
                      overrides: timing,
                    }).segments;
                    setStart(auto[0]?.start ?? 0);
                    setEnd(auto[auto.length - 1]?.end ?? duration);
                    setCut(new Set());
                    setSections([]);
                    setSel(null);
                    setTouched(false);
                    setKeepPauses(false);
                    setReset(true);
                  }}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-neutral-500 hover:text-white"
                >
                  <SvgIcon d={SP.undo} size={12} /> Reset to auto
                </button>
              </div>
            </div>

            {/* Cut out a section */}
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.05] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-rose-500/90 px-4 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:bg-rose-500"
                >
                  ✂ Cut from playhead
                </button>
                {ordered.map((x, k) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      pause();
                      setSel(x.id === sel ? null : x.id);
                      if (x.id !== sel) seek(x.start);
                    }}
                    className={`min-h-9 rounded-full border px-3 text-[11px] font-bold ${x.id === sel ? "border-rose-300 bg-rose-500/30 text-white" : "border-rose-400/30 text-rose-200 hover:bg-rose-500/15"}`}
                    style={NUM_FONT}
                  >
                    ✂{k + 1} · {(x.end - x.start).toFixed(2)}s
                  </button>
                ))}
              </div>
              {!selected ? (
                <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
                  Something flubbed? Put the playhead where it goes wrong and tap <b className="text-rose-200">Cut from playhead</b>, then drag the red edges (or step frame by frame) to
                  where she picks back up. The video jumps straight from one edge to the other, mid-word if you like.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  <EdgeRow
                    label="Cut from"
                    value={selected.start}
                    onEarlier={() => nudgeEdge(selected, "start", -1)}
                    onLater={() => nudgeEdge(selected, "start", 1)}
                    onPlayhead={() => setEdge(selected.id, "start", now())}
                  />
                  <EdgeRow
                    label="Resume at"
                    value={selected.end}
                    onEarlier={() => nudgeEdge(selected, "end", -1)}
                    onLater={() => nudgeEdge(selected, "end", 1)}
                    onPlayhead={() => setEdge(selected.id, "end", now())}
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => hearJoin(selected)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-4 text-[11px] font-bold text-white"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
                      </svg>
                      Hear the join
                    </button>
                    <button type="button" onClick={() => removeSection(selected.id)} className="min-h-9 rounded-full px-3 text-[11px] font-semibold text-neutral-400 hover:bg-white/5 hover:text-white">
                      Keep this part (remove cut {numberOf(selected.id)})
                    </button>
                    <button type="button" onClick={() => setSel(null)} className="min-h-9 rounded-full px-3 text-[11px] font-semibold text-neutral-500 hover:text-white sm:ml-auto">
                      Done
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-500">The preview can hiccup at a join while the browser seeks. The finished clip is smooth.</p>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-neutral-400">Tap a word to</span>
                <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-bold">
                  {(
                    [
                      ["start", "Start here"],
                      ["end", "End here"],
                      ["cut", "Cut it"],
                    ] as const
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWordMode(m)}
                      className={`min-h-8 rounded-full px-3 ${wordMode === m ? (m === "cut" ? "bg-rose-500/80 text-white" : "bg-emerald-600 text-white") : "text-neutral-400 hover:text-white"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="hidden text-[11px] text-neutral-500 [@media(hover:hover)]:inline">· Alt-click a word to end there · ✕ cuts a single word</span>
              </div>
              {words.length === 0 ? (
                <p className="rounded-xl border border-white/10 px-3 py-3 text-xs text-neutral-500">No word timings for this take yet. Use the handles to trim.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {words.map((w, i) => {
                    const out = !inWindow(w, { start, end });
                    const isCut = cut.has(i);
                    const inCut = inSections(w, cleanSections);
                    const active = time >= w.start && time <= w.end;
                    return (
                      <span
                        key={i}
                        className={`group inline-flex items-center overflow-hidden rounded-lg border text-xs transition-colors ${
                          active
                            ? "border-cyan-300/60 bg-cyan-400/15"
                            : inCut
                              ? "border-rose-400/30 bg-rose-500/10"
                              : out || isCut
                                ? "border-white/5 bg-white/[0.02]"
                                : "border-white/10 bg-white/[0.05]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            const mode = e.altKey ? "end" : wordMode;
                            if (mode === "end") setEndSafe(Math.min(duration, w.end + TAIL));
                            else if (mode === "cut")
                              setCut((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                return next;
                              });
                            else setStartSafe(Math.max(0, w.start - LEAD));
                            pause();
                            seek(w.start);
                          }}
                          className={`min-h-8 px-2 py-1 ${inCut ? "text-rose-300/70 line-through" : out || isCut ? "text-neutral-600 line-through" : "text-neutral-100 hover:text-white"}`}
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
                          className={`min-h-8 border-l border-white/10 px-2 py-1 ${isCut ? "bg-rose-500/20 text-rose-200" : "text-neutral-400 hover:text-rose-300 group-hover:opacity-100 [@media(hover:hover)]:text-neutral-600 [@media(hover:hover)]:opacity-60"}`}
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
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-3 sm:px-5 sm:py-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {nothingLeft ? (
            <p className="text-xs font-semibold text-rose-300">Those cuts leave almost nothing of the clip. Keep at least a fraction of a second.</p>
          ) : (
            <p className="text-xs text-neutral-400" style={NUM_FONT}>
              Keeps <b className="text-white">{plan.keptS.toFixed(1)}s</b> of {duration.toFixed(1)}s → <b className="text-emerald-300">{after.toFixed(1)}s</b> at {settings.speed}×
              {cleanSections.length > 0 && (
                <span className="text-rose-200">
                  {" "}
                  · {cleanSections.length} cut{cleanSections.length > 1 ? "s" : ""}
                </span>
              )}
            </p>
          )}
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/5 sm:flex-none">
              Cancel
            </button>
            <button type="button" onClick={apply} disabled={saving || nothingLeft} className={`${CTA_CLASSES} flex-1 disabled:opacity-50 sm:flex-none`}>
              {saving ? "Applying…" : "Apply trim"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** One edge of the selected cut: its time, a frame earlier/later, or snap to the playhead. */
function EdgeRow({
  label,
  value,
  onEarlier,
  onLater,
  onPlayhead,
}: {
  label: string;
  value: number;
  onEarlier: () => void;
  onLater: () => void;
  onPlayhead: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="w-[4.5rem] shrink-0 font-semibold text-neutral-400">{label}</span>
      <span className="min-w-[4.25rem] font-bold text-rose-100" style={NUM_FONT}>
        {fmt(value)}
      </span>
      <button type="button" onClick={onEarlier} className="min-h-9 min-w-9 rounded-full bg-white/5 px-2 text-neutral-300 hover:bg-white/10 hover:text-white" aria-label={`${label}: one frame earlier`}>
        ◂
      </button>
      <button type="button" onClick={onLater} className="min-h-9 min-w-9 rounded-full bg-white/5 px-2 text-neutral-300 hover:bg-white/10 hover:text-white" aria-label={`${label}: one frame later`}>
        ▸
      </button>
      <button type="button" onClick={onPlayhead} className="min-h-9 rounded-full bg-white/5 px-3 font-semibold text-neutral-200 hover:bg-white/10">
        Set to playhead
      </button>
    </div>
  );
}
