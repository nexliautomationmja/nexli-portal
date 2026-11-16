import React from "react";
import type { IconKind } from "../types";

/**
 * The animated icons' artwork, as SVG (no emoji font needed on Lambda, so
 * the preview and the render match). Plain React with no Remotion import:
 * the edit card's picker shows the same drawings.
 */

/** A "$" drawn as a stroke (24×24 box). */
const DOLLAR = "M16.4 7.6C15.6 6 13.9 5 12 5c-2.5 0-4.4 1.4-4.4 3.4 0 4.6 8.8 2.5 8.8 7.1 0 2.1-1.9 3.5-4.4 3.5-2.1 0-3.9-1-4.7-2.6M12 2.6v18.8";

const STAR = "M12 2.2l2.95 6.05 6.65.85-4.88 4.6 1.25 6.6L12 17.1l-5.97 3.2 1.25-6.6L2.4 9.1l6.65-.85z";
const SPARKLE = "M12 1.5C12.9 8 16 11.1 22.5 12 16 12.9 12.9 16 12 22.5 11.1 16 8 12.9 1.5 12 8 11.1 11.1 8 12 1.5z";
const HEART = "M12 21.3l-1.45-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.55 11.5z";
const BOLT = "M13.5 1.5L4 13.6h6.6L9.2 22.5l10.3-12.6h-6.7z";
const FLAME =
  "M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z";
const FLAME_CORE = "M11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z";

/** Name and a soft glow per icon (the glow is a CSS drop-shadow on the wrapper). */
export const ICON_INFO: Record<IconKind, { label: string; glow: string }> = {
  stars: { label: "Stars", glow: "rgba(250,204,21,0.55)" },
  sparkles: { label: "Sparkles", glow: "rgba(253,230,138,0.9)" },
  dollars: { label: "Dollar signs", glow: "rgba(34,197,94,0.55)" },
  coins: { label: "Coins", glow: "rgba(250,204,21,0.5)" },
  hearts: { label: "Hearts", glow: "rgba(244,63,94,0.5)" },
  lightning: { label: "Lightning", glow: "rgba(250,204,21,0.6)" },
  checks: { label: "Checks", glow: "rgba(34,197,94,0.5)" },
  fire: { label: "Fire", glow: "rgba(249,115,22,0.6)" },
};

export const FxIcon: React.FC<{ kind: IconKind; size: number; style?: React.CSSProperties }> = ({ kind, size, style }) => {
  const art = (() => {
    switch (kind) {
      case "stars":
        return (
          <>
            <path d={STAR} fill="#FACC15" stroke="#B45309" strokeWidth={0.9} strokeLinejoin="round" />
            <path d="M12 5.6l1.5 3.1 3.2.4" fill="none" stroke="#FEF9C3" strokeWidth={1.1} strokeLinecap="round" opacity={0.9} />
          </>
        );
      case "sparkles":
        return (
          <>
            <path d={SPARKLE} fill="#FFFFFF" />
            <path d={SPARKLE} fill="#FDE68A" transform="translate(12 12) scale(0.45) translate(-12 -12)" />
          </>
        );
      case "dollars":
        return (
          <>
            <path d={DOLLAR} fill="none" stroke="#052e16" strokeWidth={5.2} strokeLinecap="round" strokeLinejoin="round" />
            <path d={DOLLAR} fill="none" stroke="#22C55E" strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      case "coins":
        return (
          <>
            <circle cx={12} cy={12} r={10.4} fill="#CA8A04" />
            <circle cx={12} cy={11.4} r={9.6} fill="#FACC15" />
            <circle cx={12} cy={11.4} r={7.4} fill="none" stroke="#EAB308" strokeWidth={1.2} />
            <path d={DOLLAR} fill="none" stroke="#A16207" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" transform="translate(12 11.4) scale(0.56) translate(-12 -12)" />
          </>
        );
      case "hearts":
        return (
          <>
            <path d={HEART} fill="#F43F5E" stroke="#9F1239" strokeWidth={0.8} />
            <path d="M6.2 7.2c.7-1 1.9-1.4 3-1.1" fill="none" stroke="#FFE4E6" strokeWidth={1.3} strokeLinecap="round" opacity={0.85} />
          </>
        );
      case "lightning":
        return <path d={BOLT} fill="#FACC15" stroke="#A16207" strokeWidth={0.9} strokeLinejoin="round" />;
      case "checks":
        return (
          <>
            <circle cx={12} cy={12} r={10.4} fill="#22C55E" stroke="#14532D" strokeWidth={0.9} />
            <path d="M7 12.4l3.3 3.3L17.2 8.8" fill="none" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      case "fire":
        return (
          <>
            <path d={FLAME} fill="#F97316" stroke="#9A3412" strokeWidth={0.8} />
            <path d={FLAME_CORE} fill="#FACC15" />
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block", overflow: "visible", ...style }} aria-hidden="true">
      {art}
    </svg>
  );
};
