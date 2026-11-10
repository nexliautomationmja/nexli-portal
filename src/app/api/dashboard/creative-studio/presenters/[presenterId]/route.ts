import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativePresenters } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { studioFromRequest, studioNotFound } from "@/lib/creative-studio/studios";
import { cleanPresenter, listPresenters, loadPresenter } from "@/lib/creative-studio/presenters";

type Ctx = { params: Promise<{ presenterId: string }> };

/**
 * PATCH { name?, pronoun?, voice?, look? } → update. Videos keep the snapshot
 * they were written with; the next script picks up the change.
 * DELETE → archive (videos that use them keep working).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const row = await loadPresenter(access.ownerId, (await params).presenterId);
  if (!row || (row.studioId ?? null) !== (studio.id ?? null)) return NextResponse.json({ error: "Presenter not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const fields = cleanPresenter({ ...row, ...(body ?? {}) });
  if (!fields.name) return NextResponse.json({ error: "Give the presenter a name." }, { status: 400 });
  await db.update(creativePresenters).set({ ...fields, updatedAt: new Date() }).where(eq(creativePresenters.id, row.id));
  return NextResponse.json({ id: row.id, presenters: await listPresenters(access.ownerId, studio) });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const row = await loadPresenter(access.ownerId, (await params).presenterId);
  if (!row || (row.studioId ?? null) !== (studio.id ?? null)) return NextResponse.json({ error: "Presenter not found" }, { status: 404 });
  await db.update(creativePresenters).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(creativePresenters.id, row.id));
  return NextResponse.json({ presenters: await listPresenters(access.ownerId, studio) });
}
