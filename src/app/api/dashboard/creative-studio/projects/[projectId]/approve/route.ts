import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { approveScript } from "@/lib/creative-studio/approve";

type Ctx = { params: Promise<{ projectId: string }> };

/** Approve the script (locks it for Kling rendering). Nothing renders before approval. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const approved = await approveScript(project);
  if ("error" in approved) return NextResponse.json({ error: approved.error }, { status: approved.status });
  return NextResponse.json(await projectDetail(approved.project));
}

/** Unlock an approved script for more edits. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const [updated] = await db
    .update(creativeProjects)
    .set({ status: "scripted", approvedAt: null, updatedAt: new Date() })
    .where(eq(creativeProjects.id, project.id))
    .returning();
  return NextResponse.json(await projectDetail(updated));
}
