import { NextRequest, NextResponse } from "next/server";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { claudeError } from "@/lib/creative-studio/script";
import { RemakeError, clipsById, remakeClips } from "@/lib/creative-studio/remake";
import { accessToken, KlingNotConnectedError } from "@/lib/creative-studio/kling-mcp";

// A frame description (Claude) plus Kling submissions with their rate-limit backoff.
export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Re-make clips that already have a take, keeping the script: after a new
 * frame (its description is brought up to date first) or just for new takes.
 * Old takes stay in each clip's history. POST { clipIds }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  if (!["approved", "rendering", "clips_ready"].includes(project.status)) {
    return NextResponse.json({ error: "Approve the script first. Nothing renders before approval." }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { clipIds?: unknown } | null;
  const ids = Array.isArray(body?.clipIds) ? body.clipIds.filter((x): x is string => typeof x === "string") : [];
  const clips = await clipsById(project.id, ids);
  if (!clips) return NextResponse.json({ error: "Pick clips from this video." }, { status: 400 });

  let token: string;
  try {
    token = await accessToken(access.ownerId);
  } catch (err) {
    const message = err instanceof KlingNotConnectedError ? err.message : "Couldn't reach Kling";
    return NextResponse.json({ error: message, needsKling: true }, { status: 400 });
  }
  try {
    const { report, notes } = await remakeClips(token, project, clips);
    const fresh = await loadProject(access.ownerId, project.id);
    return NextResponse.json({ ...(await projectDetail(fresh!)), report, ...(notes ? { remakeNotes: notes } : {}) });
  } catch (err) {
    if (err instanceof RemakeError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("[creative-studio] re-make failed:", err);
    return NextResponse.json({ error: claudeError(err, "Re-making the clips failed. Please try again.") }, { status: 502 });
  }
}
