import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativePresenters, creativeProjects } from "@/lib/creative-studio/tables";
import { avatarPhotos, trialPhotoOf, type AvatarRow } from "@/lib/creative-studio/avatar";
import { approveScript } from "@/lib/creative-studio/approve";
import { readStorage, setOpeningFrame } from "@/lib/creative-studio/frames";
import { removePaths } from "@/lib/creative-studio/storage";
import { presenterInfo } from "@/lib/creative-studio/presenters";
import { EMPTY_BRIEF } from "@/lib/creative-studio/prompts";
import { submitClips, type SubmitReport } from "@/lib/creative-studio/render";
import { generateScript } from "@/lib/creative-studio/script";
import { clipsOf, framesOf, replaceScript, scriptInputFor } from "@/lib/creative-studio/service";

/**
 * An avatar's trial video (Nov 2026): right after it's made, it introduces
 * itself on camera — "Hey, I'm Marcus, and…" — in a line Claude wrote from
 * its look and personality. It's a normal Creative Studio video (the avatar
 * as presenter, its main photo as the frame), so the clips land on Kling with
 * its Element, then auto-cut, captions and download work as for any video.
 */

type Project = typeof creativeProjects.$inferSelect;

/** The line it says: Claude's intro (with today's name, if it was renamed since), or a plain fallback. */
export function trialLine(row: Pick<AvatarRow, "name" | "avatarRead">): string {
  const read = row.avatarRead;
  const name = row.name.trim();
  let intro = read?.intro?.trim() ?? "";
  const first = read?.names?.[0]?.trim();
  if (intro && first && first !== name) intro = intro.replace(new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), name);
  return intro || `Hey, I'm ${name} — and I help firms like yours stand out.`;
}

/** What the script writer is told: the line word for word, at most two clips, to camera, in their personality. */
export function trialDirection(row: Pick<AvatarRow, "name" | "pronoun" | "avatarRead">, selfie = false): string {
  const he = row.pronoun === "he";
  const personality = row.avatarRead?.personality?.trim();
  return [
    `A short trial video that introduces ${row.name}, a new on-camera presenter, so firms can see and hear ${he ? "him" : "her"}.`,
    selfie
      ? `The frame is a selfie: ${row.name} holds the phone and talks straight into it (a handheld selfie shot), and says exactly this, word for word:`
      : `${row.name} talks straight to the camera in this one frame and says exactly this, word for word:`,
    `"${trialLine(row)}"`,
    "Use at most two clips (split the line at a natural pause only if it's too long for one clip), both to camera. No other lines, no offer, no call to action.",
    personality ? `The delivery carries ${he ? "his" : "her"} personality: ${personality}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The trial video to (re)write: the last one if it never went to Kling, else a new one. */
async function trialProject(ownerId: string, actorId: string, row: AvatarRow, fresh: boolean, selfie: boolean): Promise<Project> {
  if (row.trialProjectId && !fresh) {
    const [last] = await db.select().from(creativeProjects).where(and(eq(creativeProjects.id, row.trialProjectId), eq(creativeProjects.ownerId, ownerId))).limit(1);
    if (last && (last.status === "draft" || last.status === "scripted")) return last;
  }
  const [created] = await db
    .insert(creativeProjects)
    .values({
      ownerId,
      createdBy: actorId,
      studioId: row.studioId,
      title: `${row.name} · trial video`,
      format: "ad_9x16",
      rig: selfie ? "solo_selfie" : "solo_locked",
      brief: { ...EMPTY_BRIEF, direction: trialDirection(row, selfie) },
      presenter: presenterInfo(row),
    })
    .returning();
  await db.update(creativePresenters).set({ trialProjectId: created.id, updatedAt: new Date() }).where(eq(creativePresenters.id, row.id));
  return created;
}

/**
 * Step 1: the video, its frame (the main photo, cropped to 9:16) and its
 * script (Claude, from the frame and the direction). `fresh` = a new video
 * even if the last one is still waiting ("Make the trial video again").
 */
export async function writeTrial(ownerId: string, actorId: string, row: AvatarRow, fresh = false): Promise<Project> {
  if (!row.lockedAt) throw new Error(`Lock ${row.name || "the avatar"} in first.`);
  const photos = (await avatarPhotos(ownerId, row.id)).filter((p) => p.storagePath);
  const frameId = trialPhotoOf(row, photos.map((p) => p.id));
  const frame = photos.find((p) => p.id === frameId);
  if (!frame?.storagePath) throw new Error("The avatar has no photos.");
  const selfie = Boolean(row.avatarRead?.selfie && row.avatarRead.selfie === frame.id);

  let project = await trialProject(ownerId, actorId, row, fresh, selfie);
  // The line may have changed since the last try.
  const direction = trialDirection(row, selfie);
  if (project.brief?.direction !== direction || JSON.stringify(project.presenter) !== JSON.stringify(presenterInfo(row))) {
    [project] = await db
      .update(creativeProjects)
      .set({ brief: { ...project.brief, direction }, presenter: presenterInfo(row), title: `${row.name} · trial video`, updatedAt: new Date() })
      .where(eq(creativeProjects.id, project.id))
      .returning();
  }
  // Its frame: the selfie-style photo (else the main one), cropped for a 9:16 ad — once, or again if another photo was picked.
  const frames = await framesOf(project.id);
  if (!frames.some((f) => (f.metadata as { avatarPhotoId?: string } | null)?.avatarPhotoId === frame.id)) {
    await setOpeningFrame(project, await readStorage(frame.storagePath), "avatar", { avatarId: row.id, avatarPhotoId: frame.id });
    if (frames.length) await removeOldFrames(project.id, frames.map((f) => f.id));
  }
  const result = await generateScript(await scriptInputFor(project, "write"));
  await replaceScript(project, { frameSpec: result.frame, notes: result.notes, clips: result.clips, rig: result.rig, title: `${row.name} · trial video` }, "Replaced by a new script");
  const [written] = await db.select().from(creativeProjects).where(eq(creativeProjects.id, project.id)).limit(1);
  return written;
}

/** A not-yet-rendered trial video that got a different photo: its old frames go (the new one is first). */
async function removeOldFrames(projectId: string, ids: string[]) {
  const old = await db.select({ path: creativeAssets.storagePath }).from(creativeAssets).where(and(eq(creativeAssets.projectId, projectId), inArray(creativeAssets.id, ids)));
  await db.delete(creativeAssets).where(and(eq(creativeAssets.projectId, projectId), inArray(creativeAssets.id, ids)));
  await removePaths(old.map((o) => o.path));
}

/** Step 2: approve it and send the clips to Kling (each clip with the avatar's Element). */
export async function renderTrial(token: string, project: Project): Promise<SubmitReport> {
  let current = project;
  if (current.status === "draft") throw new Error("The trial script isn't written yet.");
  if (current.status === "scripted") {
    const approved = await approveScript(current);
    if ("error" in approved) throw new Error(approved.error);
    current = approved.project;
  }
  const clips = (await clipsOf(current.id)).filter((c) => c.status === "draft" && !c.klingTaskId);
  return submitClips(token, current, clips);
}
