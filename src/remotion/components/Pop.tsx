import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { POP } from "../theme";

/** Shows children between start and end (seconds) with the rulebook's spring pop-in and a quick fade-out. */
export const Pop: React.FC<{ start: number; end: number; children: React.ReactNode; style?: React.CSSProperties; from?: "up" | "scale" }> = ({
  start,
  end,
  children,
  style,
  from = "scale",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (t < start || t > end + 0.25) return null;
  const s = spring({ frame: frame - Math.round(start * fps), fps, config: POP });
  const out = interpolate(t, [end, end + 0.25], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const transform = from === "up" ? `translateY(${(1 - s) * 40}px)` : `scale(${0.85 + 0.15 * s})`;
  return <div style={{ ...style, opacity: Math.min(1, s * 1.2) * out, transform: `${style?.transform ?? ""} ${transform}`.trim() }}>{children}</div>;
};
