import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ICON_KINDS, type IconFx } from "../types";
import { FxIcon, ICON_INFO } from "./fx-icons";

/**
 * Animated icons with a text box (edit card ✎ → Animated icons).
 *   around  they burst out of the card a beat after it pops in, then bob,
 *           twinkle and sway at its edges for as long as it shows (they're
 *           inside the card's box, so they move and scale with it).
 *   rain    a shower over the whole video as the card pops in: each icon
 *           falls once (about four seconds in all), then it's clear.
 */

const valid = (fx: IconFx | undefined): fx is IconFx => Boolean(fx && (ICON_KINDS as readonly string[]).includes(fx.icon));

/** Spots around the card, as fractions of its box (centre of each icon), with a size and a stagger. */
const SPOTS = [
  { x: -0.04, y: -0.18, s: 1, d: 0 },
  { x: 1.04, y: -0.08, s: 0.72, d: 0.07 },
  { x: 1.02, y: 0.96, s: 0.9, d: 0.14 },
  { x: -0.06, y: 0.88, s: 0.66, d: 0.21 },
  { x: 0.3, y: -0.4, s: 0.52, d: 0.28 },
  { x: 0.74, y: 1.32, s: 0.58, d: 0.35 },
];

const BOUNCE = { damping: 9, stiffness: 170, mass: 0.6 };

/** Put inside the card's box (which gets position: relative). `size` = the biggest icon, px. */
export const IconsAround: React.FC<{ fx: IconFx | undefined; start: number; size: number }> = ({ fx, start, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!valid(fx)) return null;
  const t = frame / fps;
  const glow = ICON_INFO[fx.icon].glow;
  const twinkle = fx.icon === "sparkles" || fx.icon === "stars" ? 0.18 : 0.08;
  return (
    <>
      {SPOTS.map((p, i) => {
        const local = t - (start + 0.12 + p.d);
        if (local < 0) return null;
        const s = spring({ frame: Math.round(local * fps), fps, config: BOUNCE });
        const phase = i * 1.7;
        const bob = Math.sin(local * Math.PI * 2 * 0.7 + phase) * size * 0.07;
        const sway = Math.sin(local * Math.PI * 2 * 0.45 + phase) * 10;
        const pulse = 1 + twinkle * Math.sin(local * Math.PI * 2 * 1.3 + phase);
        // Out from the card's middle to its spot (the spring overshoots a little: a bounce).
        const x = 0.5 + (p.x - 0.5) * s;
        const y = 0.5 + (p.y - 0.5) * s;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              transform: `translate(-50%, -50%) translateY(${bob}px) rotate(${sway + (1 - Math.min(1, s)) * -120}deg) scale(${Math.max(0, s) * p.s * pulse})`,
              opacity: Math.min(1, s * 1.6),
              filter: `drop-shadow(0 0 ${size * 0.12}px ${glow}) drop-shadow(0 6px 10px rgba(0,0,0,0.35))`,
              pointerEvents: "none",
            }}
          >
            <FxIcon kind={fx.icon} size={size} />
          </div>
        );
      })}
    </>
  );
};

/** A sibling of the card's Pop: a full-frame layer. */
export const IconRain: React.FC<{ fx: IconFx | undefined; start: number; end: number; vertical: boolean }> = ({ fx, start, end, vertical }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  if (!valid(fx)) return null;
  const t = frame / fps;
  const SPAWN = 1.6;
  if (t < start || t > start + SPAWN + 2.6) return null;
  const count = vertical ? 16 : 20;
  const base = vertical ? 86 : 74;
  const out = interpolate(t, [end, end + 0.4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = ICON_INFO[fx.icon].glow;
  const seed = `${fx.icon}-${start}`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: out }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${k}-${i}`);
        const delay = (i / count) * SPAWN + r("d") * 0.25;
        const fall = 1.7 + r("f") * 0.9;
        const local = t - start - delay;
        if (local < 0 || local > fall) return null;
        const p = local / fall;
        const size = base * (0.55 + r("s") * 0.7);
        // Spread across the frame in lanes, jittered, with a little sway.
        const x = ((i * 0.618) % 1) * 0.86 + 0.07 + (r("x") - 0.5) * 0.06;
        const sway = Math.sin(local * Math.PI * 2 * (0.5 + r("w") * 0.5) + i) * width * 0.02;
        const y = -size + p * (height + size * 2);
        const spin = (r("r") - 0.5) * 50 + local * (r("v") > 0.5 ? 110 : -110);
        const fade = interpolate(p, [0, 0.08, 0.85, 1], [0, 1, 1, 0]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x * width + sway - size / 2,
              top: y,
              transform: `rotate(${spin}deg)`,
              opacity: fade,
              filter: `drop-shadow(0 0 ${size * 0.1}px ${glow}) drop-shadow(0 8px 12px rgba(0,0,0,0.3))`,
            }}
          >
            <FxIcon kind={fx.icon} size={size} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
