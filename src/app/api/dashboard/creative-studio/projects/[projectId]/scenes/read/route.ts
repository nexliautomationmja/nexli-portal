import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { framesOf, projectDetail, scenesOf } from "@/lib/creative-studio/service";
import { signPaths } from "@/lib/creative-studio/storage";
import { readScenes } from "@/lib/creative-studio/scenes";
import { claudeError } from "@/lib/creative-studio/script";
import { presenterOf } from "@/lib/creative-studio/prompts";
import { firmBrief, studioById } from "@/lib/creative-studio/studios";

export const maxDuration = 120;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Frames but no direction yet: Claude reads the scenes and asks one question
 * (saved on the brief as `ask`). Empty scene labels take Claude's labels.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const frames = await framesOf(project.id);
  const scenes = scenesOf(project, frames).filter((sc) => sc.frameId).slice(0, 8);
  const byId = new Map(frames.map((f) => [f.id, f]));
  const paths = scenes.map((sc) => byId.get(sc.frameId as string)?.storagePath ?? null);
  if (scenes.length === 0) return NextResponse.json({ error: "Add a frame first." }, { status: 400 });
  // Already read for exactly these frames.
  const ids = scenes.map((sc) => sc.frameId as string);
  if (project.brief?.ask && project.brief.ask.frames.join() === ids.join()) return NextResponse.json(await projectDetail(project));

  const signed = await signPaths(paths);
  const studio = await studioById(access.ownerId, project.studioId);
  let ask;
  try {
    ask = await readScenes({
      frames: scenes.map((sc, i) => ({ id: sc.frameId as string, url: paths[i] ? signed.get(paths[i] as string) ?? "" : "" })).filter((f) => f.url),
      format: project.format,
      presenter: presenterOf(project),
      firmName: studio.kind === "client" ? studio.name : null,
      firmBrief: firmBrief(studio),
    });
  } catch (err) {
    console.error("[creative-studio] scene read failed:", err);
    return NextResponse.json({ error: claudeError(err, "Claude couldn't read the frames") }, { status: 502 });
  }
  // Re-read so a scene added meanwhile isn't overwritten.
  const fresh = (await loadProject(access.ownerId, project.id))!;
  const named = fresh.scenes?.map((sc) => {
    const at = ask.frames.indexOf(sc.frameId ?? "");
    return at >= 0 && !sc.label.trim() && ask.reads[at]?.label ? { ...sc, label: ask.reads[at].label } : sc;
  });
  const [updated] = await db
    .update(creativeProjects)
    .set({ brief: { ...fresh.brief, ask }, ...(named ? { scenes: named } : {}), updatedAt: new Date() })
    .where(eq(creativeProjects.id, project.id))
    .returning();
  return NextResponse.json(await projectDetail(updated));
}
