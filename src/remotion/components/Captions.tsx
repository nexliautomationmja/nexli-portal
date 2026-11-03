import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { Anchor, CaptionStyle, CaptionWord } from "../types";
import { BRAND, FB_SAFE_BOTTOM, JAKARTA, OUTFIT, isMoney } from "../theme";

/**
 * Karaoke captions, universal across rigs (rulebook § Captions):
 * 3-word chunks, Outfit 800 ALL CAPS, active word in the brand gradient,
 * past words solid white, future words white at 50%, money in green, and a
 * bottom scrim behind them.
 *
 * `look` is the user's own caption style from the edit card. Every field is
 * opt-in by absence: with no look, the output is the rulebook's captions.
 */

const KEEP_CASE = new Set(["CPA", "IRS", "CEO", "LLC", "ROI", "AI", "USA", "US", "OK", "P&L", "FAQ", "SEO", "CRM", "PPC", "TV"]);
const SPECIAL: Record<string, string> = { CPAS: "CPAs", "CPA'S": "CPA's", CEOS: "CEOs" };

/** A stored ALL CAPS token in the chosen case; acronyms, figures and "I" stay right. */
export function displayWord(w: string, mode: CaptionStyle["case"]): string {
  if (!mode || mode === "caps") return w;
  if (SPECIAL[w]) return SPECIAL[w];
  if (KEEP_CASE.has(w) || /[\d$%]/.test(w)) return w;
  if (/^I(?:'|$)/.test(w)) return `I${w.slice(1).toLowerCase()}`;
  const lower = w.toLowerCase();
  return mode === "title" ? lower.replace(/(^|-)([a-z])/g, (_m, pre: string, c: string) => `${pre}${c.toUpperCase()}`) : lower;
}

const HIGHLIGHT: Record<string, string> = { green: BRAND.money, yellow: "#FACC15" };

export const Captions: React.FC<{ words: CaptionWord[]; size: number; vertical: boolean; at?: Anchor; look?: CaptionStyle }> = ({
  words,
  size,
  vertical,
  at,
  look,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const per = look?.perLine ?? 3;
  const chunks: CaptionWord[][] = [];
  for (let i = 0; i < words.length; i += per) chunks.push(words.slice(i, i + per));
  const idx = chunks.findIndex((c, i) => {
    const next = chunks[i + 1];
    return t >= c[0].start - 0.05 && (next ? t < next[0].start - 0.05 : t <= c[c.length - 1].end + 0.6);
  });
  const chunk = idx >= 0 ? chunks[idx] : null;
  const fontSize = look?.scale ? Math.round(size * look.scale) : size;

  // Vertical: sit on the bottom of the safe band. Landscape: lower third.
  const bottom = vertical ? height - FB_SAFE_BOTTOM + 40 : 90;

  // Hand-placed: the block is centred on the anchor and the scrim moves with it.
  const box = width - 120;
  const position: React.CSSProperties = at
    ? { left: at.x * width - box / 2, width: box, top: at.y * height, transform: "translateY(-50%)" }
    : { left: 60, right: 60, bottom };
  const gap = `0 ${Math.round(fontSize * 0.28)}px`;

  const spans = chunk?.map((w, i) => {
    const active = t >= w.start && t < w.end + 0.08;
    const past = !active && t >= w.end;
    const money = isMoney(w.word);
    const highlight = look?.highlight;
    let style: React.CSSProperties;
    if (active && highlight === "none") style = { color: money ? BRAND.money : "#ffffff" };
    else if (active && highlight && HIGHLIGHT[highlight]) style = { color: money ? BRAND.money : HIGHLIGHT[highlight] };
    else
      style = active
        ? money
          ? { color: BRAND.money }
          : { backgroundImage: BRAND.gradient, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", textShadow: "none", filter: "drop-shadow(0 4px 14px rgba(0,0,0,.5))" }
        : { color: money ? BRAND.money : "#ffffff", opacity: past ? 1 : 0.5 };
    return (
      <span key={`${w.start}-${i}`} style={style}>
        {displayWord(w.word, look?.case)}
      </span>
    );
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {look?.box ? null : at ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: at.y * height - fontSize * 3,
            height: fontSize * 6,
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
            gap,
            fontFamily: look?.font === "jakarta" ? JAKARTA : OUTFIT,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.12,
            textTransform: look?.case && look.case !== "caps" ? "none" : "uppercase",
            letterSpacing: "-0.01em",
            textShadow: "0 4px 18px rgba(0,0,0,0.55)",
          }}
        >
          {look?.box ? (
            <div
              style={{
                display: "inline-flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap,
                maxWidth: "100%",
                padding: `${Math.round(fontSize * 0.28)}px ${Math.round(fontSize * 0.45)}px`,
                borderRadius: Math.round(fontSize * 0.35),
                background: "rgba(10, 14, 30, 0.82)",
                textShadow: "none",
              }}
            >
              {spans}
            </div>
          ) : (
            spans
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
