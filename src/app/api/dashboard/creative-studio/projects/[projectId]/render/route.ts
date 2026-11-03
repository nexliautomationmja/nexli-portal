import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips, type ClipFields } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipFieldsOf, clipsOf, derivedClip, projectDetail } from "@/lib/creative-studio/service";
import { submitClips } from "@/lib/creative-studio/render";
import { accessToken, KlingNotConnectedError } from "@/lib/creative-studio/kling-mcp";

// Rate-limit backoff (60 s) plus batches of submissions.
export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * POST {}                         → render every approved clip not yet sent (never resubmits).
 * POST { redo: { clipId, line?, cues? } } → redo one clip directly (framework: redos render
 *   without re-approval); the previous take is kept in the clip's history as v1, v2…
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { redo?: { clipId?: string; line?: string; cues?: string } } | null;

  let token: string;
  try {
    token = await accessToken(access.ownerId);
  } catch (err) {
    const message = err instanceof KlingNotConnectedError ? err.message : "Couldn't reach Kling";
    return NextResponse.json({ error: message, needsKling: true }, { status: 400 });
  }

  let targets;
  if (body?.redo?.clipId) {
    const [clip] = await db
      .select()
      .from(creativeClips)
      .where(and(eq(creativeClips.id, body.redo.clipId), eq(creativeClips.projectId, project.id)))
      .limit(1);
    if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    if (clip.status === "rendering" || clip.status === "queued") {
      return NextResponse.json({ error: "That clip is already rendering" }, { status: 409 });
    }
    // Change only what's needed (line / cue), keep the old take as history.
    const fields: ClipFields = {
      ...clipFieldsOf(clip),
      ...(typeof body.redo.line === "string" && body.redo.line.trim() ? { line: body.redo.line.trim().slice(0, 2000) } : {}),
      ...(typeof body.redo.cues === "string" ? { cues: body.redo.cues.slice(0, 2000) } : {}),
    };
    const previous = clip.klingTaskId || clip.videoAssetId
      ? [
          ...(clip.previous ?? []),
          {
            version: clip.version,
            klingTaskId: clip.klingTaskId,
            videoAssetId: clip.videoAssetId,
            line: clip.line,
            cues: clip.cues,
            status: clip.status,
            error: clip.error,
            at: new Date().toISOString(),
          },
        ]
      : clip.previous ?? [];
    const [updated] = await db
      .update(creativeClips)
      .set({
        ...fields,
        speaker: fields.speaker ?? null,
        ...derivedClip(project, fields),
        version: previous.length > (clip.previous ?? []).length ? clip.version + 1 : clip.version,
        previous,
        klingTaskId: null,
        videoAssetId: null,
        status: "draft",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(creativeClips.id, clip.id))
      .returning();
    targets = [updated];
  } else {
    if (project.status !== "approved" && project.status !== "rendering" && project.status !== "clips_ready") {
      return NextResponse.json({ error: "Approve the script first. Nothing renders before approval." }, { status: 400 });
    }
    const clips = await clipsOf(project.id);
    targets = clips.filter((c) => c.status === "draft" && !c.klingTaskId);
    if (targets.length === 0) {
      return NextResponse.json({ ...(await projectDetail(project)), report: { submitted: 0, queued: 0, failed: 0, message: "Every clip has already been sent to Kling." } });
    }
  }

  const report = await submitClips(token, project, targets);
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json({ ...(await projectDetail(fresh!)), report });
}

/** Clips that ended blocked/failed can be reset to draft (e.g. after rewording) — handled by redo. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const ids = req.nextUrl.searchParams.getAll("clipId");
  if (ids.length) {
    await db
      .update(creativeClips)
      .set({ status: "draft", error: null, updatedAt: new Date() })
      .where(and(eq(creativeClips.projectId, project.id), inArray(creativeClips.id, ids), inArray(creativeClips.status, ["failed", "blocked"])));
  }
  return NextResponse.json(await projectDetail(project));
}
