import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { signPaths } from "@/lib/creative-studio/storage";
import { ManusError, startFrameTask } from "@/lib/creative-studio/manus";

export const maxDuration = 60;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Ask Manus for Daniela frame options from a one-line shot description + the
 * reference images: 2 to choose from, or 1 when a batch makes frames for
 * many videos at once (body.count).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { shot?: string; referenceIds?: string[]; count?: number } | null;
  const shot = typeof body?.shot === "string" ? body.shot.trim().slice(0, 1500) : "";
  if (!shot) return NextResponse.json({ error: "Describe the shot you want" }, { status: 400 });

  const refsQuery = and(eq(creativeAssets.ownerId, access.ownerId), eq(creativeAssets.kind, "reference"), isNull(creativeAssets.projectId));
  const ids = Array.isArray(body?.referenceIds) ? body.referenceIds.filter((x) => typeof x === "string") : [];
  const refs = await db
    .select()
    .from(creativeAssets)
    .where(ids.length ? and(refsQuery, inArray(creativeAssets.id, ids)) : refsQuery)
    .limit(6);
  const signed = await signPaths(refs.map((r) => r.storagePath), 2 * 3600);
  const referenceUrls = refs.map((r) => (r.storagePath ? signed.get(r.storagePath) : undefined)).filter(Boolean) as string[];

  try {
    const task = await startFrameTask({
      shot,
      aspect: project.format === "vsl_16x9" ? "16:9" : "9:16",
      count: body?.count === 1 ? 1 : 2,
      referenceUrls,
    });
    await db.insert(creativeAssets).values({
      projectId: project.id,
      kind: "manus_task",
      source: "manus",
      providerTaskId: task.taskId,
      status: "running",
      metadata: { shot, taskUrl: task.taskUrl, references: refs.map((r) => r.id) },
    });
  } catch (err) {
    const message = err instanceof ManusError ? err.message : "Couldn't start Manus";
    console.error("[creative-studio] Manus start failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
  return NextResponse.json(await projectDetail(project));
}
