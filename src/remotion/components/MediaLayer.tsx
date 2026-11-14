import React from "react";
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { MediaCue, MediaTrack } from "../types";
import { FB_SAFE_TOP } from "../theme";

/**
 * Clips on screen: each cue shows one uploaded clip over the plate while the
 * presenter keeps talking (the plate's sound carries on; clips are muted).
 * • full — the clip fills the frame;
 * • split — the clip on the top half (left for a VSL), the presenter on the
 *   other half;
 * • corner — the clip fills the frame, the presenter in a rounded bubble.
 * In split and corner the presenter is a muted copy of the cut at the same
 * moment. Rigs draw this right after the plate, so captions and text
 * overlays stay on top.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const COVER: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
/** Fade in and out (seconds). */
const EASE = 0.15;

/** The clip for one cue: plays its part, then holds the last frame if the line runs longer. */
const ClipVideo: React.FC<{ src: string; cue: MediaCue; fps: number; total: number; style: React.CSSProperties }> = ({ src, cue, fps, total, style }) => {
  const play = Math.max(1, Math.min(total, Math.round((cue.to - cue.from) * fps)));
  const startAt = Math.round(cue.from * fps);
  return (
    <>
      <Sequence durationInFrames={play} layout="none">
        <OffthreadVideo src={src} muted trimBefore={startAt} style={style} />
      </Sequence>
      {play < total && (
        <Sequence from={play} durationInFrames={total - play} layout="none">
          <Freeze frame={0}>
            <OffthreadVideo src={src} muted trimBefore={Math.max(startAt, startAt + play - 1)} style={style} />
          </Freeze>
        </Sequence>
      )}
    </>
  );
};

/** The presenter during a split / corner cue: the cut at the same moment, muted (the plate is heard). */
const PresenterCopy: React.FC<{ src: string; startFrame: number; style: React.CSSProperties }> = ({ src, startFrame, style }) => (
  <OffthreadVideo src={src} muted trimBefore={startFrame} style={style} />
);

const Cue: React.FC<{ cue: MediaCue; src: string; plateSrc: string; vertical: boolean; total: number }> = ({ cue, src, plateSrc, vertical, total }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ease = Math.max(1, Math.round(EASE * fps));
  const opacity = total > ease * 2 ? interpolate(frame, [0, ease, total - ease, total], [0, 1, 1, 0], clamp) : 1;
  const startFrame = Math.round(cue.start * fps);

  if (cue.layout === "split") {
    // Vertical: clip on top, presenter below (cropped to the face's usual height). VSL: side by side.
    const clipBox: React.CSSProperties = vertical
      ? { position: "absolute", left: 0, top: 0, width, height: height / 2 }
      : { position: "absolute", left: 0, top: 0, width: width / 2, height };
    const meBox: React.CSSProperties = vertical
      ? { position: "absolute", left: 0, top: height / 2, width, height: height / 2 }
      : { position: "absolute", left: width / 2, top: 0, width: width / 2, height };
    return (
      <AbsoluteFill style={{ opacity, background: "#000" }}>
        <div style={{ ...clipBox, overflow: "hidden", background: "#000" }}>
          <ClipVideo src={src} cue={cue} fps={fps} total={total} style={{ ...COVER, objectFit: "contain" }} />
        </div>
        <div style={{ ...meBox, overflow: "hidden" }}>
          <PresenterCopy src={plateSrc} startFrame={startFrame} style={{ ...COVER, objectPosition: vertical ? "50% 30%" : "50% 50%" }} />
        </div>
        <div style={{ position: "absolute", left: 0, ...(vertical ? { top: height / 2 - 2, width, height: 4 } : { top: 0, left: width / 2 - 2, width: 4, height }), background: "rgba(255,255,255,0.9)" }} />
      </AbsoluteFill>
    );
  }

  const bubble =
    cue.layout === "corner"
      ? (() => {
          const w = Math.round(width * (vertical ? 0.34 : 0.22));
          const h = Math.round(w * (vertical ? 1.25 : 0.9));
          return { left: width - 40 - w, top: vertical ? FB_SAFE_TOP + 24 : 40, width: w, height: h };
        })()
      : null;
  return (
    <AbsoluteFill style={{ opacity, background: "#000" }}>
      <ClipVideo src={src} cue={cue} fps={fps} total={total} style={COVER} />
      {bubble && (
        <div
          style={{
            position: "absolute",
            ...bubble,
            borderRadius: Math.round(bubble.width * 0.12),
            overflow: "hidden",
            border: `${vertical ? 5 : 4}px solid rgba(255,255,255,0.92)`,
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            background: "#000",
          }}
        >
          <PresenterCopy src={plateSrc} startFrame={startFrame} style={{ ...COVER, objectPosition: "50% 30%" }} />
        </div>
      )}
    </AbsoluteFill>
  );
};

export const MediaLayer: React.FC<{ media: MediaTrack; plateSrc: string; vertical: boolean }> = ({ media, plateSrc, vertical }) => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {media.cues.map((cue, i) => {
        const clip = media.clips[cue.clip];
        if (!clip?.src) return null;
        const from = Math.max(0, Math.round(cue.start * fps));
        const total = Math.min(durationInFrames - from, Math.round((cue.end - cue.start) * fps));
        if (total <= 0) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={total} premountFor={fps}>
            <Cue cue={cue} src={clip.src} plateSrc={plateSrc} vertical={vertical} total={total} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
