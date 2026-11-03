import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeClips, creativeProjects } from "@/lib/creative-studio/tables";
import { EMPTY_BRIEF } from "@/lib/creative-studio/prompts";
import { cleanBrief, cleanFormatRig } from "@/lib/creative-studio/validate";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { signPaths } from "@/lib/creative-studio/storage";

export async function GET() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;

  const projects = await db
    .select()
    .from(creativeProjects)
    .where(eq(creativeProjects.ownerId, access.ownerId))
    .orderBy(desc(creativeProjects.updatedAt));
  const ids = projects.map((p) => p.id);

  const [frames, counts] = ids.length
    ? await Promise.all([
        db
          .select({ projectId: creativeAssets.projectId, path: creativeAssets.storagePath, sort: creativeAssets.sort })
          .from(creativeAssets)
          .where(and(inArray(creativeAssets.projectId, ids), eq(creativeAssets.kind, "frame"))),
        db
          .select({ projectId: creativeClips.projectId, n: sql<number>`count(*)::int` })
          .from(creativeClips)
          .where(inArray(creativeClips.projectId, ids))
          .groupBy(creativeClips.projectId),
      ])
    : [[], []];

  const firstFrame = new Map<string, string>();
  for (const f of [...frames].sort((a, b) => a.sort - b.sort)) {
    if (f.path && f.projectId && !firstFrame.has(f.projectId)) firstFrame.set(f.projectId, f.path);
  }
  const signed = await signPaths([...firstFrame.values()]);
  const clipCount = new Map(counts.map((c) => [c.projectId, c.n]));

  return NextResponse.json({
    projects: projects.map((p) => {
      const path = firstFrame.get(p.id);
      return {
        id: p.id,
        title: p.title,
        format: p.format,
        rig: p.rig,
        status: p.status,
        direction: p.brief?.direction ?? "",
        clips: clipCount.get(p.id) ?? 0,
        thumbUrl: path ? signed.get(path) ?? null : null,
        updatedAt: p.updatedAt.toISOString(),
      };
    }),
  });
}

/** "New video": creates a project instantly, no form. */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : "Untitled video";
  const { format, rig } = cleanFormatRig(body?.format, body?.rig);

  const [created] = await db
    .insert(creativeProjects)
    .values({
      ownerId: access.ownerId,
      createdBy: access.actorId,
      title,
      format,
      rig,
      brief: body?.brief ? cleanBrief(body.brief) : { ...EMPTY_BRIEF, direction: "" },
    })
    .returning({ id: creativeProjects.id });
  return NextResponse.json({ ok: true, id: created.id });
}
