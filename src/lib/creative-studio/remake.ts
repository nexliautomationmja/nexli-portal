import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips, creativeProjects, type ClipFields } from "@/lib/creative-studio/tables";
import { clipColumns, clipFieldsOf, clipsOf, derivedClip, scriptInputFor } from "@/lib/creative-studio/service";
import { rewriteClip } from "@/lib/creative-studio/script";
import { reactionInputFor, readySource, rewriteReactionClip } from "@/lib/creative-studio/reaction";
import { redescribeFrames } from "@/lib/creative-studio/redescribe";
import { framesToRedescribe } from "@/lib/creative-studio/remake-shared";
import { submitClips, type SubmitReport } from "@/lib/creative-studio/render";

/**
 * Re-make clips that already have a take (Nov 2026): after a new frame, or
 * just because. Frames whose description is still the old frame's are
 * re-described first (lines kept), each old take is kept in the clip's
 * history, and the clips go to Kling again from the frame they use now.
 * The single-clip "Fix this clip" redo goes through here too.
 */

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;

export class RemakeError extends Error {}

/** One clip's redo: the old take into its history, a new version, ready to send. */
export function resetColumns(project: Project, clip: Clip, fields: ClipFields) {
  const hadTake = Boolean(clip.klingTaskId || clip.videoAssetId);
  const previous = hadTake
    ? [
        ...(clip.previous ?? []),
        {
          version: clip.version,
          klingTaskId: clip.klingTaskId,
          videoAssetId: clip.videoAssetId,
          frameId: clip.takeFrameId ?? clip.frameAssetId,
          line: clip.line,
          cues: clip.cues,
          status: clip.status,
          error: clip.error,
          at: new Date().toISOString(),
        },
      ]
    : clip.previous ?? [];
  return {
    ...clipColumns(fields),
    ...derivedClip(project, fields),
    // A redo stays in its scene: the frame the clip uses now.
    frameAssetId: clip.frameAssetId,
    version: hadTake ? clip.version + 1 : clip.version,
    previous,
    klingTaskId: null,
    videoAssetId: null,
    takeFrameId: null,
    status: "draft",
    error: null,
    updatedAt: new Date(),
  };
}

export async function remakeClips(
  token: string,
  project: Project,
  chosen: Clip[],
  opts: { note?: string; line?: string; cues?: string } = {}
): Promise<{ report: SubmitReport; notes: string }> {
  if (chosen.length === 0) throw new RemakeError("Pick the clips to re-make.");
  if (chosen.some((c) => c.status === "rendering" || c.status === "queued")) {
    throw new RemakeError(chosen.length === 1 ? "That clip is already rendering." : "Some of those clips are still rendering. Wait for them first.");
  }
  // A new frame: Claude describes it before anything goes to Kling (lines kept).
  let current = project;
  let notes = "";
  const stale = framesToRedescribe(project.frameSpec, chosen);
  if (stale.length) {
    const d = await redescribeFrames(project, stale);
    current = d.project;
    notes = d.notes;
  }
  const ids = chosen.map((c) => c.id);
  const all = await clipsOf(project.id);
  const fresh = all.filter((c) => ids.includes(c.id));

  const reset: Clip[] = [];
  for (const clip of fresh) {
    let fields: ClipFields = {
      ...clipFieldsOf(clip),
      ...(opts.line?.trim() ? { line: opts.line.trim().slice(0, 2000) } : {}),
      ...(typeof opts.cues === "string" ? { cues: opts.cues.slice(0, 2000) } : {}),
    };
    // "What should change?" on one clip: Claude adjusts its line or cue first.
    const note = opts.note?.trim();
    if (note && fresh.length === 1) {
      const instruction = `${note} (This clip already rendered on Kling; fix it with a targeted change to the line or a pronunciation cue, per the framework's redo pattern.)`;
      const index = all.findIndex((c) => c.id === clip.id);
      const ready = current.reaction ? await readySource(current) : null;
      if (ready && "error" in ready) throw new RemakeError(ready.error);
      const rewritten = ready
        ? await rewriteReactionClip({ input: await reactionInputFor(current, ready.source), frame: current.frameSpec, clips: all.map(clipFieldsOf), index, instruction })
        : await rewriteClip({ input: await scriptInputFor(current, "change"), frame: current.frameSpec, clips: all.map(clipFieldsOf), index, instruction });
      // The prompt is built for the scene the clip is in now (Claude can't move it).
      // A clip on screen stays on its line (the edit shows it over the fixed take).
      fields = { ...rewritten.clip, frameId: clip.frameAssetId ?? null, ...(clip.show ? { show: clip.show } : {}) };
    }
    const [updated] = await db.update(creativeClips).set(resetColumns(current, clip, fields)).where(eq(creativeClips.id, clip.id)).returning();
    reset.push(updated);
  }
  const report = await submitClips(token, current, reset);
  return { report, notes };
}

/** This project's clips by id (all of them, or null when one isn't this project's). */
export async function clipsById(projectId: string, ids: string[]): Promise<Clip[] | null> {
  const unique = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (unique.length === 0 || unique.length !== new Set(ids).size) return null;
  const rows = await db.select().from(creativeClips).where(inArray(creativeClips.id, unique));
  if (rows.length !== unique.length || rows.some((r) => r.projectId !== projectId)) return null;
  return rows.sort((a, b) => a.idx - b.idx);
}
