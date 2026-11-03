import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { Anchor, CaptionWord } from "../types";
import { BRAND, FB_SAFE_BOTTOM, OUTFIT, isMoney } from "../theme";

/**
 * Karaoke captions, universal across rigs (rulebook § Captions):
 * 3-word chunks, Outfit 800 ALL CAPS, active word in the brand gradient,
 * past words solid white, future words white at 50%, money in green, and a
 * bottom scrim behind them.
 */
export const Captions: React.FC<{ words: CaptionWord[]; size: number; vertical: boolean; at?: Anchor }> = ({ words, size, vertical, at }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const chunks: CaptionWord[][] = [];
  for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3));
  const idx = chunks.findIndex((c, i) => {
    const next = chunks[i + 1];
    return t >= c[0].start - 0.05 && (next ? t < next[0].start - 0.05 : t <= c[c.length - 1].end + 0.6);
  });
  const chunk = idx >= 0 ? chunks[idx] : null;

  // Vertical: sit on the bottom of the safe band. Landscape: lower third.
  const bottom = vertical ? height - FB_SAFE_BOTTOM + 40 : 90;

  // Hand-placed: the block is centred on the anchor and the scrim moves with it.
  const box = width - 120;
  const position: React.CSSProperties = at
    ? { left: at.x * width - box / 2, width: box, top: at.y * height, transform: "translateY(-50%)" }
    : { left: 60, right: 60, bottom };

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {at ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: at.y * height - size * 3,
            height: size * 6,
            background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.45), rgba(0,0,0,0))",
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            top: "auto",
            height: vertical ? 760 : 380,
            background: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))",
          }}
        />
      )}
      {chunk && (
        <div
          style={{
            position: "absolute",
            ...position,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: `0 ${Math.round(size * 0.28)}px`,
            fontFamily: OUTFIT,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.12,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            textShadow: "0 4px 18px rgba(0,0,0,0.55)",
          }}
        >
          {chunk.map((w, i) => {
            const active = t >= w.start && t < w.end + 0.08;
            const past = !active && t >= w.end;
            const money = isMoney(w.word);
            const style: React.CSSProperties = active
              ? money
                ? { color: BRAND.money }
                : { backgroundImage: BRAND.gradient, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", textShadow: "none", filter: "drop-shadow(0 4px 14px rgba(0,0,0,.5))" }
              : { color: money ? BRAND.money : "#ffffff", opacity: past ? 1 : 0.5 };
            return (
              <span key={`${w.start}-${i}`} style={style}>
                {w.word}
              </span>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
