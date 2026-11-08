import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipFieldsOf, clipsOf, framesOf, projectDetail, replaceScript } from "@/lib/creative-studio/service";
import { signPaths } from "@/lib/creative-studio/storage";
import { reviseScript } from "@/lib/creative-studio/script";
import { firmBrief, studioById } from "@/lib/creative-studio/studios";

export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/** "What should change?" — Claude revises the script from a plain-English note. Previous version kept. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { note?: string } | null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 3000) : "";
  if (!note) return NextResponse.json({ error: "Say what should change" }, { status: 400 });

  const [frames, clips] = await Promise.all([framesOf(project.id), clipsOf(project.id)]);
  if (clips.length === 0) return NextResponse.json({ error: "There's no script yet" }, { status: 400 });
  const signed = await signPaths(frames.slice(0, 1).map((f) => f.storagePath));
  const frameUrls = frames
    .slice(0, 1)
    .map((f) => (f.storagePath ? signed.get(f.storagePath) : undefined))
    .filter(Boolean) as string[];

  try {
    const result = await reviseScript({
      input: {
          title: project.title,
          format: project.format,
          rig: project.rig,
          brief: project.brief,
          frameUrls,
          firm: firmBrief(await studioById(access.ownerId, project.studioId)),
        },
      frame: project.frameSpec,
      clips: clips.map(clipFieldsOf),
      note,
    });
    await replaceScript(
      project,
      { frameSpec: result.frame, notes: result.notes, clips: result.clips, rig: result.rig },
      `Before: "${note.slice(0, 80)}"`
    );
  } catch (err) {
    console.error("[creative-studio] revise failed:", err);
    const message =
      err instanceof Anthropic.APIError
        ? `Claude API error (${err.status ?? "network"}). Please try again.`
        : err instanceof Error
          ? err.message
          : "Revision failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
