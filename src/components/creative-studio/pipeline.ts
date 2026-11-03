"use client";

import type { ProjectDetail } from "@/lib/creative-studio/service";
import { api, send } from "@/components/creative-studio/client";

/**
 * Pipeline steps the browser drives, shared by a video's own page and the
 * batch page so both run exactly the same calls.
 */

/** Cut every clip's piece for one cut (3 at a time). Returns the first error, or null. */
export async function cutPieces(
  projectId: string,
  cutId: string,
  clipIds: string[],
  onProgress?: (done: number, total: number) => void
): Promise<string | null> {
  const queue = [...clipIds];
  let done = 0;
  let failed: string | null = null;
  onProgress?.(0, clipIds.length);
  const worker = async () => {
    while (queue.length && !failed) {
      const clipId = queue.shift()!;
      const r = await send(api(`${projectId}/cut/clip`), "POST", { cutId, clipId });
      if (!r.ok) failed = r.error;
      done++;
      onProgress?.(done, clipIds.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return failed;
}

/** Join the cut pieces into the rough cut. */
export function assembleCut(projectId: string, cutId: string) {
  return send(api(`${projectId}/cut/assemble`), "POST", { cutId });
}

/** The whole auto-cut for a video whose clips are all rendered: start (or resume) → pieces → join. */
export async function runCut(projectId: string): Promise<ProjectDetail> {
  const got = await send(api(projectId), "GET");
  if (!got.ok) throw new Error(got.error);
  let detail = got.data;
  let cut = detail.cuts[detail.cuts.length - 1];
  if (!cut || cut.status !== "cutting") {
    const r = await send(api(`${projectId}/cut/start`), "POST", cut ? { note: "Retry" } : {});
    if (!r.ok) throw new Error(r.error);
    detail = r.data;
    cut = detail.cuts[detail.cuts.length - 1];
  }
  if (!cut) throw new Error("The cut didn't start");
  const failed = await cutPieces(projectId, cut.id, detail.clips.map((c) => c.id));
  if (failed) throw new Error(`Auto-cut stopped: ${failed}`);
  const r = await assembleCut(projectId, cut.id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

/** Approve the script and send every clip to Kling (the same two calls as the script card). */
export async function approveAndRender(projectId: string): Promise<ProjectDetail> {
  const a = await send(api(`${projectId}/approve`), "POST");
  if (!a.ok) throw new Error(a.error);
  const r = await send(api(`${projectId}/render`), "POST", {});
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
