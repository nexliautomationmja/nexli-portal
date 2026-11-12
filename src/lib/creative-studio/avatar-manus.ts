import { randomUUID } from "crypto";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativePresenters, type AvatarPhotoTask } from "@/lib/creative-studio/tables";
import { avatarPhotos, type AvatarRow } from "@/lib/creative-studio/avatar";
import { AVATAR_MAX_PHOTOS, KLING_EXTRA_PHOTOS } from "@/lib/creative-studio/avatar-shared";
import { writeStorage } from "@/lib/creative-studio/frames";
import { checkFrameTask, replyToTask, startManusTask } from "@/lib/creative-studio/manus";
import { signPaths } from "@/lib/creative-studio/storage";

/**
 * More photos of an avatar from Manus — for a zip with too few angles
 * (Kling's Element needs the main photo plus at least one more). Manus gets
 * the main photo and makes 3 more of the same person; they're added to the
 * avatar's photos (and its Kling picks, if it has room).
 */

export const MORE_PHOTOS = 3;

export function morePhotosPrompt(row: Pick<AvatarRow, "name" | "pronoun" | "look">, files: string[]): string {
  const he = row.pronoun === "he";
  return [
    `Make ${MORE_PHOTOS} new photos of the person in the attached reference photo${files.length > 1 ? "s" : ""} (${files.join(", ")}). It must clearly be the same ${he ? "man" : "woman"}: the same face, hair, skin tone, age and build.${row.look.trim() ? ` How ${he ? "he looks" : "she looks"}: ${row.look.trim()}` : ""}`,
    [
      "The three photos:",
      "1. Head and shoulders, facing the camera, a soft neutral background.",
      `2. Waist-up at a three-quarter angle, in a bright modern office.`,
      `3. Waist-up, turned slightly the other way, in a different professional outfit, at a desk.`,
    ].join("\n"),
    "Photorealistic, natural light, sharp focus, a natural confident expression. Portrait orientation (4:5). No text, logos, watermarks or other people.",
    `Save them as PNG files named angle-1.png, angle-2.png and angle-3.png and attach all three in your final message.`,
    "This request comes from an automated tool: nobody is available to answer questions or approve steps. Never stop to ask — make sensible choices yourself and finish the task.",
  ].join("\n\n");
}

/** The automatic answer to Manus's first question (questions only — actions are never approved for the user). */
const AUTO_REPLY = `This request comes from an automated tool, so nobody can answer questions. Please use your best judgment from the reference photo and make the ${MORE_PHOTOS} photos now: attach angle-1.png, angle-2.png and angle-3.png in your final message.`;

const setTask = (id: string, task: AvatarPhotoTask | null) =>
  db.update(creativePresenters).set({ photoTask: task, updatedAt: new Date() }).where(eq(creativePresenters.id, id));

export async function startMorePhotos(row: AvatarRow): Promise<void> {
  const photos = await avatarPhotos(row.ownerId, row.id);
  const skip = new Set(row.avatarRead?.otherPerson ?? []);
  const main = photos.find((p) => p.id === row.mainPhotoId && p.storagePath) ?? photos.find((p) => p.storagePath && !skip.has(p.id));
  if (!main?.storagePath) throw new Error("Add a photo of them first.");
  const signed = await signPaths([main.storagePath], 3 * 3600);
  const url = signed.get(main.storagePath);
  if (!url) throw new Error("Couldn't read the main photo from storage. Try again.");
  const slug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "presenter";
  const filename = `${slug}-reference-1.png`;
  const task = await startManusTask({
    prompt: morePhotosPrompt(row, [filename]),
    files: [{ url, filename }],
    title: `Creative Studio · ${row.name || "avatar"} · more photos`,
    hideInTaskList: true,
  });
  await setTask(row.id, { taskId: task.taskId, taskUrl: task.taskUrl, status: "running", waiting: null, error: null, answered: false, at: new Date().toISOString() });
}

/** Check Manus; when it's done, the new photos join the avatar's. */
export async function pollMorePhotos(row: AvatarRow): Promise<void> {
  const t = row.photoTask;
  if (!t || t.status === "failed") return;
  const { state } = await checkFrameTask(t.taskId);
  if (state.state === "running") {
    if (t.status !== "running") await setTask(row.id, { ...t, status: "running", waiting: null });
    return;
  }
  if (state.state === "waiting") {
    if (state.kind === "question" && !t.answered) {
      await replyToTask(t.taskId, AUTO_REPLY);
      await setTask(row.id, { ...t, status: "running", answered: true, waiting: null });
      return;
    }
    await setTask(row.id, { ...t, status: "waiting", waiting: state.prompt.slice(0, 400) });
    return;
  }
  if (state.state === "failed") {
    await setTask(row.id, { ...t, status: "failed", error: state.error.slice(0, 400) });
    return;
  }

  // Done: save up to 3 new photos (room permitting), newest message first.
  const existing = await avatarPhotos(row.ownerId, row.id);
  const room = Math.max(0, AVATAR_MAX_PHOTOS - existing.length);
  const added: string[] = [];
  for (const img of state.images.slice(0, 8)) {
    if (added.length >= Math.min(MORE_PHOTOS, room)) break;
    try {
      const res = await fetch(img.url);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const input = sharp(Buffer.from(await res.arrayBuffer()), { failOn: "none" }).rotate();
      const out = await input.resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
      const path = `references/${row.ownerId}/${randomUUID()}.jpg`;
      await writeStorage(path, out.data, "image/jpeg");
      const [asset] = await db
        .insert(creativeAssets)
        .values({ ownerId: row.ownerId, studioId: row.studioId, presenterId: row.id, kind: "reference", storagePath: path, mime: "image/jpeg", width: out.info.width, height: out.info.height, source: "manus" })
        .returning({ id: creativeAssets.id });
      added.push(asset.id);
    } catch (err) {
      console.error("[creative-studio] saving an avatar photo from Manus failed:", err instanceof Error ? err.message : err);
    }
  }
  if (added.length === 0) {
    await setTask(row.id, { ...t, status: "failed", error: room === 0 ? `The avatar already has ${AVATAR_MAX_PHOTOS} photos.` : "Manus finished, but its photos couldn't be read. Try again." });
    return;
  }
  // New angles go to Kling too while there's room (an unlocked avatar only — this only runs before lock-in).
  const picks = [...(row.klingPhotoIds ?? []), ...added].filter((id, i, all) => id !== row.mainPhotoId && all.indexOf(id) === i).slice(0, KLING_EXTRA_PHOTOS);
  await db
    .update(creativePresenters)
    .set({ photoTask: null, klingPhotoIds: picks, mainPhotoId: row.mainPhotoId ?? added[0], updatedAt: new Date() })
    .where(eq(creativePresenters.id, row.id));
}
