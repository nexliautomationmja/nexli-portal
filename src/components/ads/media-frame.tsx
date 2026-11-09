"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { CANVAS_VARS } from "@/components/creative-studio/canvas";
import { Ico } from "@/components/ads/parts";

/**
 * A creative at its real shape — never cropped. A 9:16 video shows full
 * height (≈62% of a phone screen, 540px on larger screens); images keep their
 * own ratio. Videos are mounted near the viewport and play muted while mostly
 * on screen (at most four at once; never with reduced motion or data saver);
 * tap opens it full size with sound.
 */

const playing = new Set<HTMLVideoElement>();
const MAX_PLAYING = 4;

function noAutoplay(): boolean {
  if (typeof window === "undefined") return true;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return Boolean(reduce || saveData);
}

const COMMON: [number, string][] = [
  [9 / 16, "9:16"],
  [2 / 3, "2:3"],
  [3 / 4, "3:4"],
  [4 / 5, "4:5"],
  [1, "1:1"],
  [1.91, "1.91:1"],
  [16 / 9, "16:9"],
];
export function ratioLabel(r: number): string {
  const hit = COMMON.find(([v]) => Math.abs(v - r) / v < 0.04);
  return hit ? hit[1] : r < 1 ? `${(1 / r).toFixed(2)}:1 tall` : `${r.toFixed(2)}:1`;
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function MediaFrame({
  kind,
  src,
  videoUrl,
  known,
  trustImage = false,
  backdrop = true,
  onOpen,
  label,
  children,
}: {
  kind: "video" | "image";
  /** Poster or image. */
  src: string | null;
  videoUrl?: string | null;
  /** Exact size when we already know it (screenshots). */
  known?: { w: number; h: number } | null;
  /** True for full-size stills; false for Meta's small square thumbnails (their shape can't be trusted). */
  trustImage?: boolean;
  backdrop?: boolean;
  onOpen?: () => void;
  label: string;
  /** Overlay badges. */
  children?: React.ReactNode;
}) {
  const box = useRef<HTMLButtonElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  // Without IntersectionObserver (very old browsers) the video just mounts.
  const [near, setNear] = useState(() => typeof window !== "undefined" && typeof IntersectionObserver === "undefined");
  const [measured, setMeasured] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Mount the video only when the card is close to the screen.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const showVideo = kind === "video" && Boolean(videoUrl) && !videoFailed && near;

  // Play muted while ≥ 60% visible; pause otherwise.
  useEffect(() => {
    const v = vid.current;
    if (!v || !showVideo || noAutoplay() || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.6) {
          if (playing.size >= MAX_PLAYING) {
            const oldest = playing.values().next().value as HTMLVideoElement | undefined;
            oldest?.pause();
            if (oldest) playing.delete(oldest);
          }
          v.play()
            .then(() => playing.add(v))
            .catch(() => {});
        } else {
          v.pause();
          playing.delete(v);
        }
      },
      { threshold: [0, 0.6] }
    );
    io.observe(v);
    return () => {
      io.disconnect();
      v.pause();
      playing.delete(v);
    };
  }, [showVideo]);

  const ratio = known ? known.w / known.h : (measured ?? (kind === "video" ? 9 / 16 : 4 / 5));
  const r = Math.max(0.5, Math.min(1.91, ratio));
  const contain = trustImage || Boolean(known) || showVideo;

  return (
    <button
      ref={box}
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="group relative mx-auto block overflow-hidden rounded-xl bg-black [--mh:62svh] sm:[--mh:540px]"
      style={{ aspectRatio: String(r), width: `min(100%, calc(var(--mh) * ${r.toFixed(4)}))` }}
    >
      {backdrop && src && (
        // eslint-disable-next-line @next/next/no-img-element -- blurred backdrop of the same still
        <img src={src} alt="" aria-hidden="true" referrerPolicy="no-referrer" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
      )}
      {showVideo ? (
        <video
          ref={vid}
          key={videoUrl ?? "v"}
          src={videoUrl ?? undefined}
          poster={src ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setMeasured(v.videoWidth / v.videoHeight);
            if (Number.isFinite(v.duration)) setDuration(v.duration);
          }}
          onError={() => setVideoFailed(true)}
          className="relative h-full w-full object-contain"
        />
      ) : src && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- Meta CDN / signed storage still
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const i = e.currentTarget;
            if (trustImage && !known && i.naturalWidth && i.naturalHeight) setMeasured(i.naturalWidth / i.naturalHeight);
          }}
          onError={() => setImgFailed(true)}
          className={`relative h-full w-full ${contain ? "object-contain" : "object-cover"}`}
        />
      ) : (
        <span className="relative flex h-full w-full items-center justify-center text-neutral-600">
          <Ico d={<path d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6" />} size={26} />
        </span>
      )}
      {children}
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-sm" style={NUM_FONT}>
        {kind === "video" ? "▶ " : ""}
        {ratioLabel(r)}
        {duration ? ` · ${clock(duration)}` : ""}
      </span>
      {onOpen && (
        <span className="pointer-events-none absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/90 opacity-80 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <Ico d={<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />} size={12} />
        </span>
      )}
    </button>
  );
}

/** Full-size viewer: video with sound and controls (muted with controls if the browser blocks sound). */
export function MediaLightbox({
  title,
  badge,
  kind,
  src,
  videoUrl,
  side,
  onClose,
}: {
  title: string;
  badge?: React.ReactNode;
  kind: "video" | "image";
  src: string | null;
  videoUrl?: string | null;
  side?: React.ReactNode;
  onClose: () => void;
}) {
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, [videoUrl]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/85 sm:items-center sm:p-6" style={CANVAS_VARS} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="flex max-h-[100dvh] w-full flex-col overflow-hidden border border-white/10 bg-[#0b1220] text-white sm:max-h-[92dvh] sm:max-w-4xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          {badge}
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{title}</p>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <Ico d={<path d="M18 6 6 18M6 6l12 12" />} size={18} />
          </button>
        </div>
        <div className="cs-scroll grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="flex items-start justify-center overflow-hidden rounded-2xl bg-black">
            {kind === "video" && videoUrl ? (
              <video ref={vid} src={videoUrl} poster={src ?? undefined} controls playsInline className="max-h-[70dvh] w-auto max-w-full object-contain" />
            ) : src ? (
              // eslint-disable-next-line @next/next/no-img-element -- full-size still
              <img src={src} alt="" referrerPolicy="no-referrer" className="max-h-[70dvh] w-auto max-w-full object-contain" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-sm text-neutral-500">No preview</div>
            )}
          </div>
          {side && <div className="space-y-3 text-sm">{side}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}
