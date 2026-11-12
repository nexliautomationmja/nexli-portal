import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativePresenters } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarPhotos, avatarView, libraryVoices, loadAvatar, readAvatar } from "@/lib/creative-studio/avatar";
import { claudeError } from "@/lib/creative-studio/script";
import { signPaths } from "@/lib/creative-studio/storage";

export const maxDuration = 300;

type Ctx = { params: Promise<{ avatarId: string }> };

/**
 * POST → Claude looks at the avatar's photos: how they look, what firm they
 * suit, a voice that fits them (clearly different from the library's other
 * voices), the line their voice sample says, and which photos to use.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (row.lockedAt) return NextResponse.json({ error: `${row.name} is already locked in.` }, { status: 409 });

  const photos = await avatarPhotos(access.ownerId, row.id);
  if (!photos.length) return NextResponse.json({ error: "Add the avatar's photos first." }, { status: 400 });
  const signed = await signPaths(photos.map((p) => p.storagePath), 3600);
  const withUrls = photos.map((p) => ({ id: p.id, url: p.storagePath ? signed.get(p.storagePath) ?? "" : "" })).filter((p) => p.url);

  let result;
  try {
    result = await readAvatar({ photos: withUrls, name: row.name, note: row.note ?? "", others: await libraryVoices(access.ownerId, row.id) });
  } catch (err) {
    console.error("[creative-studio] avatar read failed:", err);
    return NextResponse.json({ error: claudeError(err, "Claude couldn't read the photos. Try again.") }, { status: 502 });
  }

  await db
    .update(creativePresenters)
    .set({
      name: row.name.trim() || result.read.names[0] || "",
      pronoun: result.pronoun,
      look: result.look,
      bestFor: result.bestFor || null,
      voice: result.voice,
      voiceSample: result.sample,
      mainPhotoId: result.mainPhotoId,
      klingPhotoIds: result.klingPhotoIds,
      avatarRead: result.read,
      updatedAt: new Date(),
    })
    .where(eq(creativePresenters.id, row.id));
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}
