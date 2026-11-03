import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail } from "@/lib/creative-studio/service";

type Ctx = { params: Promise<{ projectId: string }> };

/** Approve the script (locks it for Kling rendering). Nothing renders before approval. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  if ((await clipsOf(project.id)).length === 0) {
    return NextResponse.json({ error: "There's no script to approve yet" }, { status: 400 });
  }
  const [updated] = await db
    .update(creativeProjects)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(creativeProjects.id, project.id))
    .returning();
  return NextResponse.json(await projectDetail(updated));
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
