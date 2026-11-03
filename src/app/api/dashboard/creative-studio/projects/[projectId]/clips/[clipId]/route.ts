import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips, type ClipFields } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipFieldsOf, derivedClip, projectDetail, touchProject } from "@/lib/creative-studio/service";

type Ctx = { params: Promise<{ projectId: string; clipId: string }> };

async function loadClip(projectId: string, clipId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(clipId)) return null;
  const [clip] = await db
    .select()
    .from(creativeClips)
    .where(and(eq(creativeClips.id, clipId), eq(creativeClips.projectId, projectId)))
    .limit(1);
  return clip ?? null;
}

/** Edit a clip's fields; duration and the Kling prompt are recomputed server-side. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const { projectId, clipId } = await params;
  const project = await loadProject(access.ownerId, projectId);
  if (!project) return notFound();
  const clip = await loadClip(project.id, clipId);
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Partial<ClipFields> | null;
  const current = clipFieldsOf(clip);
  const s = (v: unknown, fallback: string) => (typeof v === "string" ? v.slice(0, 2000) : fallback);
  const next: ClipFields = {
    section: s(body?.section, current.section).trim() || current.section,
    speaker:
      body?.speaker === null || ["LEFT", "CENTER", "RIGHT"].includes(body?.speaker as string)
        ? (body?.speaker as ClipFields["speaker"])
        : current.speaker,
    line: s(body?.line, current.line).trim() || current.line,
    register: s(body?.register, current.register),
    action: s(body?.action, current.action),
    editNote: s(body?.editNote, current.editNote),
    cues: s(body?.cues, current.cues),
    listenerReactions: Array.isArray(body?.listenerReactions)
      ? body.listenerReactions
          .filter((r) => r && typeof r.shortName === "string" && typeof r.reaction === "string")
          .map((r) => ({ shortName: r.shortName.slice(0, 200), reaction: r.reaction.slice(0, 500) }))
      : current.listenerReactions,
  };

  await db
    .update(creativeClips)
    .set({ ...next, speaker: next.speaker ?? null, ...derivedClip(project, next), updatedAt: new Date() })
    .where(eq(creativeClips.id, clip.id));
  await touchProject(project);
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const { projectId, clipId } = await params;
  const project = await loadProject(access.ownerId, projectId);
  if (!project) return notFound();
  const clip = await loadClip(project.id, clipId);
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  await db.delete(creativeClips).where(eq(creativeClips.id, clip.id));
  await db
    .update(creativeClips)
    .set({ idx: sql`${creativeClips.idx} - 1` })
    .where(and(eq(creativeClips.projectId, project.id), gt(creativeClips.idx, clip.idx)));
  await touchProject(project);
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
