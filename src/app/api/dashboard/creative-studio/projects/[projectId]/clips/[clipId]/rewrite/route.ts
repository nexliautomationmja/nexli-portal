import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips, creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipColumns, clipFieldsOf, clipsOf, derivedClip, projectDetail, scriptInputFor, snapshotOf } from "@/lib/creative-studio/service";
import { rewriteClip } from "@/lib/creative-studio/script";

export const maxDuration = 120;

type Ctx = { params: Promise<{ projectId: string; clipId: string }> };

/** Claude rewrites one clip. The script before the rewrite is kept as a version. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const { projectId, clipId } = await params;
  const project = await loadProject(access.ownerId, projectId);
  if (!project) return notFound();
  const clips = await clipsOf(project.id);
  const index = clips.findIndex((c) => c.id === clipId);
  if (index < 0) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { instruction?: string } | null;
  const instruction = typeof body?.instruction === "string" ? body.instruction.slice(0, 1000) : "";

  let result;
  try {
    result = await rewriteClip({
      input: await scriptInputFor(project, "change"),
      frame: project.frameSpec,
      clips: clips.map(clipFieldsOf),
      index,
      instruction,
    });
  } catch (err) {
    console.error("[creative-studio] clip rewrite failed:", err);
    const message =
      err instanceof Anthropic.APIError
        ? `Claude API error (${err.status ?? "network"}). Please try again.`
        : err instanceof Error
          ? err.message
          : "Rewrite failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Keep the pre-rewrite script so it can be restored.
  const snapshot = await snapshotOf(project, `Before rewriting clip ${index + 1}`);
  // A one-frame rewrite keeps the clip where it was; a story rewrite says its scene.
  const fields = { ...result.clip, frameId: result.clip.frameId ?? clips[index].frameAssetId ?? null };
  await db
    .update(creativeClips)
    .set({ ...clipColumns(fields), ...derivedClip(project, fields), frameAssetId: fields.frameId, updatedAt: new Date() })
    .where(eq(creativeClips.id, clipId));
  await db
    .update(creativeProjects)
    .set({
      scriptHistory: [...(project.scriptHistory ?? []), ...(snapshot ? [snapshot] : [])].slice(-20),
      scriptVersion: project.scriptVersion + 1,
      status: project.status === "approved" ? "scripted" : project.status,
      approvedAt: project.status === "approved" ? null : project.approvedAt,
      updatedAt: new Date(),
    })
    .where(eq(creativeProjects.id, project.id));

  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json({ ...(await projectDetail(fresh!)), rewriteNotes: result.notes });
}
