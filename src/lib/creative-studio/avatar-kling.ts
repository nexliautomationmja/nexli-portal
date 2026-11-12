import { createHash } from "crypto";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips, creativePresenters, creativeProjects, type FrameSpec } from "@/lib/creative-studio/tables";
import { avatarPhotos, loadAvatar, type AvatarRow } from "@/lib/creative-studio/avatar";
import { KLING_EXTRA_PHOTOS, TEST_CLIP_SECONDS } from "@/lib/creative-studio/avatar-shared";
import { readStorage, writeStorage } from "@/lib/creative-studio/frames";
import { createElement, KlingNotConnectedError, queryTask, submitClip, uploadFrame, uuidv7 } from "@/lib/creative-studio/kling-mcp";

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

// ---------------------------------------------------------------------------
// The 5-second test clip: the avatar's main photo, its Element, its voice.

/**
 * The start of the voice sample, short enough for 5 seconds: whole sentences
 * up to about 14 words; a first sentence longer than that is cut at a comma
 * (or after 12 words).
 */
export function testLine(sample: string, maxWords = 14): string {
  const sentences = sample.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+["”']?|[^.!?]+$/g) ?? [];
  let out = "";
  for (const raw of sentences) {
    const next = `${out} ${raw.trim()}`.trim();
    if (next.split(" ").length > maxWords) break;
    out = next;
  }
  if (out) return out;
  const words = (sentences[0] ?? sample).trim().split(" ").slice(0, 12).join(" ");
  const comma = words.lastIndexOf(",");
  return `${(comma > 10 ? words.slice(0, comma) : words).replace(/[,;:—–-]+$/, "")}.`;
}

/** What Kling is asked for in the test clip (the Element lead is added when it's sent). */
export function testPrompt(row: Pick<AvatarRow, "name" | "pronoun" | "voice">, line: string): string {
  const he = row.pronoun === "he";
  return [
    "Static locked-off camera, single continuous shot, no cuts.",
    `${row.name} looks into the lens and starts speaking within the first half-second, with natural lip-sync and subtle head movement, saying: "${line}"`,
    `${row.voice.trim() ? `Voice: ${row.voice.trim().replace(/[.]+$/, "")}. ` : ""}Delivery: warm, confident and conversational.`,
    `${he ? "He" : "She"} says the line once, word for word, then holds a natural expression until the end.`,
    `Realistic skin, hair and fabric; everything in the scene stays unchanged. Only ${he ? "his" : "her"} voice is heard: no background music, no on-screen text.`,
  ].join(" ");
}

export async function startTestClip(token: string, row: AvatarRow): Promise<void> {
  const elementId = row.klingElementId ?? (await ensureElement(token, row));
  if (!elementId) throw new Error(row.klingElementError ?? "Set the avatar up on Kling first.");
  const main = (await avatarPhotos(row.ownerId, row.id)).find((p) => p.id === row.mainPhotoId && p.storagePath);
  if (!main?.storagePath) throw new Error("The avatar's main photo is missing.");
  const trace = uuidv7();
  const frameUrl = await uploadFrame(token, { bytes: await asKlingJpeg(await readStorage(main.storagePath)), mime: "image/jpeg", filename: `avatar-${row.id}-test.jpg` }, trace);
  const line = testLine(row.voiceSample ?? `Hi, I'm ${row.name}.`);
  const { generationId } = await submitClip(token, {
    multiPerson: false,
    prompt: testPrompt(row, line),
    durationS: TEST_CLIP_SECONDS,
    frameUrl,
    taskTraceId: trace,
    element: { id: elementId, name: row.name },
    rationale: `Nexli Creative Studio: a 5-second test of the AI presenter "${row.name}" (its saved character and voice) before it's used in a firm's ads.`,
  });
  await db
    .update(creativePresenters)
    .set({ testClip: { generationId, status: "rendering", path: null, error: null, line, at: new Date().toISOString() }, updatedAt: new Date() })
    .where(eq(creativePresenters.id, row.id));
}

/** Check a rendering test clip; store it when it's done. */
export async function pollTestClip(token: string, row: AvatarRow): Promise<void> {
  const t = row.testClip;
  if (!t || t.status !== "rendering") return;
  const state = await queryTask(token, t.generationId);
  if (state.state === "running") return;
  let next = { ...t };
  if (state.state === "failed") next = { ...t, status: "failed", error: state.error.slice(0, 400) };
  else {
    const res = await fetch(state.videoUrl).catch(() => null);
    if (!res?.ok) return; // try again on the next poll
    const path = `avatars/${row.ownerId}/${row.id}/test-${Date.now()}.mp4`;
    await writeStorage(path, Buffer.from(await res.arrayBuffer()), "video/mp4");
    next = { ...t, status: "done", path, error: null };
  }
  await db.update(creativePresenters).set({ testClip: next, updatedAt: new Date() }).where(eq(creativePresenters.id, row.id));
}
