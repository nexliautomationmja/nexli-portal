import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { mediaItems, mediaReady, sourceMeta } from "@/lib/creative-studio/source";

type Project = typeof creativeProjects.$inferSelect;

/**
 * Uploaded videos shown on screen or recreated (Nov 2026): the checks the
 * script and approve steps share.
 */

/** Every clip read (and light-copied when it's shown), or why not yet. */
export async function readyMedia(project: Project): Promise<{ items: Awaited<ReturnType<typeof mediaItems>> } | { error: string; status: number }> {
  const items = await mediaItems(project);
  const recreate = project.media?.mode === "recreate";
  if (items.length === 0) {
    return { error: recreate ? "Upload the video to recreate first." : "Upload the clips to show on screen first.", status: 400 };
  }
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (mediaReady(a)) continue;
    const m = sourceMeta(a);
    const which = recreate ? "The video to recreate" : `Clip ${i + 1}`;
    const failed = m.analyzeError ?? m.proxyError;
    return {
      error: failed ? `${which}: ${failed}` : `${which} is still being prepared. The script is written once ${recreate ? "it's" : "every clip is"} ready.`,
      status: 409,
    };
  }
  return { items };
}

/** The clips the script was just written for (other clips later = the script needs rewriting). */
export async function markMediaWritten(project: Project): Promise<void> {
  if (!project.media) return;
  await db
    .update(creativeProjects)
    .set({ media: { ...project.media, scriptFor: project.media.ids.join() } })
    .where(eq(creativeProjects.id, project.id));
}

/** Clips on screen can't change after approval, so they must be ready and the script written for them. */
export async function mediaApproveProblem(project: Project): Promise<string | null> {
  if (!project.media) return null;
  const ready = await readyMedia(project);
  if ("error" in ready) return `${ready.error} It has to be ready before approving, because the videos can't change after that.`;
  if (project.media.scriptFor !== project.media.ids.join()) {
    return project.media.mode === "recreate"
      ? "The script was written for another video. Rewrite it for this one first."
      : "The clips changed since the script was written. Rewrite it for these clips first.";
  }
  return null;
}
