import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativePresenters } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarPhotos, avatarView, loadAvatar } from "@/lib/creative-studio/avatar";
import { pollMorePhotos, startMorePhotos } from "@/lib/creative-studio/avatar-manus";
import { AVATAR_MAX_PHOTOS } from "@/lib/creative-studio/avatar-shared";
import { manusConfigured } from "@/lib/creative-studio/manus";

export const maxDuration = 120;

type Ctx = { params: Promise<{ avatarId: string }> };

/** POST → Manus makes 3 more photos of the avatar (other angles) from its main photo. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (row.lockedAt) return NextResponse.json({ error: `${row.name} is locked in. Tap Rebuild to add photos.` }, { status: 409 });
  if (!manusConfigured()) return NextResponse.json({ error: "Manus isn't set up (MANUS_API_KEY is missing in Vercel)." }, { status: 400 });
  if (row.photoTask && row.photoTask.status !== "failed") return NextResponse.json({ avatar: await avatarView(access.ownerId, row) });
  if ((await avatarPhotos(access.ownerId, row.id)).length >= AVATAR_MAX_PHOTOS) {
    return NextResponse.json({ error: `${row.name || "The avatar"} already has ${AVATAR_MAX_PHOTOS} photos.` }, { status: 409 });
  }
  try {
    await startMorePhotos(row);
  } catch (err) {
    console.error("[creative-studio] avatar photos task failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message.slice(0, 300) : "Manus couldn't start." }, { status: 502 });
  }
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}

/** GET → check Manus (its photos join the avatar's when it's done). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (row.photoTask && row.photoTask.status !== "failed") {
    await pollMorePhotos(row).catch((err) => console.error("[creative-studio] avatar photos poll failed:", err));
  }
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}

/** DELETE → clear a failed Manus attempt (so the button comes back). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  await db.update(creativePresenters).set({ photoTask: null, updatedAt: new Date() }).where(eq(creativePresenters.id, row.id));
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}
