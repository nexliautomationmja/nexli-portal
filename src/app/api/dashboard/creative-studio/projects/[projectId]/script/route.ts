import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { framesOf, projectDetail, replaceScript, scenesOf, scriptInputFor } from "@/lib/creative-studio/service";
import { claudeError, generateScript } from "@/lib/creative-studio/script";
import { cleanFormatRig } from "@/lib/creative-studio/validate";
import { presenterForStudio } from "@/lib/creative-studio/presenters";

// A full VSL script (30–50 clips) can take a couple of minutes.
export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Write the script from the frame + what you said the video is about.
 * Body: { direction, format } — format is the only question ("ad or VSL?").
 * Claude reads the presenter setup (solo / selfie / duo / trio) from the frame.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  let project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { direction?: string; format?: string } | null;

  if (body && (typeof body.direction === "string" || body.format)) {
    const direction = typeof body.direction === "string" ? body.direction.slice(0, 6000) : project.brief?.direction ?? "";
    const { format } = cleanFormatRig(body.format ?? project.format, project.rig);
    const [updated] = await db
      .update(creativeProjects)
      .set({ brief: { ...project.brief, direction }, format, updatedAt: new Date() })
      .where(eq(creativeProjects.id, project.id))
      .returning();
    project = updated;
  }
  if (!project.brief?.direction?.trim() && !project.brief?.oldBelief?.trim()) {
    return NextResponse.json({ error: "Tell it what the video is about first." }, { status: 400 });
  }

  const frames = await framesOf(project.id);
  if (frames.length === 0) {
    return NextResponse.json({ error: "Pick the opening frame first. The script is written from it." }, { status: 400 });
  }
  const missing = scenesOf(project, frames).findIndex((sc) => !sc.frameId);
  if (missing >= 0) {
    return NextResponse.json({ error: `Scene ${missing + 1} doesn't have a frame yet. The script is written from every scene.` }, { status: 400 });
  }

  // The presenter as saved now (their voice or look may have been edited since they were picked).
  if (project.presenter?.id) {
    const fresh = await presenterForStudio(access.ownerId, project.studioId, project.presenter.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(project.presenter)) {
      const [updated] = await db.update(creativeProjects).set({ presenter: fresh }).where(eq(creativeProjects.id, project.id)).returning();
      project = updated;
    }
  }

  try {
    const result = await generateScript(await scriptInputFor(project, "write"));
    await replaceScript(
      project,
      { frameSpec: result.frame, notes: result.notes, clips: result.clips, rig: result.rig, title: result.title },
      "Replaced by a new script"
    );
  } catch (err) {
    console.error("[creative-studio] script generation failed:", err);
    return NextResponse.json({ error: claudeError(err, "Script generation failed") }, { status: 502 });
  }

  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
