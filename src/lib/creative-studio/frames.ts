import { randomUUID } from "crypto";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { getSupabase } from "@/lib/supabase";
import { creativeAssets, creativeClips, creativeProjects, type FrameSpec, type SceneSlot } from "@/lib/creative-studio/tables";
import { CREATIVE_BUCKET, ensureCreativeBucket, removePaths } from "@/lib/creative-studio/storage";
import { toFrame } from "@/lib/creative-studio/images";
import { clipsOf, framesOf, rebuildPrompts, scenesOf } from "@/lib/creative-studio/service";
import { MAX_SCENES } from "@/lib/creative-studio/prompts";

type Project = typeof creativeProjects.$inferSelect;

/** Where a frame goes: a scene's id (replace its frame), "new" (add a scene), or nothing (scene 1 / the opening frame). */
export type SceneTarget = string | null | undefined;


export async function readStorage(path: string): Promise<Buffer> {
  const { data, error } = await getSupabase().storage.from(CREATIVE_BUCKET).download(path);
  if (error || !data) throw new Error("Couldn't read that image from storage");
  return Buffer.from(await data.arrayBuffer());
}

export async function writeStorage(path: string, bytes: Buffer, contentType: string): Promise<void> {
  await ensureCreativeBucket();
  const { error } = await getSupabase().storage.from(CREATIVE_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

/**
 * Before a frame change repoints clips: remember which frame each existing
 * take was made from, so the page can offer to re-make it from the new one.
 * (New takes record it when they're sent; this covers takes made before.)
 * `from` = only clips on that frame (a story scene's swap).
 */
export async function pinTakeFrames(projectId: string, from?: string) {
  await db
    .update(creativeClips)
    .set({ takeFrameId: sql`${creativeClips.frameAssetId}` })
    .where(
      and(
        eq(creativeClips.projectId, projectId),
        isNull(creativeClips.takeFrameId),
        or(isNotNull(creativeClips.videoAssetId), isNotNull(creativeClips.klingTaskId)),
        ...(from ? [eq(creativeClips.frameAssetId, from)] : [])
      )
    );
}

/**
 * Make `bytes` the project's opening frame: cropped for the format (9:16 for
 * ads), stored, put first in the frame order, and used by every clip.
 */
export async function setOpeningFrame(project: Project, bytes: Buffer, source: string, metadata: Record<string, unknown> = {}) {
  const frame = await toFrame(bytes, project.format);
  const path = `${project.id}/frames/${randomUUID()}.png`;
  await writeStorage(path, frame.bytes, "image/png");
  await db
    .update(creativeAssets)
    .set({ sort: sql`${creativeAssets.sort} + 1` })
    .where(and(eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "frame")));
  const [asset] = await db
    .insert(creativeAssets)
    .values({
      projectId: project.id,
      kind: "frame",
      storagePath: path,
      mime: "image/png",
      width: frame.width,
      height: frame.height,
      source,
      sort: 0,
      metadata,
    })
    .returning({ id: creativeAssets.id });
  await pinTakeFrames(project.id);
  await db.update(creativeClips).set({ frameAssetId: asset.id }).where(eq(creativeClips.projectId, project.id));
  await db.update(creativeProjects).set({ updatedAt: new Date() }).where(eq(creativeProjects.id, project.id));
  return asset.id;
}

/**
 * Make `bytes` a scene's frame: replace scene `target`'s frame, add it as a
 * new scene ("new"), or — on a classic one-frame video — make it the opening
 * frame exactly as before.
 */
export async function setSceneFrame(
  project: Project,
  bytes: Buffer,
  source: string,
  metadata: Record<string, unknown>,
  target: SceneTarget
): Promise<string> {
  if (!project.scenes && target !== "new") return setOpeningFrame(project, bytes, source, metadata);
  const frame = await toFrame(bytes, project.format);
  const path = `${project.id}/frames/${randomUUID()}.png`;
  await writeStorage(path, frame.bytes, "image/png");
  const [asset] = await db
    .insert(creativeAssets)
    .values({
      projectId: project.id,
      kind: "frame",
      storagePath: path,
      mime: "image/png",
      width: frame.width,
      height: frame.height,
      source,
      sort: 999,
      metadata,
    })
    .returning({ id: creativeAssets.id });
  const placed = await placeSceneFrame(project, asset.id, target);
  if (placed.error) throw new Error(placed.error);
  return asset.id;
}

/** Put a stored frame asset into the scene list: replace scene `target`'s frame, or add a scene ("new"). */
export async function placeSceneFrame(project: Project, assetId: string, target: SceneTarget): Promise<{ error?: string }> {
  const frames = (await framesOf(project.id)).filter((f) => f.id !== assetId);
  const scenes = scenesOf(project, frames);
  if (target === "new" || scenes.length === 0) {
    if (scenes.length >= MAX_SCENES) {
      await dropFrame(project.id, assetId);
      return { error: `A video can have up to ${MAX_SCENES} scenes.` };
    }
    await saveScenes(project, [...scenes, { id: randomUUID(), label: "", shot: "", frameId: assetId }]);
    return {};
  }
  const at = Math.max(0, scenes.findIndex((sc) => sc.id === target));
  const from = scenes[at].frameId;
  await saveScenes(
    project,
    scenes.map((sc, i) => (i === at ? { ...sc, frameId: assetId } : sc)),
    from ? { from, to: assetId } : null
  );
  return {};
}

/**
 * Save the scene list (order, labels, frames). When a scene's frame was
 * replaced, its clips move to the new frame and its description follows,
 * marked stale until the script catches up.
 */
export async function saveScenes(project: Project, scenes: SceneSlot[], replaced: { from: string; to: string } | null = null) {
  let frameSpec: FrameSpec | null = project.frameSpec;
  if (replaced) {
    await pinTakeFrames(project.id, replaced.from);
    await db
      .update(creativeClips)
      .set({ frameAssetId: replaced.to, updatedAt: new Date() })
      .where(and(eq(creativeClips.projectId, project.id), eq(creativeClips.frameAssetId, replaced.from)));
    if (frameSpec?.scenes?.some((sc) => sc.frameId === replaced.from)) {
      frameSpec = {
        ...frameSpec,
        scenes: frameSpec.scenes.map((sc) => (sc.frameId === replaced.from ? { ...sc, frameId: replaced.to, stale: true } : sc)),
      };
    }
  }
  const [updated] = await db
    .update(creativeProjects)
    .set({ scenes, frameSpec, updatedAt: new Date() })
    .where(eq(creativeProjects.id, project.id))
    .returning();
  await syncFrameSorts(project.id, scenes);
  if (replaced && frameSpec !== project.frameSpec) await rebuildPrompts(updated);
  return updated;
}

/** Scene frames take sort 0…n-1 in story order (so the first frame is scene 1 everywhere), older frames after. */
export async function syncFrameSorts(projectId: string, scenes: SceneSlot[]) {
  const frames = await framesOf(projectId);
  const order = scenes.map((sc) => sc.frameId).filter((id): id is string => Boolean(id));
  const ids = [...order, ...frames.map((f) => f.id).filter((id) => !order.includes(id))];
  const sortOf = new Map(frames.map((f) => [f.id, f.sort]));
  for (let i = 0; i < ids.length; i++) {
    if (sortOf.get(ids[i]) !== i) await db.update(creativeAssets).set({ sort: i }).where(eq(creativeAssets.id, ids[i]));
  }
}

/**
 * Remove a scene (and its frame). Clips that played in it move to the
 * scene before it (or the next one) and their prompts are rebuilt.
 */
export async function removeScene(project: Project, sceneId: string): Promise<{ error?: string }> {
  const frames = await framesOf(project.id);
  const scenes = scenesOf(project, frames);
  const at = scenes.findIndex((sc) => sc.id === sceneId);
  if (at < 0) return { error: "Scene not found" };
  const gone = scenes[at];
  const rest = scenes.filter((_, i) => i !== at);
  const clips = await clipsOf(project.id);
  const using = gone.frameId ? clips.filter((c) => c.frameAssetId === gone.frameId) : [];
  const withFrame = rest.filter((sc) => sc.frameId);
  if (using.length && withFrame.length === 0) return { error: "The script plays in this scene. Add another scene first." };
  if (using.length) {
    const before = [...rest.slice(0, at)].reverse().find((sc) => sc.frameId);
    const to = (before ?? withFrame[0]).frameId as string;
    await db
      .update(creativeClips)
      .set({ frameAssetId: to, updatedAt: new Date() })
      .where(inArray(creativeClips.id, using.map((c) => c.id)));
  }
  const updated = await saveScenes(project, rest);
  if (gone.frameId) await dropFrame(project.id, gone.frameId);
  if (using.length) await rebuildPrompts(updated);
  return {};
}

/** Delete a frame asset and its file. */
async function dropFrame(projectId: string, assetId: string) {
  const [asset] = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.id, assetId), eq(creativeAssets.projectId, projectId), eq(creativeAssets.kind, "frame")))
    .limit(1);
  if (!asset) return;
  await removePaths([asset.storagePath]);
  await db.delete(creativeAssets).where(eq(creativeAssets.id, asset.id));
}
