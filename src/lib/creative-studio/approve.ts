import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { clipsOf, rebuildPrompts } from "@/lib/creative-studio/service";
import { scriptPresenterMismatch } from "@/lib/creative-studio/prompts";
import { sourceMeta, sourceOf } from "@/lib/creative-studio/source";

type Project = typeof creativeProjects.$inferSelect;

/**
 * Approve the script (locks it for Kling rendering; nothing renders before
 * approval). The approve route and an avatar's trial video both go through
 * here. Returns the approved project, or why it can't be approved yet.
 */
export async function approveScript(project: Project): Promise<{ project: Project } | { error: string; status: number }> {
  if ((await clipsOf(project.id)).length === 0) {
    return { error: "There's no script to approve yet", status: 400 };
  }
  // Kling would get the old presenter's name and look with the new presenter's frames.
  if (scriptPresenterMismatch(project.frameSpec, project.presenter)) {
    return { error: `This script was written for someone else. Rewrite it for ${project.presenter?.name || "the studio's presenter"} first.`, status: 400 };
  }
  // A reaction video: once approved its video can't change, so it must be ready for the edit's corner first.
  if (project.reaction) {
    const source = await sourceOf(project);
    const meta = source ? sourceMeta(source) : null;
    if (!source || !meta?.proxyPath) {
      return {
        error: !source
          ? "Upload the video to react to first."
          : meta?.proxyError
            ? `${meta.proxyError} It has to be ready before approving, because the video can't change after that.`
            : "The video's light copy for the edit is still being made. Approve once it's ready (it can't change after that).",
        status: 409,
      };
    }
    if (project.reaction.scriptFor !== source.id) {
      return { error: "The script was written for another video. Rewrite it for this one first.", status: 409 };
    }
  }
  // Kling gets prompts built by today's rules (e.g. a script written before only Daniela had a set voice).
  await rebuildPrompts(project);
  const [updated] = await db
    .update(creativeProjects)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(creativeProjects.id, project.id))
    .returning();
  return { project: updated };
}
