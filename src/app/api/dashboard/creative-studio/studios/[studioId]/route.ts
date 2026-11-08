import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeStudios } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";

type Ctx = { params: Promise<{ studioId: string }> };

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/**
 * Change a client studio: PATCH { name?, about?, website?, archived? }.
 * Archiving only hides it from the picker; its videos and copy stay.
 * (Nexli's own studio has nothing to change.)
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const id = (await params).studioId;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const name = clip(body?.name, 120);
  if (name !== undefined && !name) return NextResponse.json({ error: "The studio needs a name" }, { status: 400 });
  const about = clip(body?.about, 4000);
  const website = clip(body?.website, 300);
  const [updated] = await db
    .update(creativeStudios)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(about !== undefined ? { about: about || null } : {}),
      ...(website !== undefined ? { website: website || null } : {}),
      ...(typeof body?.archived === "boolean" ? { archivedAt: body.archived ? new Date() : null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(creativeStudios.id, id), eq(creativeStudios.ownerId, access.ownerId)))
    .returning({ id: creativeStudios.id });
  if (!updated) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
