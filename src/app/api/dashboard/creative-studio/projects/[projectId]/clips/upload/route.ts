import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips, creativeProjects, type ClipUpload } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail } from "@/lib/creative-studio/service";
import { createUploadTarget } from "@/lib/creative-studio/storage";
import { SOURCE_MAX_BYTES, SOURCE_MAX_SECONDS, SOURCE_TYPES, tooLongMessage } from "@/lib/creative-studio/reaction-shared";
import { UPLOAD_CLIP_PROMPT, UPLOAD_CLIP_SECTION, UPLOAD_CLIP_STATUSES } from "@/lib/creative-studio/upload-clip";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Your own video as a clip, once the script is approved (Nov 22 2026).
 * POST { action: "sign", mime, size? } → one-time upload target (browser → storage).
 * POST { action: "add", path, mime, filename, afterIdx, durationS? } → a new clip
 *   after clip `afterIdx` (−1 = at the start), "preparing" until
 *   clips/[clipId]/prepare makes its take. Returns the project and `clipId`.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mime = typeof body?.mime === "string" ? body.mime : "";
  if (!SOURCE_TYPES[mime]) return NextResponse.json({ error: "Add an MP4 or MOV video." }, { status: 400 });
  if (!UPLOAD_CLIP_STATUSES.includes(project.status)) {
    return NextResponse.json({ error: "Approve the script first: your own video goes in with the clips." }, { status: 409 });
  }

  if (body?.action === "sign") {
    const size = typeof body.size === "number" ? body.size : 0;
    if (size > SOURCE_MAX_BYTES) {
      return NextResponse.json({ error: `That file is ${Math.round(size / 1024 / 1024)} MB. Add one under ${SOURCE_MAX_BYTES / 1024 / 1024} MB (export it at 1080p).` }, { status: 400 });
    }
    return NextResponse.json(await createUploadTarget(`${project.id}/clips/upload/${randomUUID()}.${SOURCE_TYPES[mime]}`));
  }

  if (body?.action === "add") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith(`${project.id}/clips/upload/`) || path.includes("..")) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    const durationS = typeof body.durationS === "number" && Number.isFinite(body.durationS) && body.durationS > 0 ? body.durationS : null;
    if (durationS && durationS > SOURCE_MAX_SECONDS + 0.5) return NextResponse.json({ error: tooLongMessage(durationS, SOURCE_MAX_SECONDS) }, { status: 400 });

    const clips = await clipsOf(project.id);
    const asked = typeof body.afterIdx === "number" && Number.isInteger(body.afterIdx) ? body.afterIdx : clips.length - 1;
    const after = Math.max(-1, Math.min(asked, clips.length - 1));
    const upload: ClipUpload = {
      filename: typeof body.filename === "string" && body.filename.trim() ? body.filename.trim().slice(0, 200) : "your video",
      originalPath: path,
      mime,
      addedAt: new Date().toISOString(),
      claimedAt: null,
    };

    // Make room after `after`, then the clip goes in (the same two steps as adding a script line).
    await db
      .update(creativeClips)
      .set({ idx: sql`${creativeClips.idx} + 1` })
      .where(and(eq(creativeClips.projectId, project.id), gt(creativeClips.idx, after)));
    const [row] = await db
      .insert(creativeClips)
      .values({
        projectId: project.id,
        idx: after + 1,
        section: UPLOAD_CLIP_SECTION,
        speaker: null,
        line: "",
        register: "",
        action: "",
        kind: "to_camera",
        durationS: Math.max(1, Math.round(durationS ?? 1)),
        prompt: UPLOAD_CLIP_PROMPT,
        status: "preparing",
        upload,
      })
      .returning({ id: creativeClips.id });
    // Not touchProject: that would send an approved script back to "scripted".
    await db.update(creativeProjects).set({ updatedAt: new Date() }).where(eq(creativeProjects.id, project.id));
    const clipId = row.id;

    const fresh = await loadProject(access.ownerId, project.id);
    return NextResponse.json({ ...(await projectDetail(fresh!)), clipId });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
