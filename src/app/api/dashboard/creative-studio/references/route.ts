import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { inStudio, studioFromRequest, studioNotFound, type Studio } from "@/lib/creative-studio/studios";
import { createUploadTarget, FRAME_MIME_TYPES, removePaths, signPaths } from "@/lib/creative-studio/storage";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function list(ownerId: string, studio: Studio) {
  const refs = await db
    .select()
    .from(creativeAssets)
    .where(
      and(
        eq(creativeAssets.ownerId, ownerId),
        eq(creativeAssets.kind, "reference"),
        isNull(creativeAssets.projectId),
        inStudio(creativeAssets.studioId, studio)
      )
    )
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
 * Reference images — one library per studio (`?studio=`), reused in every
 * video of that studio: Daniela's in Nexli's studio, a client studio's own.
 */
export async function GET(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  return NextResponse.json({ references: await list(access.ownerId, studio) });
}

export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
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
      kind: "reference",
      storagePath: path,
      mime,
      width: int(body.width),
      height: int(body.height),
      source: "upload",
    });
    return NextResponse.json({ references: await list(access.ownerId, studio) });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const id = req.nextUrl.searchParams.get("assetId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [ref] = await db
    .select()
    .from(creativeAssets)
    .where(
      and(
        eq(creativeAssets.id, id),
        eq(creativeAssets.ownerId, access.ownerId),
        eq(creativeAssets.kind, "reference"),
        isNull(creativeAssets.projectId),
        inStudio(creativeAssets.studioId, studio)
      )
    )
    .limit(1);
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await removePaths([ref.storagePath]);
  await db.delete(creativeAssets).where(eq(creativeAssets.id, ref.id));
  return NextResponse.json({ references: await list(access.ownerId, studio) });
}
