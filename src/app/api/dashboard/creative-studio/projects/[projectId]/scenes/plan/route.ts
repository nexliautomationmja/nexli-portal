import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { framesOf, projectDetail, scenesOf } from "@/lib/creative-studio/service";
import { saveScenes } from "@/lib/creative-studio/frames";
import { signPaths } from "@/lib/creative-studio/storage";
import { mergePlan, planScenes } from "@/lib/creative-studio/scenes";
import { claudeError } from "@/lib/creative-studio/script";
import { presenterOf } from "@/lib/creative-studio/prompts";
import { firmBrief, studioById } from "@/lib/creative-studio/studios";

export const maxDuration = 120;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * POST { note? } — Claude splits the story (the video's direction) into
 * scenes with a shot line each for Manus. Scenes that already have a frame
 * stay; scenes still waiting for one are re-planned (with the note).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const direction = project.brief?.direction?.trim() ?? "";
  if (!direction) return NextResponse.json({ error: "Tell me the story first, then I'll split it into scenes." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { note?: string } | null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";

  const frames = await framesOf(project.id);
  const current = scenesOf(project, frames);
  const framed = current.filter((sc) => sc.frameId);
  const byId = new Map(frames.map((f) => [f.id, f]));
  const paths = framed.map((sc) => byId.get(sc.frameId as string)?.storagePath ?? null);
  const signed = await signPaths(paths);
  const studio = await studioById(access.ownerId, project.studioId);

  let plan;
  try {
    plan = await planScenes({
      direction,
      note,
      format: project.format,
      presenter: presenterOf(project),
      firmBrief: firmBrief(studio),
      kept: framed.map((sc, i) => ({ label: sc.label, url: paths[i] ? signed.get(paths[i] as string) ?? "" : "" })).filter((k) => k.url),
      planned: current.filter((sc) => !sc.frameId).map((sc) => ({ label: sc.label, shot: sc.shot })),
    });
  } catch (err) {
    console.error("[creative-studio] scene plan failed:", err);
    return NextResponse.json({ error: claudeError(err, "Claude couldn't plan the scenes") }, { status: 502 });
  }

  // Kept scenes where Claude put them; new ones as planned slots; a frame is never dropped.
  const next = mergePlan(current, plan.scenes, randomUUID);

  const saved = await saveScenes(project, next);
  const [updated] = await db
    .update(creativeProjects)
    .set({ brief: { ...saved.brief, plan: plan.notes }, updatedAt: new Date() })
    .where(eq(creativeProjects.id, project.id))
    .returning();
  return NextResponse.json(await projectDetail(updated));
}
