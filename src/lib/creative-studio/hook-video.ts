import { randomUUID } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { getSupabase } from "@/lib/supabase";
import { creativeAssets, creativeClips, creativeCuts, creativeEdits, creativeProjects } from "@/lib/creative-studio/tables";
import { clipColumns, clipsOf, framesOf } from "@/lib/creative-studio/service";
import { CREATIVE_BUCKET, removePaths } from "@/lib/creative-studio/storage";
import { EMPTY_BRIEF } from "@/lib/creative-studio/prompts";
import { studioById } from "@/lib/creative-studio/studios";
import { presenterForStudio } from "@/lib/creative-studio/presenters";
import { SOURCE_MAX_BYTES, SOURCE_MAX_SECONDS, SOURCE_TYPES, tooLongMessage } from "@/lib/creative-studio/reaction-shared";
import { HookError, hookProjectOf, hookTakesOf, markMade } from "@/lib/creative-studio/hook-tests";
import { hookSpan, hookVideoTitle, remapDeep, type HookOrigin } from "@/lib/creative-studio/hook-shared";
import type { creativeHookTests } from "@/lib/creative-studio/tables";

/**
 * Hook Tester: turn a picked hook into a video.
 *
 * A video made here → a NEW video (the original stays as it is, so the two
 * can run against each other): the hook's Kling clip first, then the
 * original's own clips after its old hook, copied with their word timings.
 * The original's trims and edit look ride along (creative_projects.hook_of),
 * so the first auto-cut and the first edit start from them.
 *
 * A dropped-in video → a new video set up to recreate it, opening with the
 * hook.
 */

type Test = typeof creativeHookTests.$inferSelect;
type Asset = typeof creativeAssets.$inferSelect;

/** Copy storage objects, a few at a time. Throws on the first failure. */
async function copyFiles(pairs: { from: string; to: string }[]): Promise<void> {
  const bucket = getSupabase().storage.from(CREATIVE_BUCKET);
  const queue = [...pairs];
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const { error } = await bucket.copy(p.from, p.to);
      if (error) throw new Error(`copy ${p.from}: ${error.message}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, pairs.length) }, worker));
}

/** A video already made for this hook that still exists. */
async function alreadyMade(test: Test, hookId: string): Promise<string | null> {
  const id = test.hooks.find((h) => h.id === hookId)?.projectId;
  if (!id) return null;
  const [p] = await db.select({ id: creativeProjects.id }).from(creativeProjects).where(and(eq(creativeProjects.id, id), eq(creativeProjects.ownerId, test.ownerId))).limit(1);
  return p?.id ?? null;
}

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;
type Cut = typeof creativeCuts.$inferSelect;
type Edit = typeof creativeEdits.$inferSelect;
type Take = Awaited<ReturnType<typeof hookTakesOf>> extends Map<string, infer T> ? T : never;

/**
 * Everything the new video is made of, worked out without touching the
 * database (so it can be tested): the project row, its assets and clips with
 * fresh ids, the files to copy, and what it remembers of the original.
 * `uuid` makes the ids.
 */
export function planHookVideo(o: {
  original: Project;
  clips: Clip[];
  /** The original's frames, a reaction's video / clips on screen, and the reused clips' videos. */
  carried: Asset[];
  span: number;
  take: Take;
  takePath: string;
  cut: Cut | null;
  edit: Edit | null;
  test: Pick<Test, "id" | "hooks">;
  hookId: string;
  actorId: string;
  uuid: () => string;
}) {
  const { original, clips, carried, take } = o;
  const hook = o.test.hooks.find((h) => h.id === o.hookId);
  if (!hook) throw new HookError("That hook isn't in this test.", 404);
  const body = clips.slice(o.span);
  const newId = o.uuid();
  const hookClipId = o.uuid();
  const hookAssetId = o.uuid();
  const ids = new Map<string, string>();
  for (const a of carried) ids.set(a.id, o.uuid());
  for (const c of body) ids.set(c.id, o.uuid());
  const copies = new Map<string, string>();
  const remap = <T>(v: T): T => remapDeep(v, ids, `${original.id}/`, `${newId}/`, (a, b) => copies.set(a, b));

  const assets = carried.map((a) => ({
    id: ids.get(a.id) as string,
    projectId: newId,
    kind: a.kind,
    storagePath: a.storagePath ? remap(a.storagePath) : null,
    mime: a.mime,
    width: a.width,
    height: a.height,
    durationMs: a.durationMs,
    source: a.source,
    providerTaskId: a.providerTaskId,
    status: a.status,
    error: a.error,
    sort: a.sort,
    metadata: a.metadata ? remap(a.metadata) : null,
  }));
  const hookPath = `${newId}/clips/${hookClipId}-v1.mp4`;
  copies.set(o.takePath, hookPath);
  assets.push({
    id: hookAssetId,
    projectId: newId,
    kind: "clip",
    storagePath: hookPath,
    mime: "video/mp4",
    width: null,
    height: null,
    durationMs: take.durationS * 1000,
    source: "kling",
    providerTaskId: take.klingTaskId,
    status: "ready",
    error: null,
    sort: 0,
    metadata: { clipId: hookClipId, version: 1, hookTestId: o.test.id },
  });
  const firstFrame = carried.find((a) => a.kind === "frame");
  // The hook clip sits in the scene of the clip it replaces; its take remembers the frame it was really made from
  // (the same pair the original's clips carry, so a video whose frame changed reads the same way in the new one).
  const sceneFrame = ids.get(clips[0]?.frameAssetId ?? "") || (firstFrame ? ids.get(firstFrame.id) : undefined) || null;
  const madeFrom = (take.frameAssetId && ids.get(take.frameAssetId)) || sceneFrame;

  // The original's trims on the reused clips, and its edit, for the new video to start from.
  const entries: NonNullable<HookOrigin["cut"]>["entries"] = {};
  for (const c of body) {
    const e = o.cut?.plan.find((pl) => pl.clipId === c.id);
    if (e && e.version === c.version) entries[ids.get(c.id) as string] = { version: e.version, overrides: e.overrides ?? [], manual: e.manual ?? null, sections: e.sections ?? [] };
  }
  const edit = o.edit;
  const instruction = edit ? edit.props.instruction ?? (edit.style === "custom" ? edit.note ?? undefined : undefined) : undefined;
  const hookOf: HookOrigin = {
    testId: o.test.id,
    projectId: original.id,
    title: original.title,
    hookId: o.hookId,
    line: hook.line,
    replaced: o.span,
    cut: o.cut ? { settings: o.cut.settings, entries } : null,
    look: edit ? { style: edit.style, ...(instruction ? { instruction } : {}), overlays: remap(edit.props.overlays) } : null,
  };

  const project = {
    id: newId,
    ownerId: original.ownerId,
    createdBy: o.actorId,
    title: hookVideoTitle(original.title, hook.title, o.test.hooks.filter((h) => h.projectId).length + 1),
    format: original.format,
    rig: original.rig,
    brief: original.brief,
    frameSpec: original.frameSpec ? remap(original.frameSpec) : null,
    status: "clips_ready",
    scriptNotes: original.scriptNotes,
    scriptVersion: original.scriptVersion,
    scriptHistory: [],
    approvedAt: new Date(),
    studioId: original.studioId,
    scenes: original.scenes ? remap(original.scenes) : null,
    presenter: original.presenter,
    reaction: original.reaction ? remap(original.reaction) : null,
    media: original.media ? remap(original.media) : null,
    hookOf,
  };
  const clipRows = [
    {
      id: hookClipId,
      projectId: newId,
      idx: 0,
      ...clipColumns(take.fields),
      durationS: take.durationS,
      prompt: take.prompt,
      frameAssetId: sceneFrame,
      takeFrameId: madeFrom,
      model: take.model,
      klingTaskId: take.klingTaskId,
      status: "done",
      videoAssetId: hookAssetId,
      version: 1,
      previous: [],
      transcript: null as Clip["transcript"],
    },
    ...body.map((c, i) => ({
      id: ids.get(c.id) as string,
      projectId: newId,
      idx: i + 1,
      section: c.section,
      speaker: c.speaker,
      line: c.line,
      register: c.register,
      action: c.action,
      editNote: c.editNote,
      cues: c.cues,
      listenerReactions: c.listenerReactions,
      kind: c.kind,
      watch: c.watch,
      show: c.show ? remap(c.show) : null,
      durationS: c.durationS,
      prompt: c.prompt,
      frameAssetId: c.frameAssetId ? ids.get(c.frameAssetId) ?? null : null,
      takeFrameId: c.takeFrameId ? ids.get(c.takeFrameId) ?? null : null,
      model: c.model,
      klingTaskId: c.klingTaskId,
      status: "done",
      videoAssetId: ids.get(c.videoAssetId as string) as string,
      version: c.version,
      previous: [],
      transcript: c.transcript,
    })),
  ];
  return { project, assets, clips: clipRows, copies: [...copies.entries()].map(([from, to]) => ({ from, to })) };
}

export async function makeHookVideo(test: Test, actorId: string, hookId: string): Promise<{ projectId: string; reused: boolean }> {
  if (!test.hooks.some((h) => h.id === hookId)) throw new HookError("That hook isn't in this test.", 404);
  const made = await alreadyMade(test, hookId);
  if (made) return { projectId: made, reused: true };
  const original = await hookProjectOf(test);
  if (!original) throw new HookError("The original video was deleted.", 404);
  const take = (await hookTakesOf(test.id)).get(hookId);
  if (!take || take.status !== "done" || !take.videoAssetId) throw new HookError("Make this hook's clip on Kling first.");
  const [takeAsset] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, take.videoAssetId)).limit(1);
  if (!takeAsset?.storagePath) throw new HookError("This hook's clip is missing. Make it again.");

  const clips = await clipsOf(original.id);
  if (clips.some((c) => c.status !== "done" || !c.videoAssetId)) throw new HookError("Every clip of the original has to be rendered before its hook can be swapped.");
  const span = hookSpan(clips.map((c) => c.section), test.read?.replaces ?? null);
  const body = clips.slice(span);
  if (body.length === 0) throw new HookError("That video is only a hook, so there's nothing to reuse.");

  const frames = await framesOf(original.id);
  const extraIds = [original.reaction?.sourceId, ...(original.media?.ids ?? []), ...body.map((c) => c.videoAssetId)].filter((v): v is string => Boolean(v));
  const extras = extraIds.length
    ? await db
        .select()
        .from(creativeAssets)
        .where(and(eq(creativeAssets.projectId, original.id), inArray(creativeAssets.id, extraIds)))
    : [];
  const missing = body.find((c) => !extras.some((a) => a.id === c.videoAssetId && a.storagePath));
  if (missing) throw new HookError(`Clip ${missing.idx + 1}'s video is missing from the original.`);
  const [cuts, edits] = await Promise.all([
    db.select().from(creativeCuts).where(eq(creativeCuts.projectId, original.id)).orderBy(desc(creativeCuts.version)),
    db.select().from(creativeEdits).where(eq(creativeEdits.projectId, original.id)).orderBy(desc(creativeEdits.version)).limit(1),
  ]);
  const plan = planHookVideo({
    original,
    clips,
    carried: [...frames, ...extras],
    span,
    take,
    takePath: takeAsset.storagePath,
    cut: cuts.find((c) => c.status === "approved") ?? cuts.find((c) => c.status === "ready") ?? null,
    edit: edits[0] ?? null,
    test,
    hookId,
    actorId,
    uuid: randomUUID,
  });

  const copied = plan.copies.map((c) => c.to);
  await copyFiles(plan.copies).catch(async (err) => {
    await removePaths(copied);
    console.error("[creative-studio] hook video copy failed:", err instanceof Error ? err.message : err);
    throw new HookError("Copying the original's clips failed. Try again.", 502);
  });
  try {
    await db.insert(creativeProjects).values(plan.project);
    await db.insert(creativeAssets).values(plan.assets);
    await db.insert(creativeClips).values(plan.clips);
  } catch (err) {
    // Half-made: take it all back (rows cascade from the project).
    await db.delete(creativeProjects).where(eq(creativeProjects.id, plan.project.id)).catch(() => {});
    await removePaths(copied);
    console.error("[creative-studio] hook video failed:", err instanceof Error ? err.message : err);
    throw new HookError("Making the video failed. Try again.", 500);
  }
  await markMade(test, hookId, plan.project.id);
  return { projectId: plan.project.id, reused: false };
}

/** A dropped-in video: a new video set up to recreate it, opening with the hook. */
export async function recreateWithHook(test: Test, actorId: string, hookId: string): Promise<{ projectId: string; reused: boolean }> {
  const hook = test.hooks.find((h) => h.id === hookId);
  if (!hook) throw new HookError("That hook isn't in this test.", 404);
  const made = await alreadyMade(test, hookId);
  if (made) return { projectId: made, reused: true };
  const up = test.upload;
  const m = test.media;
  if (test.source !== "upload" || !up || !m) throw new HookError("This works for a video you dropped in.");
  if (m.durationS && m.durationS > SOURCE_MAX_SECONDS + 0.5) throw new HookError(tooLongMessage(m.durationS));
  if (up.sizeBytes && up.sizeBytes > SOURCE_MAX_BYTES) throw new HookError("That file is too big to re-make from. Export it at 1080p and drop it in again.");
  const ext = SOURCE_TYPES[up.mime];
  if (!ext) throw new HookError("Re-making needs an MP4 or MOV video.");

  const studio = await studioById(test.ownerId, test.studioId);
  const presenter = (await presenterForStudio(test.ownerId, studio.id, studio.defaultPresenterId)) ?? null;
  const newId = randomUUID();
  const assetId = randomUUID();
  const path = `${newId}/media/${randomUUID()}.${ext}`;
  await copyFiles([{ from: up.path, to: path }]).catch((err) => {
    console.error("[creative-studio] hook recreate copy failed:", err instanceof Error ? err.message : err);
    throw new HookError("Copying the video failed. Try again.", 502);
  });
  const vertical = !(m.width && m.height) || m.height >= m.width;
  try {
    await db.insert(creativeProjects).values({
      id: newId,
      ownerId: test.ownerId,
      createdBy: actorId,
      studioId: test.studioId,
      title: hookVideoTitle(test.title, hook.title, test.hooks.filter((h) => h.projectId).length + 1),
      format: vertical ? "ad_9x16" : "vsl_16x9",
      rig: "solo_locked",
      brief: {
        ...EMPTY_BRIEF,
        direction: `Recreate this video, but open with this hook instead of the one it has, word for word: "${hook.line}" Then keep the rest of its structure, message and pacing.`,
      },
      presenter,
      media: { mode: "recreate", ids: [assetId], scriptFor: null },
      hookOf: { testId: test.id, projectId: null, title: test.title, hookId, line: hook.line, replaced: 0 },
    });
    await db.insert(creativeAssets).values({
      id: assetId,
      projectId: newId,
      kind: "media_video",
      storagePath: path,
      mime: up.mime,
      width: m.width,
      height: m.height,
      durationMs: m.durationS ? Math.round(m.durationS * 1000) : null,
      source: "upload",
      status: "processing",
      metadata: { filename: up.filename, role: "recreate" },
    });
  } catch (err) {
    await db.delete(creativeProjects).where(eq(creativeProjects.id, newId)).catch(() => {});
    await removePaths([path]);
    console.error("[creative-studio] hook recreate failed:", err instanceof Error ? err.message : err);
    throw new HookError("Starting the new video failed. Try again.", 500);
  }
  await markMade(test, hookId, newId);
  return { projectId: newId, reused: false };
}
