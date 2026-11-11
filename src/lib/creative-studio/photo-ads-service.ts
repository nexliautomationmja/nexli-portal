import { randomUUID } from "crypto";
import sharp from "sharp";
import { and, asc, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  creativeAssets,
  creativePhotoAds,
  creativePhotoBatches,
  type ManusActivitySnapshot,
  type PhotoAdWaiting,
} from "@/lib/creative-studio/tables";
import {
  checkFrameTask,
  confirmTaskAction,
  isNotConfirmable,
  ManusError,
  replyToTask,
  startManusTask,
  stopTask,
} from "@/lib/creative-studio/manus";
import { FEED_SIZE, PHOTO_AUTO_REPLY, photoAdPrompt, sizeOf, STORY_SIZE } from "@/lib/creative-studio/photo-ads";
import { writeStorage } from "@/lib/creative-studio/frames";
import { removePaths, signPaths } from "@/lib/creative-studio/storage";
import { inStudio, studioById, type Studio } from "@/lib/creative-studio/studios";

/**
 * Photo ads run on Manus a few at a time per workspace. Whoever polls a batch
 * (its page, every few seconds) checks the running tasks, saves finished ads
 * (Manus links are temporary) and starts the next ones in line.
 */

type Batch = typeof creativePhotoBatches.$inferSelect;
type Ad = typeof creativePhotoAds.$inferSelect;

/** Manus tasks running at once for one workspace (across all its batches). */
export const PHOTO_PARALLEL = 4;
const ACTIVE = ["starting", "running", "waiting", "saving"];
/** A start or save that never came back frees its ad after this. */
const STARTING_STALE_MS = 3 * 60_000;
const SAVING_STALE_MS = 5 * 60_000;

export interface PhotoAdView {
  id: string;
  idx: number;
  title: string;
  angle: string;
  headline: string;
  subline: string;
  scene: string;
  look: string;
  note: string | null;
  status: string;
  error: string | null;
  taskUrl: string | null;
  activity: ManusActivitySnapshot | null;
  waiting: PhotoAdWaiting | null;
  storyUrl: string | null;
  feedUrl: string | null;
}

export interface PhotoBatchView {
  id: string;
  prompt: string;
  notes: string | null;
  status: string;
  createdAt: string;
  /** Reference ads these mimic (signed). */
  styleRefs: string[];
  ads: PhotoAdView[];
}

/** Where a workspace's reference ads (to mimic) are uploaded. */
export const styleRefPrefix = (ownerId: string) => `photo-ads/${ownerId}/style/`;

/** A batch's reference ads, signed for Manus and named so the prompt can point at them. */
async function styleRefFiles(batch: Batch, seconds = 3 * 3600): Promise<{ url: string; filename: string }[]> {
  const paths = batch.styleRefs ?? [];
  if (!paths.length) return [];
  const signed = await signPaths(paths, seconds);
  return paths
    .map((p, i) => ({ url: signed.get(p) ?? "", filename: `style-reference-${i + 1}.${p.split(".").pop() ?? "png"}` }))
    .filter((f) => f.url);
}

export interface PhotoBatchSummary {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
  total: number;
  done: number;
  working: number;
  failed: number;
  thumbs: string[];
}

export async function loadBatch(ownerId: string, batchId: string): Promise<Batch | null> {
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return null;
  const [batch] = await db
    .select()
    .from(creativePhotoBatches)
    .where(and(eq(creativePhotoBatches.id, batchId), eq(creativePhotoBatches.ownerId, ownerId)))
    .limit(1);
  return batch ?? null;
}

export async function loadAd(ownerId: string, adId: string): Promise<Ad | null> {
  if (!/^[0-9a-f-]{36}$/i.test(adId)) return null;
  const [ad] = await db
    .select()
    .from(creativePhotoAds)
    .where(and(eq(creativePhotoAds.id, adId), eq(creativePhotoAds.ownerId, ownerId)))
    .limit(1);
  return ad ?? null;
}

const adsOf = (batchId: string) =>
  db.select().from(creativePhotoAds).where(eq(creativePhotoAds.batchId, batchId)).orderBy(asc(creativePhotoAds.idx));

export async function batchView(batch: Batch): Promise<PhotoBatchView> {
  const ads = await adsOf(batch.id);
  const signed = await signPaths([...ads.flatMap((a) => [a.storyPath, a.feedPath]), ...(batch.styleRefs ?? [])], 6 * 3600);
  const url = (p: string | null) => (p ? (signed.get(p) ?? null) : null);
  return {
    id: batch.id,
    prompt: batch.prompt,
    notes: batch.notes,
    status: batch.status,
    createdAt: batch.createdAt.toISOString(),
    styleRefs: (batch.styleRefs ?? []).map((p) => signed.get(p) ?? "").filter(Boolean),
    ads: ads.map((a) => ({
      id: a.id,
      idx: a.idx,
      title: a.title,
      angle: a.angle,
      headline: a.headline,
      subline: a.subline,
      scene: a.scene,
      look: a.look,
      note: a.note,
      status: a.status,
      error: a.error,
      taskUrl: a.taskUrl,
      activity: a.activity ?? null,
      waiting: a.waiting ?? null,
      storyUrl: url(a.storyPath),
      feedUrl: url(a.feedPath),
    })),
  };
}

export async function listBatches(ownerId: string, studio: Studio): Promise<PhotoBatchSummary[]> {
  const batches = await db
    .select()
    .from(creativePhotoBatches)
    .where(and(eq(creativePhotoBatches.ownerId, ownerId), inStudio(creativePhotoBatches.studioId, studio)))
    .orderBy(desc(creativePhotoBatches.createdAt))
    .limit(60);
  if (!batches.length) return [];
  const ads = await db
    .select({
      batchId: creativePhotoAds.batchId,
      idx: creativePhotoAds.idx,
      status: creativePhotoAds.status,
      feedPath: creativePhotoAds.feedPath,
      storyPath: creativePhotoAds.storyPath,
    })
    .from(creativePhotoAds)
    .where(inArray(creativePhotoAds.batchId, batches.map((b) => b.id)))
    .orderBy(asc(creativePhotoAds.idx));
  const thumbPaths = new Map<string, string[]>();
  for (const a of ads) {
    const p = a.feedPath ?? a.storyPath;
    const list = thumbPaths.get(a.batchId) ?? [];
    if (p && list.length < 4) list.push(p);
    thumbPaths.set(a.batchId, list);
  }
  const signed = await signPaths([...thumbPaths.values()].flat(), 6 * 3600);
  return batches.map((b) => {
    const mine = ads.filter((a) => a.batchId === b.id);
    return {
      id: b.id,
      prompt: b.prompt,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      total: mine.length,
      done: mine.filter((a) => a.status === "done").length,
      working: mine.filter((a) => a.status === "queued" || ACTIVE.includes(a.status)).length,
      failed: mine.filter((a) => a.status === "failed").length,
      thumbs: (thumbPaths.get(b.id) ?? []).map((p) => signed.get(p)).filter((u): u is string => Boolean(u)),
    };
  });
}

/** The studio's default presenter's reference pictures (Daniela's in Nexli's studio), signed for Manus. */
export async function referenceFiles(ownerId: string, studio: Studio): Promise<{ url: string; filename: string }[]> {
  const refs = await db
    .select({ storagePath: creativeAssets.storagePath })
    .from(creativeAssets)
    .where(
      and(
        eq(creativeAssets.ownerId, ownerId),
        eq(creativeAssets.kind, "reference"),
        isNull(creativeAssets.projectId),
        inStudio(creativeAssets.studioId, studio),
        // Other presenters' photos aren't the default presenter's.
        isNull(creativeAssets.presenterId)
      )
    )
    .orderBy(desc(creativeAssets.createdAt))
    .limit(6);
  const signed = await signPaths(refs.map((r) => r.storagePath), 3 * 3600);
  const who = studio.kind === "client" ? "presenter" : "daniela";
  return refs
    .map((r) => (r.storagePath ? signed.get(r.storagePath) : undefined))
    .filter((u): u is string => Boolean(u))
    .map((url, i) => ({ url, filename: `${who}-reference-${i + 1}.png` }));
}

const setAd = (id: string, patch: Partial<Ad>) =>
  db.update(creativePhotoAds).set({ ...patch, updatedAt: new Date() }).where(eq(creativePhotoAds.id, id));

/** Download Manus's images, work out which is the Story and which the Feed, store them at their exact sizes. */
async function saveImages(ad: Ad, images: { url: string; filename: string | null }[]): Promise<void> {
  const found: Partial<Record<"story" | "feed", Buffer>> = {};
  // Newest message first, so the first of each size is the final one.
  for (const img of images.slice(0, 8)) {
    if (found.story && found.feed) break;
    try {
      const res = await fetch(img.url);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const input = sharp(Buffer.from(await res.arrayBuffer()), { failOn: "none" }).rotate();
      const meta = await input.metadata();
      const w = meta.autoOrient?.width ?? meta.width ?? 0;
      const h = meta.autoOrient?.height ?? meta.height ?? 0;
      const size = sizeOf(img.filename, w, h);
      if (!size || found[size]) continue;
      const target = size === "story" ? STORY_SIZE : FEED_SIZE;
      found[size] = await input.resize(target.width, target.height, { fit: "cover", position: "centre" }).png().toBuffer();
    } catch (err) {
      console.error("[creative-studio] saving a photo ad image failed:", err instanceof Error ? err.message : err);
    }
  }
  if (!found.story && !found.feed) {
    await setAd(ad.id, { status: "failed", error: "Manus finished, but its images couldn't be read as a Story or Feed ad. Try Redo." });
    return;
  }
  const paths: Partial<Record<"story" | "feed", string>> = {};
  for (const size of ["story", "feed"] as const) {
    const bytes = found[size];
    if (!bytes) continue;
    const path = `photo-ads/${ad.batchId}/${ad.id}-${size}-${randomUUID().slice(0, 8)}.png`;
    await writeStorage(path, bytes, "image/png");
    paths[size] = path;
  }
  const missing = !found.story ? "Story" : !found.feed ? "Feed" : null;
  await setAd(ad.id, {
    status: "done",
    storyPath: paths.story ?? ad.storyPath,
    feedPath: paths.feed ?? ad.feedPath,
    waiting: null,
    error: missing ? `Manus didn't send the ${missing} size — Redo to get both.` : null,
  });
  // The previous version's files, now replaced.
  await removePaths([paths.story && ad.storyPath, paths.feed && ad.feedPath].filter((p): p is string => Boolean(p)));
}

/** Check one running Manus task and move the ad along. */
async function checkAd(ad: Ad): Promise<void> {
  if (!ad.manusTaskId) return;
  const { state, activity } = await checkFrameTask(ad.manusTaskId);
  if (state.state === "running") {
    await setAd(ad.id, { activity, ...(ad.status === "waiting" ? { status: "running", waiting: null } : {}) });
    return;
  }
  if (state.state === "waiting") {
    const key = state.eventId ?? `q:${state.prompt.slice(0, 200)}`;
    if (ad.answeredKey === key) {
      await setAd(ad.id, { activity });
      return;
    }
    // The first question gets "use your judgment". Actions are never approved without the user.
    if (state.kind === "question" && ad.autoReplies < 1) {
      await replyToTask(ad.manusTaskId, PHOTO_AUTO_REPLY);
      await setAd(ad.id, { activity, autoReplies: ad.autoReplies + 1, answeredKey: key });
      return;
    }
    await setAd(ad.id, {
      activity,
      status: "waiting",
      waiting: { kind: state.kind, prompt: state.prompt, options: state.options, eventId: state.eventId, eventType: state.eventType, key },
    });
    return;
  }
  if (state.state === "failed") {
    await setAd(ad.id, { activity, status: "failed", waiting: null, error: state.error.slice(0, 500) });
    return;
  }
  // Done: claim the save so two pages polling at once don't both store it.
  const [claimed] = await db
    .update(creativePhotoAds)
    .set({ status: "saving", activity, updatedAt: new Date() })
    .where(and(eq(creativePhotoAds.id, ad.id), inArray(creativePhotoAds.status, ["running", "waiting"])))
    .returning();
  if (claimed) await saveImages(claimed, state.images);
}

/** Start one queued ad on Manus. Returns false when Manus is at its limit (stop starting more). */
async function startAd(ad: Ad, studio: Studio, refs: { url: string; filename: string }[], style: { url: string; filename: string }[] = []): Promise<boolean> {
  const [claimed] = await db
    .update(creativePhotoAds)
    .set({ status: "starting", updatedAt: new Date() })
    .where(and(eq(creativePhotoAds.id, ad.id), eq(creativePhotoAds.status, "queued")))
    .returning({ id: creativePhotoAds.id });
  if (!claimed) return true;
  try {
    const task = await startManusTask({
      prompt: photoAdPrompt(ad, { client: studio.kind === "client", hasReferences: refs.length > 0, ...(style.length ? { styleRefs: style.length } : {}) }),
      // The person's photos first, then the ads to mimic (named style-reference-N).
      files: [...refs, ...style],
      title: studio.kind === "client" ? `Creative Studio · ${studio.name} photo ad` : "Nexli Creative Studio · photo ad",
    });
    await setAd(ad.id, {
      status: "running",
      manusTaskId: task.taskId,
      taskUrl: task.taskUrl,
      activity: null,
      waiting: null,
      answeredKey: null,
      autoReplies: 0,
      error: null,
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't start Manus";
    console.error("[creative-studio] photo ad Manus start failed:", message);
    if (err instanceof ManusError && /MANUS_API_KEY/.test(message)) {
      await setAd(ad.id, { status: "queued" });
      throw err;
    }
    // Manus busy / at its task limit: back in line, try on the next check.
    if (/concurren|too many|limit|rate|busy|429/i.test(message)) {
      await setAd(ad.id, { status: "queued" });
      return false;
    }
    await setAd(ad.id, { status: "failed", error: message.slice(0, 500) });
    return true;
  }
}

/**
 * One step for a batch: check its running Manus tasks, save finished ads,
 * then start queued ones while the workspace has fewer than PHOTO_PARALLEL running.
 */
export async function advanceBatch(batch: Batch): Promise<void> {
  const now = Date.now();
  // Unstick starts/saves whose request died half-way.
  await db
    .update(creativePhotoAds)
    .set({ status: "queued", updatedAt: new Date() })
    .where(
      and(
        eq(creativePhotoAds.batchId, batch.id),
        eq(creativePhotoAds.status, "starting"),
        isNull(creativePhotoAds.manusTaskId),
        lt(creativePhotoAds.updatedAt, new Date(now - STARTING_STALE_MS))
      )
    );
  await db
    .update(creativePhotoAds)
    .set({ status: "running", updatedAt: new Date() })
    .where(
      and(eq(creativePhotoAds.batchId, batch.id), eq(creativePhotoAds.status, "saving"), lt(creativePhotoAds.updatedAt, new Date(now - SAVING_STALE_MS)))
    );

  const ads = await adsOf(batch.id);
  const checks = ads.filter((a) => (a.status === "running" || a.status === "waiting") && a.manusTaskId);
  const results = await Promise.allSettled(checks.map((a) => checkAd(a)));
  for (const r of results) {
    if (r.status === "rejected") {
      if (r.reason instanceof ManusError && /MANUS_API_KEY/.test(r.reason.message)) throw r.reason;
      console.error("[creative-studio] photo ad check failed:", r.reason instanceof Error ? r.reason.message : r.reason);
    }
  }

  const queued = ads.filter((a) => a.status === "queued");
  if (!queued.length) return;
  const active = await db
    .select({ id: creativePhotoAds.id })
    .from(creativePhotoAds)
    .where(and(eq(creativePhotoAds.ownerId, batch.ownerId), inArray(creativePhotoAds.status, ACTIVE)));
  let free = PHOTO_PARALLEL - active.length;
  if (free <= 0) return;
  const studio = await studioById(batch.ownerId, batch.studioId);
  const refs = await referenceFiles(batch.ownerId, studio);
  const style = await styleRefFiles(batch);
  for (const ad of queued) {
    if (free <= 0) break;
    if (!(await startAd(ad, studio, refs, style))) break;
    free--;
  }
}

/** Answer Manus's question, approve its action (only on the user's click), or stop it. */
export async function actOnAd(
  ad: Ad,
  action: { type: "reply"; text: string } | { type: "allow" } | { type: "stop" } | { type: "redo"; note: string }
): Promise<string | null> {
  if (action.type === "redo") {
    if (ad.manusTaskId && ACTIVE.includes(ad.status)) await stopTask(ad.manusTaskId);
    await setAd(ad.id, {
      status: "queued",
      note: action.note.trim().slice(0, 1000) || null,
      manusTaskId: null,
      taskUrl: null,
      activity: null,
      waiting: null,
      answeredKey: null,
      autoReplies: 0,
      error: null,
    });
    return null;
  }
  if (action.type === "stop") {
    if (ad.manusTaskId && ACTIVE.includes(ad.status)) await stopTask(ad.manusTaskId);
    if (ad.status === "queued" || ACTIVE.includes(ad.status)) await setAd(ad.id, { status: "failed", waiting: null, error: "Stopped." });
    return null;
  }
  if (ad.status !== "waiting" || !ad.waiting || !ad.manusTaskId) return "Manus isn't waiting on anything for this ad.";
  if (action.type === "reply") {
    const text = action.text.trim().slice(0, 4000);
    if (!text) return "Type an answer first.";
    await replyToTask(ad.manusTaskId, text);
  } else {
    if (!ad.waiting.eventId) return "There's nothing to approve.";
    try {
      await confirmTaskAction(ad.manusTaskId, ad.waiting.eventId);
    } catch (err) {
      if (!isNotConfirmable(err)) throw err;
    }
  }
  await setAd(ad.id, { status: "running", waiting: null, answeredKey: ad.waiting.key });
  return null;
}

/** Delete a batch: stop its Manus tasks and remove its images. */
export async function deleteBatch(batch: Batch): Promise<void> {
  const ads = await adsOf(batch.id);
  await Promise.all(ads.filter((a) => a.manusTaskId && ACTIVE.includes(a.status)).map((a) => stopTask(a.manusTaskId!)));
  await removePaths([...ads.flatMap((a) => [a.storyPath, a.feedPath]), ...(batch.styleRefs ?? [])]);
  await db.delete(creativePhotoBatches).where(eq(creativePhotoBatches.id, batch.id));
}
