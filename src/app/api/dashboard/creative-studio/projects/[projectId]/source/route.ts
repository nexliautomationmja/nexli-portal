import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeClips, creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { createUploadTarget, removePaths } from "@/lib/creative-studio/storage";
import { assetFiles, mediaItems, sourceOf } from "@/lib/creative-studio/source";
import { SOURCE_MAX_BYTES, SOURCE_MAX_SECONDS, SOURCE_TYPES, tooLongMessage } from "@/lib/creative-studio/reaction-shared";

type Ctx = { params: Promise<{ projectId: string }> };

/** The video can change until the script is approved (after that the clips are made for it). */
const CHANGEABLE = new Set(["draft", "scripted"]);

const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : null);

/**
 * The video a reaction video reacts to.
 * POST { action: "sign", mime, size? } → one-time upload target (browser → storage).
 * POST { action: "register", path, mime, filename, durationS?, width?, height? } → it becomes
 *   this video's source (replacing the old one), and the video becomes a reaction video.
 * DELETE → no source any more (only before a script is written).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mime = typeof body?.mime === "string" ? body.mime : "";
  if (!SOURCE_TYPES[mime]) return NextResponse.json({ error: "Upload an MP4 or MOV video" }, { status: 400 });
  if (!CHANGEABLE.has(project.status)) {
    return NextResponse.json({ error: "The script is approved, so the video she reacts to can't change now." }, { status: 409 });
  }

  if (body?.action === "sign") {
    const size = typeof body.size === "number" ? body.size : 0;
    if (size > SOURCE_MAX_BYTES) {
      return NextResponse.json({ error: `That file is ${Math.round(size / 1024 / 1024)} MB. Upload one under ${SOURCE_MAX_BYTES / 1024 / 1024} MB (export it at 1080p).` }, { status: 400 });
    }
    return NextResponse.json(await createUploadTarget(`${project.id}/source/${randomUUID()}.${SOURCE_TYPES[mime]}`));
  }

  if (body?.action === "register") {
    const path = typeof body.path === "string" ? body.path : "";
    const shape = new RegExp(`^${project.id}/source/[0-9a-f-]{36}\\.(mp4|mov)$`, "i");
    if (!shape.test(path)) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    // The browser's own reading of the file (it knows the upright size); the server checks again.
    const durationS = num(body.durationS, 36_000);
    if (durationS && durationS > SOURCE_MAX_SECONDS + 0.5) return NextResponse.json({ error: tooLongMessage(durationS) }, { status: 400 });

    const old = await sourceOf(project);
    // One use per video: clips shown on screen or a video to recreate go.
    const media = await mediaItems(project);
    const [asset] = await db
      .insert(creativeAssets)
      .values({
        projectId: project.id,
        kind: "source_video",
        storagePath: path,
        mime,
        width: num(body.width, 10_000) ? Math.round(body.width as number) : null,
        height: num(body.height, 10_000) ? Math.round(body.height as number) : null,
        durationMs: durationS ? Math.round(durationS * 1000) : null,
        source: "upload",
        status: "processing",
        metadata: { filename: typeof body.filename === "string" ? body.filename.slice(0, 200) : "video" },
      })
      .returning();
    const [updated] = await db
      .update(creativeProjects)
      .set({ reaction: { sourceId: asset.id, scriptFor: project.reaction?.scriptFor ?? null }, media: null, updatedAt: new Date() })
      .where(eq(creativeProjects.id, project.id))
      .returning();
    if (old) {
      await db.delete(creativeAssets).where(eq(creativeAssets.id, old.id));
      await removePaths(assetFiles(old));
    }
    for (const m of media) {
      await db.delete(creativeAssets).where(eq(creativeAssets.id, m.id));
      await removePaths(assetFiles(m));
    }
    return NextResponse.json(await projectDetail(updated));
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const [{ n }] = await db.select({ n: count() }).from(creativeClips).where(eq(creativeClips.projectId, project.id));
  if (n > 0) return NextResponse.json({ error: "The script was written for this video. Replace it instead." }, { status: 409 });
  const old = await sourceOf(project);
  const [updated] = await db
    .update(creativeProjects)
    .set({ reaction: null, updatedAt: new Date() })
    .where(eq(creativeProjects.id, project.id))
    .returning();
  if (old) {
    await db.delete(creativeAssets).where(and(eq(creativeAssets.id, old.id), eq(creativeAssets.projectId, project.id)));
    await removePaths(assetFiles(old));
  }
  return NextResponse.json(await projectDetail(updated));
}
