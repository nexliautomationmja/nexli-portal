import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  creativeAssets,
  creativeBatches,
  creativeClips,
  creativeCuts,
  creativeEdits,
  creativeProjects,
  isWaiting,
  type CreativeFormat,
} from "@/lib/creative-studio/tables";
import { CREDITS_PER_SECOND } from "@/lib/creative-studio/prompts";
import { signPaths } from "@/lib/creative-studio/storage";
import { studioById, studioRef, type StudioRef } from "@/lib/creative-studio/studios";

/** Where one batch video is, light enough to poll every few seconds for 10 videos. */
export interface BatchVideo {
  id: string;
  index: number;
  title: string;
  direction: string;
  shot: string;
  status: string;
  rig: string;
  frameUrl: string | null;
  hasFrame: boolean;
  manus: { status: string; waiting: boolean; error: string | null } | null;
  firstOptionId: string | null;
  clips: { total: number; done: number; working: number; failed: number; credits: number };
  cut: { id: string; status: string; version: number } | null;
  finalCut: boolean;
  edit: { status: string; style: string; progress: number; version: number; waiting: boolean } | null;
  adCopy: boolean;
}

export interface BatchSummary {
  id: string;
  /** Which studio the batch lives in (Nexli's or a client firm's). */
  studio: StudioRef;
  format: CreativeFormat;
  count: number;
  brief: string;
  createdAt: string;
  videos: BatchVideo[];
}

export async function loadBatch(ownerId: string, batchId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return null;
  const [batch] = await db
    .select()
    .from(creativeBatches)
    .where(and(eq(creativeBatches.id, batchId), eq(creativeBatches.ownerId, ownerId)))
    .limit(1);
  return batch ?? null;
}

export async function batchSummary(batch: typeof creativeBatches.$inferSelect): Promise<BatchSummary> {
  const studio = studioRef(await studioById(batch.ownerId, batch.studioId));
  const projects = await db
    .select()
    .from(creativeProjects)
    .where(eq(creativeProjects.batchId, batch.id))
    .orderBy(asc(creativeProjects.batchIndex));
  const ids = projects.map((p) => p.id);
  const none = { videos: [] as BatchVideo[] };
  if (ids.length === 0) return { id: batch.id, studio, format: batch.format, count: batch.count, brief: batch.brief, createdAt: batch.createdAt.toISOString(), ...none };

  const [assets, clips, cuts, edits] = await Promise.all([
    db
      .select({
        id: creativeAssets.id,
        projectId: creativeAssets.projectId,
        kind: creativeAssets.kind,
        storagePath: creativeAssets.storagePath,
        status: creativeAssets.status,
        error: creativeAssets.error,
        sort: creativeAssets.sort,
        createdAt: creativeAssets.createdAt,
      })
      .from(creativeAssets)
      .where(and(inArray(creativeAssets.projectId, ids), inArray(creativeAssets.kind, ["frame", "frame_option", "manus_task", "final_cut", "ad_copy"])))
      .orderBy(asc(creativeAssets.createdAt)),
    db
      .select({ projectId: creativeClips.projectId, status: creativeClips.status, durationS: creativeClips.durationS })
      .from(creativeClips)
      .where(inArray(creativeClips.projectId, ids)),
    db
      .select({ projectId: creativeCuts.projectId, id: creativeCuts.id, status: creativeCuts.status, version: creativeCuts.version })
      .from(creativeCuts)
      .where(inArray(creativeCuts.projectId, ids))
      .orderBy(desc(creativeCuts.version)),
    db
      .select({
        projectId: creativeEdits.projectId,
        status: creativeEdits.status,
        style: creativeEdits.style,
        progress: creativeEdits.progress,
        version: creativeEdits.version,
        renderId: creativeEdits.renderId,
      })
      .from(creativeEdits)
      .where(inArray(creativeEdits.projectId, ids))
      .orderBy(desc(creativeEdits.version)),
  ]);

  const firstFrame = new Map<string, string>();
  for (const a of assets.filter((x) => x.kind === "frame").sort((x, y) => x.sort - y.sort)) {
    if (a.projectId && a.storagePath && !firstFrame.has(a.projectId)) firstFrame.set(a.projectId, a.storagePath);
  }
  const signed = await signPaths([...firstFrame.values()], 6 * 3600);

  const videos = projects.map((p): BatchVideo => {
    const mine = assets.filter((a) => a.projectId === p.id);
    const task = mine.filter((a) => a.kind === "manus_task").pop();
    const option = mine.find((a) => a.kind === "frame_option");
    const pc = clips.filter((c) => c.projectId === p.id);
    const cut = cuts.find((c) => c.projectId === p.id);
    const edit = edits.find((e) => e.projectId === p.id);
    const framePath = firstFrame.get(p.id);
    const item = batch.plan[p.batchIndex ?? -1];
    return {
      id: p.id,
      index: p.batchIndex ?? 0,
      title: p.title,
      direction: p.brief?.direction ?? "",
      shot: item?.shot ?? "",
      status: p.status,
      rig: p.rig,
      frameUrl: framePath ? signed.get(framePath) ?? null : null,
      hasFrame: Boolean(framePath),
      manus: task ? { status: task.status, waiting: task.status === "waiting", error: task.error } : null,
      firstOptionId: option?.id ?? null,
      clips: {
        total: pc.length,
        done: pc.filter((c) => c.status === "done").length,
        working: pc.filter((c) => c.status === "queued" || c.status === "rendering").length,
        failed: pc.filter((c) => c.status === "failed" || c.status === "blocked").length,
        credits: pc.reduce((t, c) => t + c.durationS * CREDITS_PER_SECOND, 0),
      },
      cut: cut ? { id: cut.id, status: cut.status, version: cut.version } : null,
      finalCut: mine.some((a) => a.kind === "final_cut"),
      edit: edit ? { status: edit.status, style: edit.style, progress: edit.progress, version: edit.version, waiting: isWaiting(edit) } : null,
      adCopy: mine.some((a) => a.kind === "ad_copy"),
    };
  });
  return { id: batch.id, studio, format: batch.format, count: batch.count, brief: batch.brief, createdAt: batch.createdAt.toISOString(), videos };
}
