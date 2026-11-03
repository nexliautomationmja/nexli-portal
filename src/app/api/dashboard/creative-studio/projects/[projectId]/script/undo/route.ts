import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail, replaceScript } from "@/lib/creative-studio/service";

type Ctx = { params: Promise<{ projectId: string }> };

/** Undo the last change: restore the most recent previous version. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const history = project.scriptHistory ?? [];
  const last = history[history.length - 1];
  if (!last) return NextResponse.json({ error: "Nothing to undo" }, { status: 400 });

  // Restore without keeping the undone version (undo shouldn't grow the history).
  await replaceScript(
    { ...project, scriptHistory: history.slice(0, -1) },
    { frameSpec: last.frameSpec, notes: last.notes, clips: last.clips, rig: last.rig },
    "Undone"
  );
  // replaceScript snapshots the current script; drop that snapshot so undo doesn't loop.
  const after = await loadProject(access.ownerId, project.id);
  if (after) {
    await db
      .update(creativeProjects)
      .set({ scriptHistory: (after.scriptHistory ?? []).slice(0, -1) })
      .where(eq(creativeProjects.id, project.id));
  }
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
