import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Anchor, LadderRung, TimedText, VslCard } from "../types";
import { BRAND, FB_SAFE_TOP, JAKARTA, OUTFIT, isMoney } from "../theme";
import { Pop } from "./Pop";

/**
 * A hand-placed element: a `box`-wide row centred on the anchor, the element
 * centred inside it — the same geometry as the default full-width rows, just
 * moved. Only used when the user placed the element (absence = default).
 */
export function placed(at: Anchor, box: number, width: number, height: number): React.CSSProperties {
  return {
    position: "absolute",
    left: at.x * width - box / 2,
    top: at.y * height,
    width: box,
    transform: "translateY(-50%)",
    display: "flex",
    justifyContent: "center",
  };
}

/**
 * A hand-set text size: the whole box scales (line breaks stay), from its
 * top edge in its default slot or from its centre when placed by hand.
 * No scale (or 1) = no transform at all, so untouched edits render as before.
 */
function sized(scale: number | undefined, at: Anchor | undefined, defaultOrigin = "50% 0%"): React.CSSProperties {
  return scale && scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: at ? "50% 50%" : defaultOrigin } : {};
}

/** Money tokens inside a line render green (rulebook: money / positive). */
const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\s+)/).map((part, i) =>
      /\s+/.test(part) ? part : <span key={i} style={isMoney(part.replace(/[^\w$%,.]/g, "")) ? { color: BRAND.money } : undefined}>{part}</span>
    )}
  </>
);

/** Solo / ladder: the one title banner, at the top of the safe band. */
export const TitleBanner: React.FC<{ title: TimedText; vertical: boolean; at?: Anchor; scale?: number }> = ({ title, vertical, at, scale }) => {
  const { width, height } = useVideoConfig();
  return (
  <Pop
    start={title.start}
    end={title.end}
    from="up"
    style={
      at
        ? placed(at, width, width, height)
        : {
            position: "absolute",
            top: vertical ? FB_SAFE_TOP + 18 : 40,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }
    }
  >
    <div
      style={{
        maxWidth: vertical ? 940 : 1100,
        padding: vertical ? "18px 30px" : "14px 26px",
        borderRadius: 22,
        background: "#ffffff",
        color: "#0a0e1e",
        fontFamily: OUTFIT,
        fontWeight: 800,
        fontSize: vertical ? 50 : 44,
        lineHeight: 1.08,
        textTransform: "uppercase",
        textAlign: "center",
        letterSpacing: "-0.01em",
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        ...sized(scale, at),
      }}
    >
      {title.text}
    </div>
  </Pop>
  );
};

/** Red qualifier band — bottom chrome slot (above the captions). */
export const QualifierBand: React.FC<{ q: TimedText; vertical: boolean; at?: Anchor; scale?: number }> = ({ q, vertical, at, scale }) => {
  const { width, height } = useVideoConfig();
  return (
  <Pop start={q.start} end={q.end} style={at ? placed(at, width, width, height) : { position: "absolute", left: 0, right: 0, top: vertical ? 960 : undefined, bottom: vertical ? undefined : 230, display: "flex", justifyContent: "center" }}>
    <div
      style={{
        maxWidth: vertical ? 900 : 1000,
        padding: "16px 30px",
        borderRadius: 16,
        background: BRAND.qualifier,
        color: "#ffffff",
        fontFamily: OUTFIT,
        fontWeight: 800,
        fontSize: vertical ? 40 : 36,
        lineHeight: 1.12,
        textTransform: "uppercase",
        textAlign: "center",
        boxShadow: "0 14px 40px rgba(153,27,27,0.45)",
        ...sized(scale, at, vertical ? "50% 0%" : "50% 100%"),
      }}
    >
      {q.text}
    </div>
  </Pop>
  );
};

/** CTA with a directional cue instead of a redundant subline. */
export const CtaCard: React.FC<{ cta: TimedText; vertical: boolean; at?: Anchor; scale?: number }> = ({ cta, vertical, at, scale }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const bob = Math.sin((frame / fps) * Math.PI * 2 * 1.2) * 8;
  return (
    <Pop start={cta.start} end={cta.end} style={at ? placed(at, width, width, height) : { position: "absolute", left: 0, right: 0, top: vertical ? 960 : undefined, bottom: vertical ? undefined : 230, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 28px", borderRadius: 18, background: BRAND.panel, border: "2px solid rgba(6,182,212,0.6)", color: "#fff", fontFamily: OUTFIT, fontWeight: 800, fontSize: vertical ? 42 : 36, textTransform: "uppercase", ...sized(scale, at, vertical ? "50% 0%" : "50% 100%") }}>
        <span>{cta.text}</span>
        <span style={{ display: "inline-block", transform: `translateY(${bob}px)`, backgroundImage: BRAND.gradient, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontSize: vertical ? 52 : 44 }}>↓</span>
      </div>
    </Pop>
  );
};

const RUNG_X: Record<number, Record<LadderRung["position"], number>> = {
  2: { LEFT: 0.3, CENTER: 0.5, RIGHT: 0.7 },
  3: { LEFT: 0.2, CENTER: 0.5, RIGHT: 0.8 },
};

/** Ladder: a price/outcome pill and a client-type tag over each person. */
export const LadderRungs: React.FC<{ rungs: LadderRung[]; width: number }> = ({ rungs, width }) => {
  const count = rungs.length >= 3 ? 3 : 2;
  return (
    <>
      {rungs.map((r, i) => {
        const x = width * (RUNG_X[count][r.position] ?? 0.5) + (r.nudgeX ?? 0);
        return (
          <React.Fragment key={`${r.position}-${i}`}>
            <Pop start={r.start + i * 0.12} end={r.end} style={{ position: "absolute", top: FB_SAFE_TOP + 150, left: x, transform: "translateX(-50%)" }}>
              <div style={{ padding: "10px 22px", borderRadius: 999, background: BRAND.panel, border: "2px solid rgba(34,197,94,0.55)", color: BRAND.money, fontFamily: OUTFIT, fontWeight: 800, fontSize: 44, whiteSpace: "nowrap", boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>
                {r.pill}
              </div>
            </Pop>
            <Pop start={r.start + 0.3 + i * 0.12} end={r.end} style={{ position: "absolute", top: 820, left: x, transform: "translateX(-50%)" }}>
              <div style={{ padding: "8px 16px", borderRadius: 10, background: "#ffffff", color: "#0a0e1e", fontFamily: OUTFIT, fontWeight: 800, fontSize: 26, textTransform: "uppercase", textAlign: "center", lineHeight: 1.05, maxWidth: 300 }}>
                {r.tag}
              </div>
            </Pop>
          </React.Fragment>
        );
      })}
    </>
  );
};

/** POV: Instagram's own white text-sticker idiom — no brand palette, no dark glass. */
export const PovSticker: React.FC<{ s: TimedText; at?: Anchor; scale?: number }> = ({ s, at, scale }) => {
  const { width, height } = useVideoConfig();
  return (
  <Pop start={s.start} end={s.end} style={at ? placed(at, width, width, height) : { position: "absolute", top: FB_SAFE_TOP + 90, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
    <div style={{ maxWidth: 860, padding: "16px 26px", borderRadius: 18, background: "#ffffff", color: "#000000", fontFamily: JAKARTA, fontWeight: 800, fontSize: 46, lineHeight: 1.15, textAlign: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.18)", ...sized(scale, at) }}>
      {s.text}
    </div>
  </Pop>
  );
};

/** VSL left column: one slot, cards sequenced; fit-content with a 500px ceiling. */
export const VslCardView: React.FC<{ card: VslCard; at?: Anchor; scale?: number }> = ({ card, at, scale }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const glow = interpolate(Math.sin(t * 3), [-1, 1], [0.35, 0.6]);
  const base: React.CSSProperties = {
    width: "fit-content",
    maxWidth: 500,
    padding: "22px 26px",
    borderRadius: 20,
    color: "#fff",
    fontFamily: OUTFIT,
    fontWeight: 800,
    boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
  };
  const style: React.CSSProperties =
    card.kind === "qualifier"
      ? { ...base, background: BRAND.qualifier }
      : card.kind === "cta"
        ? { ...base, background: BRAND.panel, border: `2px solid rgba(6,182,212,${glow})` }
        : { ...base, background: BRAND.panel, border: "1px solid rgba(255,255,255,0.12)" };
  return (
    <Pop start={card.start} end={card.end} from="up" style={at ? placed(at, 560, width, height) : { position: "absolute", left: 48, top: "51%", transform: "translateY(-50%)" }}>
      <div style={{ ...style, ...sized(scale, at, "0% 50%") }}>
        <div style={{ fontSize: card.kind === "stat" ? 64 : 38, lineHeight: 1.05, textTransform: "uppercase", color: card.kind === "stat" ? BRAND.money : "#fff" }}>
          <Rich text={card.text} />
          {card.kind === "cta" && <span style={{ marginLeft: 12, backgroundImage: BRAND.gradient, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>↓</span>}
        </div>
        {card.sub && <div style={{ marginTop: 8, fontFamily: JAKARTA, fontWeight: 600, fontSize: 24, color: "rgba(255,255,255,0.75)", textTransform: "none" }}>{card.sub}</div>}
      </div>
    </Pop>
  );
};
