"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "./use-voice-recorder";

export type BubbleTone = "mine" | "theirs";

function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function PauseGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
    </svg>
  );
}

/**
 * Compact audio player for voice notes: play/pause, a seekable progress bar
 * and current/total time. `durationMs` is a fallback for recordings whose
 * container doesn't report a duration (Chrome's MediaRecorder webm reports
 * Infinity until fully played).
 */
export function VoicePlayer({
  src,
  durationMs,
  tone = "theirs",
  className = "",
}: {
  src: string;
  durationMs?: number | null;
  tone?: BubbleTone;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [metaDuration, setMetaDuration] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const fallback = durationMs && durationMs > 0 ? durationMs / 1000 : 0;
  const total = metaDuration && Number.isFinite(metaDuration) && metaDuration > 0 ? metaDuration : fallback;
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setMetaDuration(Number.isFinite(a.duration) ? a.duration : null);
    const onTime = () => setCurrent(a.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      if (Number.isFinite(a.duration)) setMetaDuration(a.duration);
    };
    const onError = () => {
      setFailed(true);
      setPlaying(false);
    };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [src]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // Only one voice note plays at a time.
      document.querySelectorAll<HTMLAudioElement>("audio[data-voice-note]").forEach((el) => {
        if (el !== a && !el.paused) el.pause();
      });
      a.play().catch(() => setFailed(true));
    } else {
      a.pause();
    }
  }

  function seek(clientX: number, el: HTMLElement) {
    const a = audioRef.current;
    if (!a || total <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    try {
      a.currentTime = ratio * total;
      setCurrent(ratio * total);
    } catch {
      // not seekable yet
    }
  }

  const mine = tone === "mine";
  const btnStyle = mine
    ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
    : { background: "linear-gradient(135deg, #2563EB, #06B6D4)", color: "#fff" };
  const trackBg = mine ? "rgba(255,255,255,0.3)" : "var(--card-border)";
  const fillBg = mine ? "#fff" : "#06B6D4";
  const timeColor = mine ? "rgba(255,255,255,0.8)" : "var(--text-muted)";

  return (
    <div className={`flex items-center gap-3 min-w-[200px] ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" data-voice-note="" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50"
        style={btnStyle}
      >
        {playing ? <PauseGlyph className="w-4 h-4" /> : <PlayGlyph className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(current)}
          className="relative h-5 flex items-center cursor-pointer touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            seek(e.clientX, e.currentTarget);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1 || e.pointerType === "touch") {
              if (e.currentTarget.hasPointerCapture?.(e.pointerId)) seek(e.clientX, e.currentTarget);
            }
          }}
          onKeyDown={(e) => {
            const a = audioRef.current;
            if (!a || total <= 0) return;
            if (e.key === "ArrowRight") a.currentTime = Math.min(total, a.currentTime + 5);
            if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 5);
          }}
        >
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: trackBg }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fillBg }} />
          </div>
          <div
            className="absolute w-3 h-3 rounded-full -translate-x-1/2 shadow"
            style={{ left: `${pct}%`, background: fillBg }}
          />
        </div>
        <div className="flex justify-between text-[10px] tabular-nums" style={{ color: timeColor }}>
          <span>{formatClock(current * 1000)}</span>
          <span>{failed ? "Can't play" : total > 0 ? formatClock(total * 1000) : "--:--"}</span>
        </div>
      </div>
    </div>
  );
}
