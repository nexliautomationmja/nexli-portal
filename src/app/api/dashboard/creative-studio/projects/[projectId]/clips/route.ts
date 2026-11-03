import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeClips, type ClipFields } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, derivedClip, framesOf, projectDetail, touchProject } from "@/lib/creative-studio/service";

type Ctx = { params: Promise<{ projectId: string }> };

/** Insert a new clip after `afterIdx` (−1 = at the start), copying the neighbour's section. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { afterIdx?: number } | null;
  const clips = await clipsOf(project.id);
  const after = typeof body?.afterIdx === "number" ? Math.max(-1, Math.min(body.afterIdx, clips.length - 1)) : clips.length - 1;
  const neighbour = clips.find((c) => c.idx === after) ?? clips[0];

  await db
    .update(creativeClips)
    .set({ idx: sql`${creativeClips.idx} + 1` })
    .where(and(eq(creativeClips.projectId, project.id), gt(creativeClips.idx, after)));

  const fields: ClipFields = {
    section: neighbour?.section ?? "Clip",
    speaker: neighbour?.speaker ?? null,
    line: "New line.",
    register: "Natural and conversational",
    action: "She opens one hand toward camera",
    editNote: "",
    cues: "",
    listenerReactions: [],
  };
  const frames = await framesOf(project.id);
  await db.insert(creativeClips).values({
    projectId: project.id,
    idx: after + 1,
    ...fields,
    ...derivedClip(project, fields),
    frameAssetId: frames[0]?.id ?? null,
  });
  await touchProject(project);
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
