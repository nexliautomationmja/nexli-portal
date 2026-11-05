"use client";

import type { ProjectDetail } from "@/lib/creative-studio/service";
import { api, send } from "@/components/creative-studio/client";

/**
 * Pipeline steps the browser drives, shared by a video's own page and the
 * batch page so both run exactly the same calls.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolves once the tab is in front again (a phone pauses background tabs mid-request). */
function visible(): Promise<void> {
  if (typeof document === "undefined" || !document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const on = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", on);
      resolve();
    };
    document.addEventListener("visibilitychange", on);
  });
}

/** How long to wait on another page that's cutting the same clip before giving up. */
const PENDING_LIMIT_MS = 8 * 60_000;

/**
 * Cut one clip's piece. Retries what a retry can fix (the server ran out of
 * time or memory, the connection dropped) twice; waits while another page
 * is cutting the same piece. Returns an error in plain words, or null.
 */
async function cutPiece(projectId: string, cutId: string, clipId: string, n: number, driver: string): Promise<string | null> {
  const started = Date.now();
  let failures = 0;
  for (;;) {
    await visible();
    let status = 0;
    let data: { error?: string; pending?: boolean } | null = null;
    try {
      const r = await fetch(api(`${projectId}/cut/clip`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cutId, clipId, driver }),
      });
      status = r.status;
      data = await r.json().catch(() => null);
    } catch {
      status = 0;
    }
    if (status === 200) return null;
    if (status === 202 && data?.pending) {
      if (Date.now() - started > PENDING_LIMIT_MS) return `Clip ${n} has been cutting on another page for a long time. Reload and try again.`;
      await sleep(5000);
      continue;
    }
    if ((status === 0 || status >= 500) && failures < 2) {
      failures++;
      await sleep(failures * 4000);
      continue;
    }
    if (data?.error) return `Clip ${n}: ${data.error}`;
    if (status === 0) return `Lost the connection while cutting clip ${n}.`;
    if (status === 504) return `Clip ${n} took too long to cut, three times.`;
    if (status >= 500) return `The server stopped while cutting clip ${n} (out of time or memory), three times.`;
    return `Cutting clip ${n} failed (${status}).`;
  }
}

/**
 * Cut every clip's piece for one cut, two at a time (an instance is 1–2
 * vCPUs and the requests can share one, so more at once only runs it out of
 * memory). Returns the first error, or null.
 */
export async function cutPieces(
  projectId: string,
  cutId: string,
  clipIds: string[],
  onProgress?: (done: number, total: number) => void
): Promise<string | null> {
  const driver = crypto.randomUUID();
  const queue = clipIds.map((id, i) => ({ id, n: i + 1 }));
  let done = 0;
  let failed: string | null = null;
  onProgress?.(0, clipIds.length);
  const worker = async () => {
    while (queue.length && !failed) {
      const { id, n } = queue.shift()!;
      const err = await cutPiece(projectId, cutId, id, n, driver);
      if (err) failed = failed ?? err;
      done++;
      onProgress?.(done, clipIds.length);
    }
  };
  await Promise.all([worker(), worker()]);
  return failed;
}

/** Give up on a cut: it shows the reason and "Try again" (pieces already cut are kept). */
export function failCut(projectId: string, cutId: string, error: string) {
  return send(api(`${projectId}/cut/fail`), "POST", { cutId, error });
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
  if (failed) {
    await failCut(projectId, cut.id, failed);
    throw new Error(`Auto-cut stopped: ${failed}`);
  }
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
