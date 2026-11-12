import { createHash } from "crypto";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips, creativePresenters, creativeProjects, type FrameSpec } from "@/lib/creative-studio/tables";
import { avatarPhotos, loadAvatar, type AvatarRow } from "@/lib/creative-studio/avatar";
import { KLING_EXTRA_PHOTOS } from "@/lib/creative-studio/avatar-shared";
import { readStorage } from "@/lib/creative-studio/frames";
import { createElement, KlingNotConnectedError, uploadFrame, uuidv7 } from "@/lib/creative-studio/kling-mcp";

/**
 * An AI avatar on Kling: a Kling Element made from its main photo, up to 3
 * more angles and its voice sample, bound into every clip where the avatar
 * is on screen — so the face and the voice stay the same from clip to clip.
 */

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;

/** The photos (main first) and voice an Element is built from, or why it can't be yet. */
async function elementInputs(row: AvatarRow): Promise<{ photos: { id: string; path: string }[]; voicePath: string } | { missing: string }> {
  if (!row.lockedAt) return { missing: "Lock the avatar in first." };
  if (!row.voicePath) return { missing: "The avatar has no voice yet." };
  const all = (await avatarPhotos(row.ownerId, row.id)).filter((p) => p.storagePath);
  const byId = new Map(all.map((p) => [p.id, p.storagePath as string]));
  const main = row.mainPhotoId && byId.has(row.mainPhotoId) ? row.mainPhotoId : all[0]?.id;
  if (!main) return { missing: "The avatar has no photos." };
  const extra = (row.klingPhotoIds ?? []).filter((id) => id !== main && byId.has(id)).slice(0, KLING_EXTRA_PHOTOS);
  if (extra.length === 0) return { missing: "Kling needs one more photo (another angle)." };
  return { photos: [main, ...extra].map((id) => ({ id, path: byId.get(id)! })), voicePath: row.voicePath };
}

const hashOf = (photos: { id: string }[], voicePath: string) =>
  createHash("sha1")
    .update([...photos.map((p) => p.id), voicePath].join("|"))
    .digest("hex");

/** Kling takes PNG/JPG under 4K: every photo goes as a JPEG, 2048 px on the long edge at most. */
async function asKlingJpeg(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
}

/**
 * Make (or re-make, after a rebuild) the avatar's Kling Element. Saves the
 * id — or the reason it couldn't — on the avatar; returns the id or null.
 */
export async function ensureElement(token: string, row: AvatarRow): Promise<string | null> {
  const inputs = await elementInputs(row);
  if ("missing" in inputs) return null;
  const hash = hashOf(inputs.photos, inputs.voicePath);
  if (row.klingElementId && row.klingElementHash === hash) return row.klingElementId;
  try {
    const trace = uuidv7();
    const urls: string[] = [];
    for (const [i, p] of inputs.photos.entries()) {
      const bytes = await asKlingJpeg(await readStorage(p.path));
      urls.push(await uploadFrame(token, { bytes, mime: "image/jpeg", filename: `avatar-${row.id}-${i + 1}.jpg` }, trace));
    }
    const voice = await uploadFrame(token, { bytes: await readStorage(inputs.voicePath), mime: "audio/mpeg", filename: `avatar-${row.id}-voice.mp3` }, trace);
    const id = await createElement(token, {
      name: row.name,
      description: `${row.name}, an on-camera presenter. ${row.look}`.trim(),
      cover: urls[0],
      secondary: urls.slice(1),
      voice,
      taskTraceId: trace,
    });
    await db
      .update(creativePresenters)
      .set({ klingElementId: id, klingElementHash: hash, klingElementError: null, klingElementAt: new Date(), updatedAt: new Date() })
      .where(eq(creativePresenters.id, row.id));
    return id;
  } catch (err) {
    const message =
      err instanceof KlingNotConnectedError ? "Kling isn't connected. Connect it in a video, then tap Set up on Kling." : err instanceof Error ? err.message : "Kling couldn't make the character.";
    console.error("[creative-studio] avatar element failed:", err);
    await db
      .update(creativePresenters)
      .set({ klingElementError: message.slice(0, 400), updatedAt: new Date() })
      .where(eq(creativePresenters.id, row.id));
    return null;
  }
}

/** Is the avatar in this clip's shot? (A voiceover over a scene without them gets only the voice line.) */
export function avatarOnScreen(frame: FrameSpec | null, clip: Pick<Clip, "kind" | "frameAssetId">): boolean {
  const scenes = frame?.scenes ?? [];
  const scene = scenes.find((s) => s.frameId === clip.frameAssetId) ?? (scenes.length === 1 ? scenes[0] : undefined);
  if (scene) return scene.people.some((p) => p.presenter);
  return clip.kind !== "voiceover";
}

/**
 * The Element to bind for this video's clips: the avatar's live one (the
 * video's snapshot can predate it), made now if it's missing. Null for any
 * video whose presenter isn't an AI avatar — those send exactly as before.
 */
export async function avatarElementFor(token: string, project: Project): Promise<{ id: string; name: string } | null> {
  const p = project.presenter;
  if (!p?.avatar || !p.id) return null;
  const row = await loadAvatar(project.ownerId, p.id);
  if (!row || !row.lockedAt) return null;
  const id = row.klingElementId ?? (await ensureElement(token, row));
  return id ? { id, name: row.name } : null;
}
