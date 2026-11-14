import type { MediaBox } from "./types";

/**
 * The 9:16 window a "window" cue plays in, shared by the render and the
 * editor (so dragging on the preview matches what renders).
 */

/** Smallest and largest window, as a fraction of the frame's height. */
export const WINDOW_MIN_H = 0.2;
export const WINDOW_MAX_H = 1;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Where a window sits when nobody has moved it: right of centre on a vertical ad, the right side of a VSL. */
export function defaultBox(vertical: boolean): MediaBox {
  return vertical ? { x: 0.7, y: 0.42, h: 0.5 } : { x: 0.8, y: 0.5, h: 0.85 };
}

/** A box kept to sane values (missing or broken = the default). */
export function cleanBox(box: Partial<MediaBox> | null | undefined, vertical: boolean): MediaBox {
  const d = defaultBox(vertical);
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
  return {
    x: r4(clamp(num(box?.x, d.x), 0, 1)),
    y: r4(clamp(num(box?.y, d.y), 0, 1)),
    h: r4(clamp(num(box?.h, d.h), WINDOW_MIN_H, WINDOW_MAX_H)),
  };
}

/** The window in pixels on a W×H frame: always 9:16, always fully inside the frame. */
export function windowRect(box: Partial<MediaBox> | null | undefined, vertical: boolean, W: number, H: number) {
  const b = cleanBox(box, vertical);
  let height = b.h * H;
  let width = (height * 9) / 16;
  if (width > W) {
    width = W;
    height = (W * 16) / 9;
  }
  const left = clamp(b.x * W - width / 2, 0, W - width);
  const top = clamp(b.y * H - height / 2, 0, H - height);
  return { left, top, width, height };
}
