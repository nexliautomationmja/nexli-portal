import type { FrameSpec } from "@/lib/creative-studio/tables";

/**
 * Re-making clips after a frame change (Nov 2026), the rules the server and
 * the page share. No server imports here.
 */

/** The parts of a stored clip these rules read. */
export interface TakeRow {
  frameAssetId: string | null;
  takeFrameId: string | null;
  videoAssetId: string | null;
  klingTaskId: string | null;
}

/** The clip has a take, and it was made from another frame than the one the clip uses now. */
export function takeOutdated(c: TakeRow): boolean {
  return Boolean((c.videoAssetId || c.klingTaskId) && c.takeFrameId && c.frameAssetId && c.takeFrameId !== c.frameAssetId);
}

/** The description the Kling prompts use was written for this frame. */
export function describedFor(frameSpec: FrameSpec | null, frameId: string): boolean {
  if (!frameSpec) return false;
  if (frameSpec.scenes?.length) return frameSpec.scenes.some((s) => s.frameId === frameId && !s.stale);
  return frameSpec.describedFrameId === frameId;
}

/** Frames with takes from an old frame whose description hasn't caught up yet (Claude re-describes them first). */
export function framesToRedescribe(frameSpec: FrameSpec | null, clips: TakeRow[]): string[] {
  const ids = new Set<string>();
  for (const c of clips) if (takeOutdated(c) && c.frameAssetId && !describedFor(frameSpec, c.frameAssetId)) ids.add(c.frameAssetId);
  return [...ids];
}
