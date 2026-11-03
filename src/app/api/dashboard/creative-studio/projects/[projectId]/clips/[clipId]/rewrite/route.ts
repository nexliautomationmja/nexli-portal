import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips, creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipFieldsOf, clipsOf, derivedClip, framesOf, projectDetail, snapshotOf } from "@/lib/creative-studio/service";
import { signPaths } from "@/lib/creative-studio/storage";
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

  const frames = await framesOf(project.id);
  const signed = await signPaths(frames.slice(0, 1).map((f) => f.storagePath));
  const frameUrls = frames
    .slice(0, 1)
    .map((f) => (f.storagePath ? signed.get(f.storagePath) : undefined))
    .filter(Boolean) as string[];

  let result;
  try {
    result = await rewriteClip({
      input: { title: project.title, format: project.format, rig: project.rig, brief: project.brief, frameUrls },
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
  const fields = result.clip;
  await db
    .update(creativeClips)
    .set({ ...fields, speaker: fields.speaker ?? null, ...derivedClip(project, fields), updatedAt: new Date() })
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
