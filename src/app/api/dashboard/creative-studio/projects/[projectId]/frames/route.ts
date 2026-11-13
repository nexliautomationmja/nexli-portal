import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeClips } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { framesOf, projectDetail, scenesOf } from "@/lib/creative-studio/service";
import { createUploadTarget, FRAME_MIME_TYPES, removePaths } from "@/lib/creative-studio/storage";
import { pinTakeFrames, placeSceneFrame, removeScene, saveScenes } from "@/lib/creative-studio/frames";

type Ctx = { params: Promise<{ projectId: string }> };

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * POST { action: "sign", mime } → one-time upload target in the private
 * bucket (the browser uploads the cropped frame straight to storage). With
 * purpose "recreate" it's a photo for Manus to recreate (not a frame).
 * POST { action: "register", path, mime, width, height, scene? } → frame asset
 * row; with `scene` it goes straight into the scene list ("new" adds a scene,
 * a scene id replaces that scene's frame).
 * PATCH { primaryId } → make that frame the opening frame (sort 0).
 * PATCH { scenes: [{ id, label }] } → reorder / relabel the scenes.
 * DELETE ?assetId → remove a frame · DELETE ?sceneId → remove a scene.
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
    const folder = body.purpose === "recreate" ? "recreate" : "frames";
    const target = await createUploadTarget(`${project.id}/${folder}/${randomUUID()}.${EXT[mime]}`);
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
    const [asset] = await db
      .insert(creativeAssets)
      .values({
        projectId: project.id,
        kind: "frame",
        storagePath: path,
        mime,
        width: int(body.width),
        height: int(body.height),
        source: "upload",
        sort: top === null ? 0 : top + 1,
      })
      .returning({ id: creativeAssets.id });
    if (typeof body.scene === "string" && body.scene) {
      const placed = await placeSceneFrame(project, asset.id, body.scene);
      if (placed.error) return NextResponse.json({ error: placed.error }, { status: 400 });
      const fresh = await loadProject(access.ownerId, project.id);
      return NextResponse.json(await projectDetail(fresh!));
    }
    return NextResponse.json(await projectDetail(project));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { primaryId?: string; scenes?: { id?: unknown; label?: unknown; shot?: unknown }[] } | null;

  // Reorder / relabel the scenes (the same scenes, in a new order).
  if (Array.isArray(body?.scenes)) {
    const current = scenesOf(project, await framesOf(project.id));
    const byId = new Map(current.map((sc) => [sc.id, sc]));
    const next = body.scenes.flatMap((x) => {
      const sc = typeof x?.id === "string" ? byId.get(x.id) : undefined;
      return sc
        ? [
            {
              ...sc,
              label: typeof x.label === "string" ? x.label.trim().slice(0, 80) : sc.label,
              shot: typeof x.shot === "string" ? x.shot.trim().slice(0, 1200) : sc.shot,
            },
          ]
        : [];
    });
    if (next.length !== current.length || new Set(next.map((sc) => sc.id)).size !== current.length) {
      return NextResponse.json({ error: "Those aren't this video's scenes. Reload and try again." }, { status: 400 });
    }
    await saveScenes(project, next);
    const fresh = await loadProject(access.ownerId, project.id);
    return NextResponse.json(await projectDetail(fresh!));
  }

  const frames = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "frame")));
  const primary = frames.find((f) => f.id === body?.primaryId);
  if (!primary) return NextResponse.json({ error: "Frame not found" }, { status: 404 });
  // A story video: the frame becomes scene 1's (its other scenes keep their frames).
  if (project.scenes) {
    const scene1 = project.scenes[0];
    const placed = await placeSceneFrame(project, primary.id, scene1 ? scene1.id : "new");
    if (placed.error) return NextResponse.json({ error: placed.error }, { status: 400 });
    const fresh = await loadProject(access.ownerId, project.id);
    return NextResponse.json(await projectDetail(fresh!));
  }
  const ordered = [primary, ...frames.filter((f) => f.id !== primary.id).sort((a, b) => a.sort - b.sort)];
  for (let i = 0; i < ordered.length; i++) {
    await db.update(creativeAssets).set({ sort: i }).where(eq(creativeAssets.id, ordered[i].id));
  }
  // Clips open on the primary frame (takes already made remember theirs).
  await pinTakeFrames(project.id);
  await db.update(creativeClips).set({ frameAssetId: primary.id }).where(eq(creativeClips.projectId, project.id));
  return NextResponse.json(await projectDetail(project));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const sceneId = req.nextUrl.searchParams.get("sceneId");
  const scene = sceneId ? scenesOf(project, await framesOf(project.id)).find((sc) => sc.id === sceneId) : undefined;
  if (sceneId || (project.scenes && project.scenes.some((sc) => sc.frameId === req.nextUrl.searchParams.get("assetId")))) {
    const id = scene?.id ?? project.scenes?.find((sc) => sc.frameId === req.nextUrl.searchParams.get("assetId"))?.id ?? "";
    const removed = await removeScene(project, id);
    if (removed.error) return NextResponse.json({ error: removed.error }, { status: 400 });
    const fresh = await loadProject(access.ownerId, project.id);
    return NextResponse.json(await projectDetail(fresh!));
  }
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
