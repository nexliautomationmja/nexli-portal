import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail } from "@/lib/creative-studio/service";
import { submitClips } from "@/lib/creative-studio/render";
import { RemakeError, clipsById, remakeClips } from "@/lib/creative-studio/remake";
import { claudeError } from "@/lib/creative-studio/script";
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
  const body = (await req.json().catch(() => null)) as {
    redo?: { clipId?: string; line?: string; cues?: string; note?: string };
  } | null;

  let token: string;
  try {
    token = await accessToken(access.ownerId);
  } catch (err) {
    const message = err instanceof KlingNotConnectedError ? err.message : "Couldn't reach Kling";
    return NextResponse.json({ error: message, needsKling: true }, { status: 400 });
  }

  let targets;
  if (body?.redo?.clipId) {
    const clips = await clipsById(project.id, [body.redo.clipId]);
    if (!clips) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    try {
      const { report, notes } = await remakeClips(token, project, clips, { note: body.redo.note, line: body.redo.line, cues: body.redo.cues });
      const fresh = await loadProject(access.ownerId, project.id);
      return NextResponse.json({ ...(await projectDetail(fresh!)), report, ...(notes ? { remakeNotes: notes } : {}) });
    } catch (err) {
      if (err instanceof RemakeError) return NextResponse.json({ error: err.message }, { status: 409 });
      console.error("[creative-studio] redo failed:", err);
      return NextResponse.json({ error: claudeError(err, "Claude couldn't adjust the clip. Try again.") }, { status: 502 });
    }
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
