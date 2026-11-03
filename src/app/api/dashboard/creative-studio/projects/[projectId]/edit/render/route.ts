import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeEdits } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestEdit, renderProps } from "@/lib/creative-studio/edit-service";
import { remotionMissing, startRender } from "@/lib/creative-studio/remotion";

export const maxDuration = 60;

type Ctx = { params: Promise<{ projectId: string }> };

/** Render the newest edit version on Remotion Lambda. */
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
    // Every Lambda chunk downloads the cut, so the link has to outlive the render.
    const { renderId, bucketName } = await startRender(await renderProps(edit, 12 * 3600));
    await db
      .update(creativeEdits)
      .set({ status: "rendering", renderId, renderBucket: bucketName, progress: 0, error: null, specs: null, outputAssetId: null, outputKey: null, updatedAt: new Date() })
      .where(eq(creativeEdits.id, edit.id));
    return NextResponse.json(await projectDetail(project));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Starting the render failed";
    console.error("[creative-studio] render start failed:", message);
    return NextResponse.json({ error: `Remotion: ${message.slice(0, 300)}` }, { status: 500 });
  }
}
