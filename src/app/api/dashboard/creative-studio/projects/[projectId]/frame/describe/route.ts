import { NextRequest, NextResponse } from "next/server";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, framesOf, projectDetail } from "@/lib/creative-studio/service";
import { claudeError } from "@/lib/creative-studio/script";
import { redescribeFrames } from "@/lib/creative-studio/redescribe";
import { framesToRedescribe } from "@/lib/creative-studio/remake-shared";

export const maxDuration = 120;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Bring the frame description up to date with a new frame, keeping the
 * script: Claude re-describes the frame and changes only actions the new
 * pose can't support. POST { frameIds? } — default: the frames whose clips
 * were made from an old frame, else the opening frame.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { frameIds?: unknown } | null;
  const [frames, clips] = await Promise.all([framesOf(project.id), clipsOf(project.id)]);
  if (clips.length === 0) return NextResponse.json({ error: "There's no script yet. Write it from the frame instead." }, { status: 400 });
  const known = new Set(frames.map((f) => f.id));
  const asked = Array.isArray(body?.frameIds) ? body.frameIds.filter((x): x is string => typeof x === "string" && known.has(x)) : [];
  const frameIds = asked.length ? asked : framesToRedescribe(project.frameSpec, clips).length ? framesToRedescribe(project.frameSpec, clips) : frames[0] ? [frames[0].id] : [];
  if (frameIds.length === 0) return NextResponse.json({ error: "Pick the frame first." }, { status: 400 });
  try {
    const { project: updated, notes } = await redescribeFrames(project, frameIds);
    return NextResponse.json({ ...(await projectDetail(updated)), describeNotes: notes });
  } catch (err) {
    console.error("[creative-studio] frame describe failed:", err);
    return NextResponse.json({ error: claudeError(err, "Describing the new frame failed. Please try again.") }, { status: 502 });
  }
}
