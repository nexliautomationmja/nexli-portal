import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeClips } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { createUploadTarget, FRAME_MIME_TYPES, removePaths } from "@/lib/creative-studio/storage";

type Ctx = { params: Promise<{ projectId: string }> };

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * POST { action: "sign", mime } → one-time upload target in the private
 * bucket (the browser uploads the cropped frame straight to storage).
 * POST { action: "register", path, mime, width, height } → frame asset row.
 * PATCH { primaryId } → make that frame the opening frame (sort 0).
 * DELETE ?assetId → remove a frame.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mime = typeof body?.mime === "string" ? body.mime : "";
  if (!FRAME_MIME_TYPES.includes(mime)) {
    return NextResponse.json({ error: "Frames must be PNG, JPEG or WebP" }, { status: 400 });
  }

  if (body?.action === "sign") {
    const target = await createUploadTarget(`${project.id}/frames/${randomUUID()}.${EXT[mime]}`);
    return NextResponse.json(target);
  }

  if (body?.action === "register") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith(`${project.id}/frames/`)) {
      return NextResponse.json({ error: "Invalid frame path" }, { status: 400 });
    }
    const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
    const [{ top }] = await db
      .select({ top: max(creativeAssets.sort) })
      .from(creativeAssets)
      .where(and(eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "frame")));
    await db.insert(creativeAssets).values({
      projectId: project.id,
      kind: "frame",
      storagePath: path,
      mime,
      width: int(body.width),
      height: int(body.height),
      source: "upload",
      sort: top === null ? 0 : top + 1,
    });
    return NextResponse.json(await projectDetail(project));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { primaryId?: string } | null;
  const frames = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "frame")));
  const primary = frames.find((f) => f.id === body?.primaryId);
  if (!primary) return NextResponse.json({ error: "Frame not found" }, { status: 404 });
  const ordered = [primary, ...frames.filter((f) => f.id !== primary.id).sort((a, b) => a.sort - b.sort)];
  for (let i = 0; i < ordered.length; i++) {
    await db.update(creativeAssets).set({ sort: i }).where(eq(creativeAssets.id, ordered[i].id));
  }
  // Clips open on the primary frame.
  await db.update(creativeClips).set({ frameAssetId: primary.id }).where(eq(creativeClips.projectId, project.id));
  return NextResponse.json(await projectDetail(project));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const assetId = req.nextUrl.searchParams.get("assetId") ?? "";
  const [asset] = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.id, assetId), eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "frame")))
    .limit(1);
  if (!asset) return NextResponse.json({ error: "Frame not found" }, { status: 404 });
  await removePaths([asset.storagePath]);
  await db.delete(creativeAssets).where(eq(creativeAssets.id, asset.id));
  return NextResponse.json(await projectDetail(project));
}
