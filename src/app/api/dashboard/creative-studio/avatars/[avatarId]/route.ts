import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativePresenters, creativeStudios, type Pronoun } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarPhotos, avatarView, loadAvatar } from "@/lib/creative-studio/avatar";
import { KLING_EXTRA_PHOTOS } from "@/lib/creative-studio/avatar-shared";

type Ctx = { params: Promise<{ avatarId: string }> };

const notFound = () => NextResponse.json({ error: "Avatar not found" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return notFound();
  return NextResponse.json({ avatar: await avatarView(access.ownerId, row) });
}

/**
 * PATCH { name?, note?, bestFor?, look?, intro?, personality?, trialPhotoId?, pronoun?, voice?, mainPhotoId?, klingPhotoIds? }.
 * Once locked in, the voice, pronoun and photo picks are fixed (the Kling
 * Element is built from them) — "Rebuild" unlocks it first.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return notFound();
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : undefined);
  const set: Partial<typeof creativePresenters.$inferInsert> = {};

  const name = s(body.name, 60);
  if (name !== undefined) {
    if (!name) return NextResponse.json({ error: "Give the avatar a name." }, { status: 400 });
    set.name = name;
  }
  const note = s(body.note, 1000);
  if (note !== undefined) set.note = note || null;
  const bestFor = s(body.bestFor, 400);
  if (bestFor !== undefined) set.bestFor = bestFor || null;
  const look = s(body.look, 1500);
  if (look !== undefined) set.look = look;
  // The trial video's line and delivery (they don't change the voice or photos, so fine after lock-in too).
  const intro = s(body.intro, 300);
  const personality = s(body.personality, 120);
  // The photo the trial video starts from (any of its photos).
  let selfie: string | undefined;
  if (typeof body.trialPhotoId === "string") {
    const ids = new Set((await avatarPhotos(access.ownerId, row.id)).map((p) => p.id));
    if (!ids.has(body.trialPhotoId)) return NextResponse.json({ error: "That photo isn't one of the avatar's." }, { status: 400 });
    selfie = body.trialPhotoId;
  }
  if (intro !== undefined || personality !== undefined || selfie !== undefined) {
    const read = row.avatarRead ?? { age: "", names: [], otherPerson: [], notes: "", at: new Date().toISOString() };
    set.avatarRead = { ...read, ...(intro !== undefined ? { intro } : {}), ...(personality !== undefined ? { personality } : {}), ...(selfie !== undefined ? { selfie } : {}) };
  }

  const fixed = ["pronoun", "voice", "mainPhotoId", "klingPhotoIds"].filter((k) => k in body);
  if (fixed.length && row.lockedAt) {
    return NextResponse.json({ error: `${row.name} is locked in. Tap Rebuild to change the voice or photos.` }, { status: 409 });
  }
  if (body.pronoun === "she" || body.pronoun === "he") set.pronoun = body.pronoun as Pronoun;
  const voice = s(body.voice, 1000);
  if (voice !== undefined) set.voice = voice;
  if ("mainPhotoId" in body || "klingPhotoIds" in body) {
    const ids = new Set((await avatarPhotos(access.ownerId, row.id)).map((p) => p.id));
    const main = typeof body.mainPhotoId === "string" && ids.has(body.mainPhotoId) ? body.mainPhotoId : row.mainPhotoId;
    const picks = Array.isArray(body.klingPhotoIds) ? body.klingPhotoIds : row.klingPhotoIds ?? [];
    set.mainPhotoId = main;
    set.klingPhotoIds = [...new Set(picks.filter((id): id is string => typeof id === "string" && ids.has(id) && id !== main))].slice(0, KLING_EXTRA_PHOTOS);
  }

  if (Object.keys(set).length) {
    await db
      .update(creativePresenters)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(creativePresenters.id, row.id));
  }
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}

/** DELETE → retire it (archived; videos already made with it keep working). A firm whose avatar it was gets no default. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return notFound();
  await db.update(creativePresenters).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(creativePresenters.id, row.id));
  if (row.studioId) {
    await db
      .update(creativeStudios)
      .set({ defaultPresenterId: null, updatedAt: new Date() })
      .where(and(eq(creativeStudios.id, row.studioId), eq(creativeStudios.defaultPresenterId, row.id)));
  }
  return NextResponse.json({ ok: true });
}
