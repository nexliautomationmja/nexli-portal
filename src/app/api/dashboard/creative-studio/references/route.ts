import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeProjects } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { sameStudio, studioFromRequest, studioNotFound, type Studio } from "@/lib/creative-studio/studios";
import { createUploadTarget, FRAME_MIME_TYPES, removePaths, signPaths } from "@/lib/creative-studio/storage";
import { loadPresenter, referencesWhere } from "@/lib/creative-studio/presenters";
import { readStorage, writeStorage } from "@/lib/creative-studio/frames";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function list(ownerId: string, studio: Studio, presenterId: string | null) {
  const refs = await db
    .select()
    .from(creativeAssets)
    .where(referencesWhere(ownerId, studio, presenterId))
    .orderBy(asc(creativeAssets.createdAt));
  const signed = await signPaths(refs.map((r) => r.storagePath), 6 * 3600);
  return refs.map((r) => ({
    id: r.id,
    url: r.storagePath ? signed.get(r.storagePath) ?? null : null,
    width: r.width,
    height: r.height,
  }));
}

/**
 * `?presenter=` names whose photos these are: a saved presenter of this
 * studio, or nothing for the studio's default presenter (Daniela's library in
 * Nexli's studio). Undefined when it isn't one of this studio's presenters.
 */
async function presenterFrom(ownerId: string, studio: Studio, req: NextRequest): Promise<string | null | undefined> {
  const id = req.nextUrl.searchParams.get("presenter")?.trim();
  if (!id) return null;
  const row = await loadPresenter(ownerId, id);
  if (!row || (row.studioId ?? null) !== (studio.id ?? null)) return undefined;
  return row.id;
}

const noPresenter = () => NextResponse.json({ error: "That presenter isn't in this studio." }, { status: 404 });

/**
 * Reference images — one library per studio (`?studio=`) and presenter
 * (`?presenter=`), reused in every video: Daniela's in Nexli's studio, a
 * client studio's own, and each saved presenter's.
 */
export async function GET(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const presenterId = await presenterFrom(access.ownerId, studio, req);
  if (presenterId === undefined) return noPresenter();
  return NextResponse.json({ references: await list(access.ownerId, studio, presenterId) });
}

/**
 * POST { action: "sign", mime } / { action: "register", path, mime, width, height }
 * → upload a photo. POST { action: "fromFrame", assetId } → save one of a
 * video's frames (e.g. a scene Manus made) as a photo of this presenter.
 */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const presenterId = await presenterFrom(access.ownerId, studio, req);
  if (presenterId === undefined) return noPresenter();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (body?.action === "fromFrame") {
    const assetId = typeof body.assetId === "string" ? body.assetId : "";
    if (!/^[0-9a-f-]{36}$/i.test(assetId)) return NextResponse.json({ error: "Frame not found" }, { status: 404 });
    const [frame] = await db
      .select({ path: creativeAssets.storagePath, mime: creativeAssets.mime, width: creativeAssets.width, height: creativeAssets.height })
      .from(creativeAssets)
      .innerJoin(creativeProjects, eq(creativeProjects.id, creativeAssets.projectId))
      .where(
        and(
          eq(creativeAssets.id, assetId),
          eq(creativeAssets.kind, "frame"),
          eq(creativeProjects.ownerId, access.ownerId),
          sameStudio(creativeProjects.studioId, studio.id)
        )
      )
      .limit(1);
    if (!frame?.path) return NextResponse.json({ error: "Frame not found" }, { status: 404 });
    const mime = frame.mime && EXT[frame.mime] ? frame.mime : "image/png";
    const path = `references/${access.ownerId}/${randomUUID()}.${EXT[mime]}`;
    await writeStorage(path, await readStorage(frame.path), mime);
    await db.insert(creativeAssets).values({
      ownerId: access.ownerId,
      studioId: studio.id,
      presenterId,
      kind: "reference",
      storagePath: path,
      mime,
      width: frame.width,
      height: frame.height,
      source: "frame",
    });
    return NextResponse.json({ references: await list(access.ownerId, studio, presenterId) });
  }

  const mime = typeof body?.mime === "string" ? body.mime : "";
  if (!FRAME_MIME_TYPES.includes(mime)) {
    return NextResponse.json({ error: "Reference images must be PNG, JPEG or WebP" }, { status: 400 });
  }
  if (body?.action === "sign") {
    return NextResponse.json(await createUploadTarget(`references/${access.ownerId}/${randomUUID()}.${EXT[mime]}`));
  }
  if (body?.action === "register") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith(`references/${access.ownerId}/`)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
    await db.insert(creativeAssets).values({
      ownerId: access.ownerId,
      studioId: studio.id,
      presenterId,
      kind: "reference",
      storagePath: path,
      mime,
      width: int(body.width),
      height: int(body.height),
      source: "upload",
    });
    return NextResponse.json({ references: await list(access.ownerId, studio, presenterId) });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const presenterId = await presenterFrom(access.ownerId, studio, req);
  if (presenterId === undefined) return noPresenter();
  const id = req.nextUrl.searchParams.get("assetId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [ref] = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.id, id), referencesWhere(access.ownerId, studio, presenterId)))
    .limit(1);
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await removePaths([ref.storagePath]);
  await db.delete(creativeAssets).where(eq(creativeAssets.id, ref.id));
  return NextResponse.json({ references: await list(access.ownerId, studio, presenterId) });
}
