import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { creativePresenters } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { studioFromRequest, studioNotFound } from "@/lib/creative-studio/studios";
import { cleanPresenter, listPresenters } from "@/lib/creative-studio/presenters";

/** The studio's presenters (`?studio=`), besides its default (Daniela in Nexli's studio). */
export async function GET(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  return NextResponse.json({ presenters: await listPresenters(access.ownerId, studio) });
}

/** POST { name, pronoun, voice, look } → a new presenter in this studio. */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const fields = cleanPresenter(await req.json().catch(() => null));
  if (!fields.name) return NextResponse.json({ error: "Give the presenter a name." }, { status: 400 });
  const [created] = await db
    .insert(creativePresenters)
    .values({ ownerId: access.ownerId, studioId: studio.id, createdBy: access.actorId, ...fields })
    .returning({ id: creativePresenters.id });
  return NextResponse.json({ id: created.id, presenters: await listPresenters(access.ownerId, studio) });
}
