import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit } from "@/lib/creative-studio/edit-service";

type Ctx = { params: Promise<{ projectId: string }> };

/** Undo the last edit change: drop the newest version. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const edit = await latestEdit(project.id);
  if (!edit || edit.version <= 1) return NextResponse.json({ error: "Nothing to undo" }, { status: 400 });
  if (edit.status === "rendering") return NextResponse.json({ error: "Wait for the render to finish." }, { status: 409 });
  await db.delete(creativeEdits).where(eq(creativeEdits.id, edit.id));
  return NextResponse.json(await projectDetail(project));
}
