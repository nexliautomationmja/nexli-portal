import type { CreativeFormat } from "@/lib/creative-studio/tables";

/**
 * Batch create rules shared by the browser and the server (client-safe):
 * the caps Marcel set and how pasted frames are handed out to the videos.
 */
export const BATCH_MAX: Record<CreativeFormat, number> = { ad_9x16: 10, vsl_16x9: 5 };

export function clampCount(format: CreativeFormat, n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.min(BATCH_MAX[format], Math.max(1, v));
}

/**
 * Which pasted frame each video gets (index into the pasted frames), or null
 * when Manus makes that video's frame.
 * - cover "rest": each pasted frame is used once; Manus makes the rest.
 * - cover "all": every video uses a pasted frame (they repeat); no Manus.
 * - random: positions are shuffled instead of going 1, 2, 3…
 */
export function assignFrames(count: number, pasted: number, cover: "rest" | "all", random: boolean, rand: () => number = Math.random): (number | null)[] {
  if (pasted <= 0) return Array.from({ length: count }, () => null);
  const slots: (number | null)[] = Array.from({ length: count }, (_, i) =>
    cover === "all" ? i % pasted : i < pasted ? i : null
  );
  if (!random) return slots;
  // Fisher–Yates over the slot list keeps every pasted frame in use.
  const out = [...slots];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
