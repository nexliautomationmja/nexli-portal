import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativePresenters } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarPhotos, avatarView, loadAvatar } from "@/lib/creative-studio/avatar";
import { saveVoice, VoiceError } from "@/lib/creative-studio/elevenlabs";
import { readStorage, writeStorage } from "@/lib/creative-studio/frames";
import { removePaths } from "@/lib/creative-studio/storage";
import { ensureElement } from "@/lib/creative-studio/avatar-kling";
import { accessToken, KlingNotConnectedError } from "@/lib/creative-studio/kling-mcp";

// ElevenLabs keeps the voice, then the Kling Element (photos + voice upload).
export const maxDuration = 300;

type Ctx = { params: Promise<{ avatarId: string }> };

/**
 * POST { generatedVoiceId } → lock the avatar in with that voice: ElevenLabs
 * keeps the voice, its sample becomes the avatar's voice file (Kling's
 * Element voice), and the voice, pronoun and photos are fixed from here.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (row.lockedAt) return NextResponse.json({ avatar: await avatarView(access.ownerId, row) });
  if (!row.name.trim()) return NextResponse.json({ error: "Give the avatar a name first." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { generatedVoiceId?: unknown } | null;
  const option = row.voiceOptions?.options.find((o) => o.generatedVoiceId === body?.generatedVoiceId);
  if (!option || !row.voiceOptions) return NextResponse.json({ error: "Pick one of the voices first." }, { status: 400 });
  const photos = await avatarPhotos(access.ownerId, row.id);
  if (!photos.length) return NextResponse.json({ error: "Add the avatar's photos first." }, { status: 400 });

  // ElevenLabs keeps the voice (for later lines); if it can't, the sample alone still works.
  let voiceId: string | null = null;
  let note: string | null = null;
  try {
    voiceId = await saveVoice(`${row.name} (Nexli avatar)`, row.voiceOptions.description, option.generatedVoiceId, { source: "nexli-creative-studio" });
  } catch (err) {
    note = err instanceof VoiceError ? `${err.message} The voice sample is saved, so the avatar works anyway.` : "ElevenLabs couldn't keep the voice; the sample is saved, so the avatar works anyway.";
    console.error("[creative-studio] avatar voice save failed:", err);
  }

  const voicePath = `avatars/${access.ownerId}/${row.id}/voice-${Date.now()}.mp3`;
  try {
    await writeStorage(voicePath, await readStorage(option.path), "audio/mpeg");
  } catch (err) {
    console.error("[creative-studio] avatar voice copy failed:", err);
    return NextResponse.json({ error: "Couldn't save the voice sample. Try again." }, { status: 502 });
  }

  const ids = new Set(photos.map((p) => p.id));
  const main = row.mainPhotoId && ids.has(row.mainPhotoId) ? row.mainPhotoId : photos[0].id;
  await db
    .update(creativePresenters)
    .set({
      voice: row.voiceOptions.description,
      voiceSample: row.voiceOptions.sample,
      voicePath,
      voiceId,
      voiceOptions: null,
      mainPhotoId: main,
      klingPhotoIds: (row.klingPhotoIds ?? []).filter((id) => ids.has(id) && id !== main),
      lockedAt: new Date(),
      klingElementId: null,
      klingElementHash: null,
      klingElementError: null,
      klingElementAt: null,
      updatedAt: new Date(),
    })
    .where(eq(creativePresenters.id, row.id));
  await removePaths([...row.voiceOptions.options.map((o) => o.path), row.voicePath]).catch(() => {});

  // Kling: the Element (same face + voice in every clip). If Kling isn't reachable now, it's made at the first render.
  const locked = (await loadAvatar(access.ownerId, row.id))!;
  try {
    await ensureElement(await accessToken(access.ownerId), locked);
  } catch (err) {
    const message = err instanceof KlingNotConnectedError ? "Kling isn't connected. Connect it in a video, then tap Set up on Kling." : "Couldn't reach Kling. Tap Set up on Kling to try again.";
    await db.update(creativePresenters).set({ klingElementError: message }).where(eq(creativePresenters.id, row.id));
  }
  const fresh = (await loadAvatar(access.ownerId, row.id))!;
  return NextResponse.json({ avatar: await avatarView(access.ownerId, fresh), ...(note ? { note } : {}) });
}

/**
 * DELETE → Rebuild: unlock it so the voice and photos can change. The
 * description and line stay, so new voices are one tap away; the Kling
 * Element is made again at the next lock-in.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  await db
    .update(creativePresenters)
    .set({ lockedAt: null, klingElementId: null, klingElementHash: null, klingElementError: null, klingElementAt: null, updatedAt: new Date() })
    .where(eq(creativePresenters.id, row.id));
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}
