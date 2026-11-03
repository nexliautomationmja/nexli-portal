import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  creativeAssets,
  creativeClips,
  creativeProjects,
  type ClipFields,
  type ScriptSnapshot,
} from "@/lib/creative-studio/tables";
import { buildKlingPrompt, clipDuration, klingModelFor } from "@/lib/creative-studio/prompts";
import { signPaths } from "@/lib/creative-studio/storage";

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;

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
  };
}

/** Duration + full Kling prompt for a clip, from the project's format, rig and frame. */
export function derivedClip(project: Project, fields: ClipFields) {
  return {
    durationS: clipDuration(fields.line),
    prompt: buildKlingPrompt({ format: project.format, rig: project.rig, frame: project.frameSpec, clip: fields }),
    model: klingModelFor(project.rig),
  };
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
  const [frames, clips] = await Promise.all([framesOf(project.id), clipsOf(project.id)]);
  const signed = await signPaths(frames.map((f) => f.storagePath));
  return {
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
    clips: clips.map((c) => ({
      id: c.id,
      idx: c.idx,
      ...clipFieldsOf(c),
      durationS: c.durationS,
      prompt: c.prompt,
      model: c.model,
      status: c.status,
      version: c.version,
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
  next: { frameSpec: Project["frameSpec"]; notes: string | null; clips: ClipFields[] },
  reason: string
): Promise<void> {
  const snapshot = await snapshotOf(project, reason);
  const history = [...(project.scriptHistory ?? []), ...(snapshot ? [snapshot] : [])].slice(-20);
  const version = project.scriptVersion + 1;
  const updated: Project = { ...project, frameSpec: next.frameSpec };
  const frames = await framesOf(project.id);
  const primaryFrame = frames[0]?.id ?? null;

  await db.delete(creativeClips).where(eq(creativeClips.projectId, project.id));
  if (next.clips.length > 0) {
    await db.insert(creativeClips).values(
      next.clips.map((fields, i) => ({
        projectId: project.id,
        idx: i,
        ...fields,
        speaker: fields.speaker ?? null,
        ...derivedClip(updated, fields),
        frameAssetId: primaryFrame,
      }))
    );
  }
  await db
    .update(creativeProjects)
    .set({
      frameSpec: next.frameSpec,
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
