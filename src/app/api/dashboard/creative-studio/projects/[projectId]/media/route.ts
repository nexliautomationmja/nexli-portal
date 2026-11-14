import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeProjects, MEDIA_MAX, type MediaMode } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { createUploadTarget, removePaths } from "@/lib/creative-studio/storage";
import { assetFiles, mediaItems, sourceOf } from "@/lib/creative-studio/source";
import { SOURCE_MAX_BYTES, SOURCE_MAX_SECONDS, SOURCE_TYPES, tooLongMessage } from "@/lib/creative-studio/reaction-shared";

type Ctx = { params: Promise<{ projectId: string }> };

/** The videos can change until the script is approved (after that the clips are made for them). */
const CHANGEABLE = new Set(["draft", "scripted"]);

const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : null);
const modeOf = (v: unknown): MediaMode | null => (v === "onscreen" || v === "recreate" ? v : null);

/**
 * Videos uploaded to show on screen (up to 10) or to recreate (one).
 * POST { action: "sign", mime, size? } → one-time upload target (browser → storage).
 * POST { action: "register", mode, path, mime, filename, durationS?, width?, height?, replace? } →
 *   added to this video's clips. A different mode, `replace`, or a video to
 *   recreate starts the set over; a reaction's video is dropped (one use per video).
 * DELETE ?assetId → that video is taken out.
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
    return NextResponse.json({ error: "The script is approved, so its videos can't change now." }, { status: 409 });
  }

  if (body?.action === "sign") {
    const size = typeof body.size === "number" ? body.size : 0;
    if (size > SOURCE_MAX_BYTES) {
      return NextResponse.json({ error: `That file is ${Math.round(size / 1024 / 1024)} MB. Upload one under ${SOURCE_MAX_BYTES / 1024 / 1024} MB (export it at 1080p).` }, { status: 400 });
    }
    return NextResponse.json(await createUploadTarget(`${project.id}/media/${randomUUID()}.${SOURCE_TYPES[mime]}`));
  }

  if (body?.action === "register") {
    const mode = modeOf(body.mode);
    if (!mode) return NextResponse.json({ error: "Say what the video is for" }, { status: 400 });
    const path = typeof body.path === "string" ? body.path : "";
    const shape = new RegExp(`^${project.id}/media/[0-9a-f-]{36}\\.(mp4|mov)$`, "i");
    if (!shape.test(path)) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    const durationS = num(body.durationS, 36_000);
    if (durationS && durationS > SOURCE_MAX_SECONDS + 0.5) return NextResponse.json({ error: tooLongMessage(durationS) }, { status: 400 });

    const startOver = body.replace === true || project.media?.mode !== mode || mode === "recreate";
    const keep = startOver ? [] : project.media?.ids ?? [];
    if (keep.length >= MEDIA_MAX[mode]) {
      return NextResponse.json({ error: `A video can show up to ${MEDIA_MAX[mode]} clips on screen.` }, { status: 400 });
    }
    const dropped = startOver ? await mediaItems(project) : [];
    const reactionSource = project.reaction ? await sourceOf(project) : null;

    const [asset] = await db
      .insert(creativeAssets)
      .values({
        projectId: project.id,
        kind: "media_video",
        storagePath: path,
        mime,
        width: num(body.width, 10_000) ? Math.round(body.width as number) : null,
        height: num(body.height, 10_000) ? Math.round(body.height as number) : null,
        durationMs: durationS ? Math.round(durationS * 1000) : null,
        source: "upload",
        status: "processing",
        metadata: { filename: typeof body.filename === "string" ? body.filename.slice(0, 200) : "video", role: mode },
      })
      .returning();
    const [updated] = await db
      .update(creativeProjects)
      .set({
        media: { mode, ids: [...keep, asset.id], scriptFor: project.media?.scriptFor ?? null },
        reaction: null,
        updatedAt: new Date(),
      })
      .where(eq(creativeProjects.id, project.id))
      .returning();
    const gone = [...dropped, ...(reactionSource ? [reactionSource] : [])];
    if (gone.length) {
      await db.delete(creativeAssets).where(inArray(creativeAssets.id, gone.map((a) => a.id)));
      await removePaths(gone.flatMap(assetFiles));
    }
    return NextResponse.json(await projectDetail(updated));
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  if (!CHANGEABLE.has(project.status)) {
    return NextResponse.json({ error: "The script is approved, so its videos can't change now." }, { status: 409 });
  }
  const id = req.nextUrl.searchParams.get("assetId") ?? "";
  if (!project.media?.ids.includes(id)) return NextResponse.json({ error: "Video not found" }, { status: 404 });
  const ids = project.media.ids.filter((x) => x !== id);
  const [updated] = await db
    .update(creativeProjects)
    .set({ media: ids.length ? { ...project.media, ids } : null, updatedAt: new Date() })
    .where(eq(creativeProjects.id, project.id))
    .returning();
  const [old] = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.id, id), eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "media_video")))
    .limit(1);
  if (old) {
    await db.delete(creativeAssets).where(eq(creativeAssets.id, old.id));
    await removePaths(assetFiles(old));
  }
  return NextResponse.json(await projectDetail(updated));
}
