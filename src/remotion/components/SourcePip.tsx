import React from "react";
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Anchor, CaptionStyle, PipSize, PipTrack, PipWindow } from "../types";
import { FPS } from "../types";
import { FB_SAFE_TOP, POP } from "../theme";
import { Captions } from "./Captions";

/**
 * A reaction video's corner video: the video the presenter reacts to, in a
 * card in the top-right corner. It plays (with its own sound) inside its
 * windows and is paused on a frame everywhere else: before the first window
 * on the first frame she'll watch, after each one on the last frame she saw.
 * Rigs draw it right after the plate, so text overlays stay on top.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Width of the card as a share of the frame: by the video's shape and the size picked. */
const SHARE: Record<"portrait" | "square" | "landscape", Record<"vertical" | "landscape", Record<PipSize, number>>> = {
  portrait: { vertical: { s: 0.3, m: 0.38, l: 0.46 }, landscape: { s: 0.16, m: 0.2, l: 0.24 } },
  square: { vertical: { s: 0.36, m: 0.44, l: 0.52 }, landscape: { s: 0.2, m: 0.25, l: 0.3 } },
  landscape: { vertical: { s: 0.46, m: 0.56, l: 0.66 }, landscape: { s: 0.26, m: 0.32, l: 0.38 } },
};

/**
 * Where the card sits, in pixels. Default: top-right, inside the 4:5 feed
 * crop (vertical), below the title banner when the edit has one, and clear
 * of the captions. Placed by hand: centred on the anchor, kept on the frame.
 */
export function pipBox(pip: Pick<PipTrack, "aspect" | "size">, width: number, height: number, vertical: boolean, titled: boolean, at?: Anchor) {
  const aspect = pip.aspect > 0 && Number.isFinite(pip.aspect) ? pip.aspect : 9 / 16;
  const shape = aspect < 0.85 ? "portrait" : aspect <= 1.2 ? "square" : "landscape";
  let w = width * SHARE[shape][vertical ? "vertical" : "landscape"][pip.size ?? "m"];
  let h = w / aspect;
  const margin = 40;
  const top = vertical ? FB_SAFE_TOP + (titled ? 170 : 24) : titled ? 170 : margin;
  // Bottom limit: above the captions (vertical: their band starts near y 1080).
  const maxH = (vertical ? 1060 : height - 200) - top;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  if (at) {
    const left = Math.min(width - w, Math.max(0, at.x * width - w / 2));
    const y = Math.min(height - h, Math.max(0, at.y * height - h / 2));
    return { left, top: y, width: w, height: h };
  }
  return { left: width - margin - w, top, width: w, height: h };
}

type Segment = { from: number; dur: number; play: boolean; at: number };

/** The card's timeline in frames: playing parts, and paused holds around them. */
export function pipSegments(windows: PipWindow[], fps: number, total: number): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  let holdAt = windows[0]?.from ?? 0;
  for (const w of windows) {
    const s = Math.max(cursor, Math.round(w.start * fps));
    const e = Math.min(total, Math.round(w.end * fps));
    if (e <= s) continue;
    if (s > cursor) out.push({ from: cursor, dur: s - cursor, play: false, at: holdAt });
    const played = Math.min(e - s, Math.max(0, Math.round((w.to - w.from) * fps)));
    if (played > 0) out.push({ from: s, dur: played, play: true, at: w.from });
    // The last frame shown (one frame before the end, so the hold never asks for a frame past the video).
    const last = w.from + Math.max(0, played - 1) / fps;
    if (e > s + played) out.push({ from: s + played, dur: e - (s + played), play: false, at: last });
    holdAt = last;
    cursor = e;
  }
  if (total > cursor) out.push({ from: cursor, dur: total - cursor, play: false, at: holdAt });
  return out;
}

const RAMP = 0.15;

/** The presenter's track goes quiet inside the windows (only the corner video is heard there). */
export function plateVolume(windows: PipWindow[]): (frame: number) => number {
  return (frame: number) => {
    const t = frame / FPS;
    let v = 1;
    for (const w of windows) {
      if (t < w.start || t > w.end || w.end - w.start <= RAMP * 2) continue;
      v = Math.min(v, interpolate(t, [w.start, w.start + RAMP, w.end - RAMP, w.end], [1, 0, 0, 1], clamp));
    }
    return v;
  };
}

/** The windows, as spans where the presenter's captions pause. */
export const pipSpans = (pip: PipTrack) => pip.windows.map((w) => ({ start: w.start, end: w.end }));

/** Everywhere outside the windows (where the corner video's own captions are hidden). */
export function pipGaps(pip: PipTrack, durationS: number) {
  const out: { start: number; end: number }[] = [];
  let t = 0;
  for (const w of pip.windows) {
    if (w.start > t) out.push({ start: t, end: w.start });
    t = Math.max(t, w.end);
  }
  out.push({ start: t, end: Math.max(t, durationS) + 1 });
  return out;
}

const FILL: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

const PauseBadge: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      position: "absolute",
      left: size * 0.4,
      top: size * 0.4,
      width: size,
      height: size,
      borderRadius: size,
      background: "rgba(10, 14, 30, 0.62)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: size * 0.14,
    }}
  >
    <div style={{ width: size * 0.13, height: size * 0.42, borderRadius: 3, background: "#fff" }} />
    <div style={{ width: size * 0.13, height: size * 0.42, borderRadius: 3, background: "#fff" }} />
  </div>
);

export const SourcePip: React.FC<{ pip: PipTrack; vertical: boolean; titled: boolean; at?: Anchor }> = ({ pip, vertical, titled, at }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  if (!pip.src) return null;
  const box = pipBox(pip, width, height, vertical, titled, at);
  const segments = pipSegments(pip.windows, fps, durationInFrames);
  const playing = segments.some((g) => g.play && frame >= g.from && frame < g.from + g.dur);
  const fade = Math.round(0.1 * fps);
  const pop = spring({ frame, fps, config: POP });
  const radius = Math.round(Math.min(box.width, box.height) * 0.07);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          borderRadius: radius,
          overflow: "hidden",
          background: "#000",
          border: `${vertical ? 5 : 4}px solid rgba(255,255,255,0.92)`,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          opacity: Math.min(1, pop * 1.2),
          transform: `scale(${0.9 + 0.1 * pop})`,
          transformOrigin: "100% 0%",
        }}
      >
        {segments.map((g, i) => (
          <Sequence key={i} from={g.from} durationInFrames={g.dur} premountFor={fps}>
            {g.play ? (
              <OffthreadVideo
                src={pip.src}
                trimBefore={Math.round(g.at * fps)}
                volume={(f) => (g.dur > fade * 2 + 1 ? interpolate(f, [0, fade, g.dur - fade, g.dur], [0, 1, 1, 0], clamp) : 1)}
                style={FILL}
              />
            ) : (
              <Freeze frame={0}>
                <OffthreadVideo src={pip.src} muted trimBefore={Math.round(g.at * fps)} style={FILL} />
              </Freeze>
            )}
          </Sequence>
        ))}
        {!playing && <PauseBadge size={Math.round(Math.max(36, box.width * 0.12))} />}
      </div>
    </AbsoluteFill>
  );
};

/** The corner video's own words, captioned while it plays (same look and spot as the presenter's). */
export const SourceCaptions: React.FC<{
  pip: PipTrack;
  durationS: number;
  size: number;
  vertical: boolean;
  at?: Anchor;
  look?: CaptionStyle;
}> = ({ pip, durationS, size, vertical, at, look }) =>
  pip.captions !== false && pip.words?.length ? (
    <Captions words={pip.words} size={size} vertical={vertical} at={at} look={look} hide={pipGaps(pip, durationS)} scrim={false} />
  ) : null;
