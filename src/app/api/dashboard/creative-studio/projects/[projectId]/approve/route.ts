import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail, rebuildPrompts } from "@/lib/creative-studio/service";
import { scriptPresenterMismatch } from "@/lib/creative-studio/prompts";

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
  // Kling would get the old presenter's name and look with the new presenter's frames.
  if (scriptPresenterMismatch(project.frameSpec, project.presenter)) {
    return NextResponse.json(
      { error: `This script was written for someone else. Rewrite it for ${project.presenter?.name || "the studio's presenter"} first.` },
      { status: 400 }
    );
  }
  // Kling gets prompts built by today's rules (e.g. a script written before only Daniela had a set voice).
  await rebuildPrompts(project);
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
