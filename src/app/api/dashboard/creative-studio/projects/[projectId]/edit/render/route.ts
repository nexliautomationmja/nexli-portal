import { NextRequest, NextResponse } from "next/server";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import { remotionMissing } from "@/lib/creative-studio/remotion";
import { leaveQueue, queueRender } from "@/lib/creative-studio/render-queue";

export const maxDuration = 60;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Render the newest edit version on Remotion Lambda. It starts now if the AWS
 * account has room, otherwise it waits in line (render-queue.ts) and the
 * page's progress checks start it when a slot frees up.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const missing = remotionMissing();
  if (missing.length) {
    return NextResponse.json(
      { error: `Remotion isn't connected yet: ${missing.join(", ")} ${missing.length > 1 ? "aren't" : "isn't"} set in Vercel.` },
      { status: 400 }
    );
  }
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json(await projectDetail(project));

  try {
    await queueRender(edit);
    return NextResponse.json(await projectDetail(project));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Starting the render failed";
    console.error("[creative-studio] render start failed:", message);
    return NextResponse.json({ error: `Remotion: ${message.slice(0, 300)}` }, { status: 500 });
  }
}

/** Take a render that's still in line (not on Lambda yet) back out. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const edit = await latestEdit(project.id);
  if (!edit || !(await leaveQueue(edit))) {
    return NextResponse.json({ error: "That render has already started on AWS — it can't be stopped now." }, { status: 409 });
  }
  return NextResponse.json(await projectDetail(project));
}
