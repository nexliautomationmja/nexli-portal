/**
 * Colour helpers for Firm Foundation websites — pure, no I/O.
 *
 * Derives the full 7-key palette a site config needs from the one or two
 * colours a firm gives us at intake.
 */
import type { FirmSiteConfig } from "./types";

export const DEFAULT_PRIMARY = "#1e3a8a";
export const DEFAULT_ACCENT = "#06b6d4";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parse "#rgb" / "#rrggbb" (leading "#" optional). Returns null when invalid. */
export function parseHex(input: string | null | undefined): RGB | null {
  if (typeof input !== "string") return null;
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function toHex({ r, g, b }: RGB): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp255(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Normalise any accepted hex input to lowercase "#rrggbb", or null. */
export function normalizeHex(input: string | null | undefined): string | null {
  const rgb = parseHex(input);
  return rgb ? toHex(rgb) : null;
}

/** Linear interpolation between two colours; t = 0 → a, t = 1 → b. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

/** Move a colour toward white by `amount` (0–1). */
export function lighten(c: RGB, amount: number): RGB {
  return mix(c, WHITE, amount);
}

/** Move a colour toward black by `amount` (0–1). */
export function darken(c: RGB, amount: number): RGB {
  return mix(c, BLACK, amount);
}

/** Relative luminance per WCAG 2.x (0 = black, 1 = white). */
export function luminance({ r, g, b }: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Desaturate toward the colour's own grey so tints read as neutral. */
function desaturate(c: RGB, amount: number): RGB {
  const grey = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return mix(c, { r: grey, g: grey, b: grey }, amount);
}

/**
 * Build the seven site colours from a primary and accent. Missing or invalid
 * inputs fall back to the Nexli navy / cyan defaults.
 *
 * - background: very light tint of primary (~96% toward white)
 * - surface: white
 * - text: near-black shade of primary, adjusted until it clears 7:1 on background
 * - textMuted: mid grey-blue derived from primary
 * - border: light tint of primary (~85% toward white)
 */
export function derivePalette(
  primary?: string | null,
  accent?: string | null
): FirmSiteConfig["colors"] {
  const p = parseHex(primary) ?? parseHex(DEFAULT_PRIMARY)!;
  const a = parseHex(accent) ?? parseHex(DEFAULT_ACCENT)!;

  const background = desaturate(lighten(p, 0.96), 0.3);
  const border = desaturate(lighten(p, 0.85), 0.3);

  // Text: dark shade of primary. If the primary is already very dark (or very
  // light, e.g. a pastel brand colour), fall back to a neutral near-black.
  let text = darken(p, 0.72);
  if (luminance(p) > 0.4) text = { r: 17, g: 24, b: 39 }; // slate-900-ish
  // Guarantee readable body text (AAA target 7:1).
  let guard = 0;
  while (contrastRatio(text, background) < 7 && guard < 10) {
    text = darken(text, 0.25);
    guard += 1;
  }

  // Muted text: primary pulled toward a mid grey. Keep at least 4.5:1.
  let textMuted = desaturate(mix(p, { r: 100, g: 116, b: 139 }, 0.6), 0.2);
  guard = 0;
  while (contrastRatio(textMuted, background) < 4.5 && guard < 10) {
    textMuted = darken(textMuted, 0.15);
    guard += 1;
  }

  return {
    primary: toHex(p),
    accent: toHex(a),
    background: toHex(background),
    surface: "#ffffff",
    text: toHex(text),
    textMuted: toHex(textMuted),
    border: toHex(border),
  };
}
