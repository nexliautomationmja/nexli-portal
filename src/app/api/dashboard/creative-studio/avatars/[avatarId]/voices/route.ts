import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativePresenters } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarView, loadAvatar } from "@/lib/creative-studio/avatar";
import { designInput, designVoices, VoiceError } from "@/lib/creative-studio/elevenlabs";
import { writeStorage } from "@/lib/creative-studio/frames";
import { removePaths } from "@/lib/creative-studio/storage";

export const maxDuration = 120;

type Ctx = { params: Promise<{ avatarId: string }> };

/**
 * POST { description?, sample? } → ElevenLabs designs 3 voices from the
 * avatar's voice description (or the edited one sent here), each saying the
 * sample line. They replace any earlier ones to pick from.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (row.lockedAt) return NextResponse.json({ error: `${row.name} is locked in. Tap Rebuild to change the voice.` }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { description?: unknown; sample?: unknown } | null;
  const description = typeof body?.description === "string" && body.description.trim() ? body.description : row.voice;
  const sample = typeof body?.sample === "string" && body.sample.trim() ? body.sample : row.voiceSample ?? "";

  let input;
  let voices;
  try {
    input = designInput(description, sample);
    voices = await designVoices(input.description, input.sample);
  } catch (err) {
    if (err instanceof VoiceError) return NextResponse.json({ error: err.message }, { status: 502 });
    console.error("[creative-studio] voice design failed:", err);
    return NextResponse.json({ error: "Couldn't design the voices. Try again." }, { status: 502 });
  }

  const stamp = Date.now();
  const options = await Promise.all(
    voices.slice(0, 3).map(async (v, i) => {
      const path = `avatars/${access.ownerId}/${row.id}/option-${stamp}-${i + 1}.mp3`;
      await writeStorage(path, v.audio, "audio/mpeg");
      return { generatedVoiceId: v.generatedVoiceId, path, durationS: v.durationS };
    })
  );
  const old = row.voiceOptions?.options.map((o) => o.path) ?? [];
  await db
    .update(creativePresenters)
    .set({
      voice: input.description,
      voiceSample: input.sample,
      voiceOptions: { description: input.description, sample: input.sample, options, at: new Date().toISOString() },
      updatedAt: new Date(),
    })
    .where(eq(creativePresenters.id, row.id));
  if (old.length) await removePaths(old).catch(() => {});
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}
