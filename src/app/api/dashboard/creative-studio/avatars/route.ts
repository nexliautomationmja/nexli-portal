import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { creativePresenters, creativeStudios } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { avatarView, listAvatars, loadAvatar } from "@/lib/creative-studio/avatar";

/**
 * The Avatars tab: every AI avatar (the library and the ones assigned to a
 * firm), plus the client studios one can be assigned to.
 */
export async function GET() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const [avatars, studios] = await Promise.all([
    listAvatars(access.ownerId),
    db
      .select({ key: creativeStudios.id, name: creativeStudios.name, defaultPresenterId: creativeStudios.defaultPresenterId })
      .from(creativeStudios)
      .where(and(eq(creativeStudios.ownerId, access.ownerId), isNull(creativeStudios.archivedAt)))
      .orderBy(asc(creativeStudios.name)),
  ]);
  return NextResponse.json({ avatars, studios });
}

/** POST { name?, note? } → a new avatar to upload photos into (it lives in the library until it's assigned). */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => null)) as { name?: unknown; note?: unknown } | null;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const [created] = await db
    .insert(creativePresenters)
    .values({
      ownerId: access.ownerId,
      studioId: null,
      avatar: true,
      // Empty until named: Claude suggests names from the photos and the first one fills this in.
      name: s(body?.name, 60),
      note: s(body?.note, 1000) || null,
      createdBy: access.actorId,
    })
    .returning({ id: creativePresenters.id });
  const row = await loadAvatar(access.ownerId, created.id);
  return NextResponse.json({ avatar: await avatarView(access.ownerId, row!) });
}
