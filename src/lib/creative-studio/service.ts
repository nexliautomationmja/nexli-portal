import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  creativeAssets,
  creativeClips,
  creativeCuts,
  creativeEdits,
  creativeProjects,
  isWaiting,
  type ClipFields,
  type ManusActivitySnapshot,
  type SceneSlot,
  type ScriptSnapshot,
} from "@/lib/creative-studio/tables";
import { buildKlingPrompt, clipDuration, isStory, klingModelForClip, presenterOf } from "@/lib/creative-studio/prompts";
import { signPaths } from "@/lib/creative-studio/storage";
import { normalizeCopy } from "@/lib/creative-studio/ad-copy";
import { firmBrief, studioById, studioRef } from "@/lib/creative-studio/studios";
import type { ScriptInput } from "@/lib/creative-studio/script";

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;
type Asset = typeof creativeAssets.$inferSelect;

export function clipFieldsOf(c: Clip): ClipFields {
  return {
    section: c.section,
    speaker: c.speaker ?? null,
    line: c.line,
    register: c.register,
    action: c.action,
    editNote: c.editNote,
    cues: c.cues,
    listenerReactions: c.listenerReactions ?? [],
    kind: c.kind ?? "to_camera",
    frameId: c.frameAssetId ?? null,
  };
}

/** The creative_clips columns a clip's fields write (its scene goes in frame_asset_id, set by the caller). */
export function clipColumns(f: ClipFields) {
  return {
    section: f.section,
    speaker: f.speaker ?? null,
    line: f.line,
    register: f.register,
    action: f.action,
    editNote: f.editNote,
    cues: f.cues,
    listenerReactions: f.listenerReactions,
    kind: f.kind ?? "to_camera",
  };
}

/** Duration + full Kling prompt + model for a clip, from the project's format, rig, frame (scenes) and presenter. */
export function derivedClip(project: Project, fields: ClipFields) {
  return {
    durationS: clipDuration(fields.kind === "silent" ? "" : fields.line),
    prompt: buildKlingPrompt({
      format: project.format,
      rig: project.rig,
      frame: project.frameSpec,
      clip: fields,
      presenter: presenterOf(project),
    }),
    model: klingModelForClip(project.rig, project.frameSpec, fields),
  };
}

/**
 * The video's scenes in story order. A classic one-frame video (scenes null)
 * has one scene: its opening frame.
 */
export function scenesOf(project: Pick<Project, "scenes">, frames: Pick<Asset, "id">[]): SceneSlot[] {
  if (project.scenes) return project.scenes;
  const first = frames[0];
  return first ? [{ id: first.id, label: "", shot: "", frameId: first.id }] : [];
}

/** A story video: several scenes, a chosen presenter, or a script already written as a story. */
export function storyVideo(project: Project, scenes: SceneSlot[], mode: "write" | "change"): boolean {
  if (mode === "change") return isStory(project.frameSpec);
  return scenes.filter((s) => s.frameId).length > 1 || Boolean(project.presenter);
}

/**
 * What Claude needs to write ("write") or change ("change") this video's
 * script. One-frame videos send exactly what they always did: every frame
 * when writing (`classicFrames: "all"`), the opening frame otherwise.
 */
export async function scriptInputFor(
  project: Project,
  mode: "write" | "change",
  classicFrames: "all" | "first" = mode === "write" ? "all" : "first"
): Promise<ScriptInput> {
  const frames = await framesOf(project.id);
  const scenes = scenesOf(project, frames).filter((s) => s.frameId);
  const story = storyVideo(project, scenes, mode);
  const studio = await studioById(project.ownerId, project.studioId);
  const base = { title: project.title, format: project.format, rig: project.rig, brief: project.brief, firm: firmBrief(studio) };
  if (!story) {
    const pick = classicFrames === "all" ? frames : frames.slice(0, 1);
    const signed = await signPaths(pick.map((f) => f.storagePath));
    return { ...base, frameUrls: pick.map((f) => (f.storagePath ? signed.get(f.storagePath) : undefined)).filter(Boolean) as string[] };
  }
  const byId = new Map(frames.map((f) => [f.id, f]));
  const sceneFrames = scenes.slice(0, 8).flatMap((sc) => {
    const f = sc.frameId ? byId.get(sc.frameId) : undefined;
    return f?.storagePath ? [{ sc, path: f.storagePath }] : [];
  });
  const signed = await signPaths(sceneFrames.map((x) => x.path));
  const list = sceneFrames
    .map(({ sc, path }) => ({ frameId: sc.frameId as string, label: sc.label, url: signed.get(path) ?? "" }))
    .filter((x) => x.url);
  return { ...base, frameUrls: list.map((x) => x.url), story: { scenes: list }, presenter: presenterOf(project) };
}

export async function framesOf(projectId: string) {
  return db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.projectId, projectId), eq(creativeAssets.kind, "frame")))
    .orderBy(asc(creativeAssets.sort), asc(creativeAssets.createdAt));
}

export async function clipsOf(projectId: string) {
  return db
    .select()
    .from(creativeClips)
    .where(eq(creativeClips.projectId, projectId))
    .orderBy(asc(creativeClips.idx));
}

/** Everything the project page needs, with signed frame URLs. */
export async function projectDetail(project: Project) {
  const [frames, clips, extras, cuts, edits, studio] = await Promise.all([
    framesOf(project.id),
    clipsOf(project.id),
    db
      .select()
      .from(creativeAssets)
      .where(and(eq(creativeAssets.projectId, project.id), inArray(creativeAssets.kind, ["frame_option", "manus_task", "final_cut", "render", "ad_copy"])))
      .orderBy(asc(creativeAssets.createdAt)),
    db.select().from(creativeCuts).where(eq(creativeCuts.projectId, project.id)).orderBy(asc(creativeCuts.version)),
    db.select().from(creativeEdits).where(eq(creativeEdits.projectId, project.id)).orderBy(asc(creativeEdits.version)),
    studioById(project.ownerId, project.studioId),
  ]);
  const cutAssetIds = cuts.map((c) => c.assetId).filter((v): v is string => Boolean(v));
  const cutAssets = cutAssetIds.length ? await db.select().from(creativeAssets).where(inArray(creativeAssets.id, cutAssetIds)) : [];
  const cutPath = new Map(cutAssets.map((a) => [a.id, a.storagePath]));
  const options = extras.filter((a) => a.kind === "frame_option");
  const manusTasks = extras.filter((a) => a.kind === "manus_task");
  const finalCuts = extras.filter((a) => a.kind === "final_cut");
  const renders = new Map(extras.filter((a) => a.kind === "render").map((a) => [a.id, a.storagePath]));
  const videoIds = clips.map((c) => c.videoAssetId).filter((v): v is string => Boolean(v));
  const videos = videoIds.length
    ? await db.select().from(creativeAssets).where(inArray(creativeAssets.id, videoIds))
    : [];
  const videoPath = new Map(videos.map((v) => [v.id, v.storagePath]));
  const signed = await signPaths(
    [...frames, ...videos, ...options, ...finalCuts, ...cutAssets, ...extras.filter((a) => a.kind === "render")].map((a) => a.storagePath),
    6 * 3600
  );
  const url = (path: string | null) => (path ? signed.get(path) ?? null : null);
  // Renders too big to copy into storage stay in the Lambda bucket (signed there).
  const s3Outputs = new Map<string, string>();
  const onS3 = edits.filter((e) => e.status === "done" && !e.outputAssetId && e.outputKey && e.renderBucket);
  if (onS3.length) {
    const { presignOutput } = await import("@/lib/creative-studio/remotion");
    await Promise.all(
      onS3.map(async (e) => {
        const u = await presignOutput(e.renderBucket!, e.outputKey!).catch(() => null);
        if (u) s3Outputs.set(e.id, u);
      })
    );
  }
  const latestEditId = edits[edits.length - 1]?.id;
  const frameById = new Map(frames.map((f) => [f.id, f]));
  return {
    /** The video's scenes in story order (one for a classic one-frame video). */
    scenes: scenesOf(project, frames).map((sc, i) => {
      const f = sc.frameId ? frameById.get(sc.frameId) : undefined;
      return {
        id: sc.id,
        number: i + 1,
        label: sc.label,
        shot: sc.shot,
        frameId: sc.frameId,
        url: f?.storagePath ? signed.get(f.storagePath) ?? null : null,
        width: f?.width ?? null,
        height: f?.height ?? null,
      };
    }),
    /** The script was written as a story (scene descriptions per frame). */
    story: isStory(project.frameSpec),
    project: {
      id: project.id,
      title: project.title,
      format: project.format,
      rig: project.rig,
      brief: project.brief,
      frameSpec: project.frameSpec,
      status: project.status,
      scriptNotes: project.scriptNotes,
      scriptVersion: project.scriptVersion,
      history: (project.scriptHistory ?? []).map((h) => ({
        version: h.version,
        createdAt: h.createdAt,
        reason: h.reason,
        clips: h.clips.length,
      })),
      direction: project.brief?.direction ?? "",
      batchId: project.batchId ?? null,
      /** Which studio this video lives in (Nexli's or a client firm's). */
      studio: studioRef(studio),
      /** The chosen presenter (null = the studio's default: Daniela in Nexli's studio). */
      presenter: project.presenter ?? null,
      approvedAt: project.approvedAt?.toISOString() ?? null,
      updatedAt: project.updatedAt.toISOString(),
    },
    frames: frames.map((f) => ({
      id: f.id,
      url: f.storagePath ? signed.get(f.storagePath) ?? null : null,
      width: f.width,
      height: f.height,
      source: f.source,
      sort: f.sort,
    })),
    frameOptions: options.map((o) => ({ id: o.id, url: url(o.storagePath), width: o.width, height: o.height })),
    manus: manusTasks.map((t) => ({
      id: t.id,
      status: t.status,
      error: t.error,
      shot: ((t.metadata ?? {}) as { shot?: string }).shot ?? "",
      taskUrl: ((t.metadata ?? {}) as { taskUrl?: string | null }).taskUrl ?? null,
      activity: ((t.metadata ?? {}) as { activity?: ManusActivitySnapshot }).activity ?? null,
      waiting:
        t.status === "waiting"
          ? (((t.metadata ?? {}) as { waiting?: { kind: "question" | "confirm"; prompt: string; options: string[] } }).waiting ?? null)
          : null,
      startedAt: t.createdAt.toISOString(),
    })),
    finalCuts: finalCuts.map((f) => ({
      id: f.id,
      url: url(f.storagePath),
      note: ((f.metadata ?? {}) as { note?: string }).note ?? "",
      filename: ((f.metadata ?? {}) as { filename?: string }).filename ?? "final cut",
      uploadedAt: f.createdAt.toISOString(),
    })),
    cuts: cuts.map((c) => ({
      id: c.id,
      version: c.version,
      status: c.status,
      note: c.note,
      error: c.error,
      settings: c.settings,
      plan: c.plan.map((pl) => ({
        clipId: pl.clipId,
        version: pl.version,
        segments: pl.segments,
        sourceS: pl.sourceS,
        keptS: pl.keptS,
        overrides: pl.overrides ?? [],
        manual: pl.manual ?? null,
        sections: pl.sections ?? [],
      })),
      url: c.assetId ? url(cutPath.get(c.assetId) ?? null) : null,
      createdAt: c.createdAt.toISOString(),
    })),
    edits: edits.map((e) => ({
      id: e.id,
      version: e.version,
      style: e.style,
      status: e.status,
      progress: e.progress,
      /** In line for a free AWS Lambda slot (render-queue.ts). */
      waiting: isWaiting(e),
      renderAttempts: e.renderAttempts,
      finalCutId: e.finalCutAssetId,
      durationS: e.props.durationS,
      // The full layout only for the newest version (VSL word lists are long).
      props: e.id === latestEditId ? e.props : null,
      notes: e.notes,
      note: e.note,
      error: e.error,
      specs: e.specs ?? null,
      outputUrl: e.outputAssetId ? url(renders.get(e.outputAssetId) ?? null) : s3Outputs.get(e.id) ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    adCopies: extras
      .filter((a) => a.kind === "ad_copy")
      .map((a) => ({ id: a.id, ...normalizeCopy(a.metadata), createdAt: a.createdAt.toISOString() })),
    clips: clips.map((c) => ({
      id: c.id,
      idx: c.idx,
      ...clipFieldsOf(c),
      durationS: c.durationS,
      prompt: c.prompt,
      model: c.model,
      status: c.status,
      version: c.version,
      error: c.error,
      videoUrl: c.videoAssetId ? signed.get(videoPath.get(c.videoAssetId) ?? "") ?? null : null,
      previousTakes: (c.previous ?? []).length,
      words: c.transcript && c.transcript.version === c.version ? c.transcript.words : null,
    })),
  };
}

export type ProjectDetail = Awaited<ReturnType<typeof projectDetail>>;

/** Snapshot of the current script, for the version history (kept so the user can revert). */
export async function snapshotOf(project: Project, reason: string): Promise<ScriptSnapshot | null> {
  const clips = await clipsOf(project.id);
  if (clips.length === 0) return null;
  return {
    version: project.scriptVersion,
    rig: project.rig,
    createdAt: new Date().toISOString(),
    reason,
    frameSpec: project.frameSpec,
    notes: project.scriptNotes,
    clips: clips.map(clipFieldsOf),
  };
}

/**
 * Replace the project's clips with `clips` (a new script version). The
 * current script is pushed onto the history first. No transactions on
 * neon-http, so rows are replaced delete-then-insert.
 */
export async function replaceScript(
  project: Project,
  next: {
    frameSpec: Project["frameSpec"];
    notes: string | null;
    clips: ClipFields[];
    rig?: Project["rig"];
    title?: string;
  },
  reason: string
): Promise<void> {
  const snapshot = await snapshotOf(project, reason);
  const history = [...(project.scriptHistory ?? []), ...(snapshot ? [snapshot] : [])].slice(-20);
  const version = project.scriptVersion + 1;
  const rig = next.rig ?? project.rig;
  const updated: Project = { ...project, frameSpec: next.frameSpec, rig };
  const frames = await framesOf(project.id);
  const scenes = scenesOf(project, frames);
  const sceneFrames = new Set(scenes.map((sc) => sc.frameId).filter(Boolean));
  const primaryFrame = scenes.find((sc) => sc.frameId)?.frameId ?? frames[0]?.id ?? null;

  await db.delete(creativeClips).where(eq(creativeClips.projectId, project.id));
  if (next.clips.length > 0) {
    await db.insert(creativeClips).values(
      next.clips.map((fields, i) => {
        // A story clip plays in its own scene; anything else opens on scene 1.
        const frameId = fields.frameId && sceneFrames.has(fields.frameId) ? fields.frameId : primaryFrame;
        const f: ClipFields = { ...fields, frameId };
        return {
          projectId: project.id,
          idx: i,
          ...clipColumns(f),
          ...derivedClip(updated, f),
          frameAssetId: frameId,
        };
      })
    );
  }
  await db
    .update(creativeProjects)
    .set({
      frameSpec: next.frameSpec,
      rig,
      ...(next.title && project.title === "Untitled video" ? { title: next.title } : {}),
      scriptNotes: next.notes,
      scriptVersion: version,
      scriptHistory: history,
      status: "scripted",
      approvedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(creativeProjects.id, project.id));
}

/** Editing an approved script unlocks it again. */
export async function touchProject(project: Project): Promise<void> {
  await db
    .update(creativeProjects)
    .set({
      updatedAt: new Date(),
      ...(project.status === "approved" ? { status: "scripted", approvedAt: null } : {}),
    })
    .where(eq(creativeProjects.id, project.id));
}

/** Rebuild every clip's prompt (after the frame description or rig changes). */
export async function rebuildPrompts(project: Project): Promise<void> {
  const clips = await clipsOf(project.id);
  for (const c of clips) {
    const d = derivedClip(project, clipFieldsOf(c));
    await db
      .update(creativeClips)
      .set({ prompt: d.prompt, durationS: d.durationS, model: d.model, updatedAt: new Date() })
      .where(eq(creativeClips.id, c.id));
  }
}
