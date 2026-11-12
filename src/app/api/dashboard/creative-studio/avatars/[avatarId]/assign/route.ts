import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativePresenters, creativeStudios } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarVideoCount, avatarView, loadAvatar } from "@/lib/creative-studio/avatar";
import { resolveStudio } from "@/lib/creative-studio/studios";

type Ctx = { params: Promise<{ avatarId: string }> };

/** Its photos (they move with it, so the firm's studio finds them like any presenter's). */
const photosOf = (ownerId: string, avatarId: string) =>
  and(eq(creativeAssets.ownerId, ownerId), eq(creativeAssets.kind, "reference"), isNull(creativeAssets.projectId), eq(creativeAssets.presenterId, avatarId));

/**
 * POST { studioKey } → give a locked-in avatar from the library to ONE client
 * firm: it (and its photos) move into that firm's studio, it becomes the
 * studio's presenter by default, and no other studio can use it.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (!row.lockedAt) return NextResponse.json({ error: `Lock ${row.name || "the avatar"} in first.` }, { status: 409 });
  if (row.studioId) return NextResponse.json({ error: `${row.name} already belongs to another firm.` }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { studioKey?: unknown } | null;
  const studio = typeof body?.studioKey === "string" ? await resolveStudio(access.ownerId, body.studioKey) : null;
  if (!studio || studio.kind !== "client" || studio.archived) return NextResponse.json({ error: "Pick one of your client firms' studios." }, { status: 400 });

  const now = new Date();
  await db.batch([
    db
      .update(creativePresenters)
      .set({ studioId: studio.id, assignedAt: now, assignedBy: access.actorId, updatedAt: now })
      .where(and(eq(creativePresenters.id, row.id), isNull(creativePresenters.studioId))),
    db.update(creativeAssets).set({ studioId: studio.id }).where(photosOf(access.ownerId, row.id)),
    db
      .update(creativeStudios)
      .set({ defaultPresenterId: row.id, updatedAt: now })
      .where(and(eq(creativeStudios.id, studio.id!), isNull(creativeStudios.defaultPresenterId))),
  ]);
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}

/** DELETE → undo the assignment (back to the library) — only while no video has been made with it. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const row = await loadAvatar(access.ownerId, (await params).avatarId);
  if (!row) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  if (!row.studioId) return NextResponse.json({ avatar: await avatarView(access.ownerId, row) });
  const videos = await avatarVideoCount(access.ownerId, row.id);
  if (videos > 0) {
    return NextResponse.json(
      { error: `${row.name} is already in ${videos} of the firm's video${videos === 1 ? "" : "s"}, so it stays theirs. You can retire it instead.` },
      { status: 409 }
    );
  }
  const now = new Date();
  await db.batch([
    db.update(creativePresenters).set({ studioId: null, assignedAt: null, assignedBy: null, updatedAt: now }).where(eq(creativePresenters.id, row.id)),
    db.update(creativeAssets).set({ studioId: null }).where(photosOf(access.ownerId, row.id)),
    db
      .update(creativeStudios)
      .set({ defaultPresenterId: null, updatedAt: now })
      .where(and(eq(creativeStudios.id, row.studioId), eq(creativeStudios.defaultPresenterId, row.id))),
  ]);
  return NextResponse.json({ avatar: await avatarView(access.ownerId, (await loadAvatar(access.ownerId, row.id))!) });
}
