import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeCuts } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestCut } from "@/lib/creative-studio/autocut-service";

type Ctx = { params: Promise<{ projectId: string }> };

/** Approve the latest auto-cut: it becomes the project's final cut (the Remotion edit's input). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const cut = await latestCut(project.id);
  if (!cut || cut.status !== "ready" || !cut.assetId) {
    return NextResponse.json({ error: "There's no finished cut to approve yet." }, { status: 400 });
  }
  const [rough] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, cut.assetId)).limit(1);
  if (!rough?.storagePath) return NextResponse.json({ error: "The cut's video is missing" }, { status: 500 });

  await db
    .update(creativeCuts)
    .set({ status: "ready" })
    .where(and(eq(creativeCuts.projectId, project.id), eq(creativeCuts.status, "approved")));
  await db.update(creativeCuts).set({ status: "approved" }).where(eq(creativeCuts.id, cut.id));
  await db.insert(creativeAssets).values({
    projectId: project.id,
    kind: "final_cut",
    storagePath: rough.storagePath,
    mime: "video/mp4",
    durationMs: rough.durationMs,
    source: "autocut",
    metadata: {
      filename: `Auto-cut v${cut.version} · ${cut.settings.speed}× · ${cut.settings.gap}s pauses`,
      note: "Approved auto-cut",
      fromCutId: cut.id,
    },
  });
  return NextResponse.json(await projectDetail(project));
}
