import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { framesOf, projectDetail, replaceScript } from "@/lib/creative-studio/service";
import { signPaths } from "@/lib/creative-studio/storage";
import { generateScript } from "@/lib/creative-studio/script";

// A full VSL script (30–50 clips) can take a couple of minutes.
export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/** Generate a new script version with Claude (the previous one goes to history). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();

  const frames = await framesOf(project.id);
  if (frames.length === 0) {
    return NextResponse.json({ error: "Add the opening frame first. The script is written from it." }, { status: 400 });
  }
  const signed = await signPaths(frames.map((f) => f.storagePath));
  const frameUrls = frames.map((f) => (f.storagePath ? signed.get(f.storagePath) : undefined)).filter(Boolean) as string[];

  try {
    const result = await generateScript({
      title: project.title,
      format: project.format,
      rig: project.rig,
      brief: project.brief,
      frameUrls,
    });
    await replaceScript(project, { frameSpec: result.frame, notes: result.notes, clips: result.clips }, "Replaced by a new script");
  } catch (err) {
    console.error("[creative-studio] script generation failed:", err);
    const message =
      err instanceof Anthropic.APIError
        ? `Claude API error (${err.status ?? "network"}). Please try again.`
        : err instanceof Error
          ? err.message
          : "Script generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
