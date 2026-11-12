import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativePresenters } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import sharp from "sharp";
import { avatarPhotos, avatarView, libraryVoices, loadAvatar, readAvatar, type ReadImage } from "@/lib/creative-studio/avatar";
import { readStorage } from "@/lib/creative-studio/frames";
import { claudeError } from "@/lib/creative-studio/script";
import { READ_MAX_PHOTOS, spread } from "@/lib/creative-studio/avatar-shared";

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

  // Claude sees every photo (up to 60) as a small JPEG, so a big set still fits — and the selfie isn't missed.
  const photos = spread((await avatarPhotos(access.ownerId, row.id)).filter((p) => p.storagePath), READ_MAX_PHOTOS);
  if (!photos.length) return NextResponse.json({ error: "Add the avatar's photos first." }, { status: 400 });
  const small: { id: string; image: ReadImage }[] = [];
  for (let i = 0; i < photos.length; i += 8) {
    const batch = await Promise.all(
      photos.slice(i, i + 8).map(async (p): Promise<{ id: string; image: ReadImage } | null> => {
        try {
          const bytes = await sharp(await readStorage(p.storagePath!), { failOn: "none" }).rotate().resize({ width: 512, height: 512, fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
          return { id: p.id, image: { type: "base64", media_type: "image/jpeg", data: bytes.toString("base64") } };
        } catch {
          return null;
        }
      })
    );
    small.push(...batch.filter((x): x is { id: string; image: ReadImage } => Boolean(x)));
  }
  if (!small.length) return NextResponse.json({ error: "Couldn't read the photos from storage. Try again." }, { status: 502 });

  let result;
  try {
    result = await readAvatar({ photos: small, name: row.name, note: row.note ?? "", others: await libraryVoices(access.ownerId, row.id) });
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
