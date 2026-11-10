import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeClips, creativeProjects } from "@/lib/creative-studio/tables";
import { EMPTY_BRIEF } from "@/lib/creative-studio/prompts";
import { cleanBrief, cleanFormatRig } from "@/lib/creative-studio/validate";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { inStudio, studioFromRequest, studioNotFound } from "@/lib/creative-studio/studios";
import { presenterForStudio } from "@/lib/creative-studio/presenters";
import { signPaths } from "@/lib/creative-studio/storage";

/** The videos in one studio (`?studio=`; Nexli's by default). */
export async function GET(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();

  const projects = await db
    .select()
    .from(creativeProjects)
    .where(and(eq(creativeProjects.ownerId, access.ownerId), inStudio(creativeProjects.studioId, studio)))
    .orderBy(desc(creativeProjects.updatedAt));
  const ids = projects.map((p) => p.id);

  const [frames, counts, videos, firstClips] = ids.length
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
        // Hover previews: the newest render / final cut / rough cut per project…
        db
          .select({ projectId: creativeAssets.projectId, kind: creativeAssets.kind, path: creativeAssets.storagePath })
          .from(creativeAssets)
          .where(and(inArray(creativeAssets.projectId, ids), inArray(creativeAssets.kind, ["render", "final_cut", "rough_cut"])))
          .orderBy(desc(creativeAssets.createdAt)),
        // …or the first rendered Kling clip.
        db
          .select({ projectId: creativeClips.projectId, videoAssetId: creativeClips.videoAssetId })
          .from(creativeClips)
          .where(and(inArray(creativeClips.projectId, ids), isNotNull(creativeClips.videoAssetId)))
          .orderBy(asc(creativeClips.idx)),
      ])
    : [[], [], [], []];

  const firstFrame = new Map<string, string>();
  for (const f of [...frames].sort((a, b) => a.sort - b.sort)) {
    if (f.path && f.projectId && !firstFrame.has(f.projectId)) firstFrame.set(f.projectId, f.path);
  }
  // Best video to preview on hover: final render > final cut > auto-cut > first clip.
  const RANK: Record<string, number> = { render: 0, final_cut: 1, rough_cut: 2 };
  const preview = new Map<string, { path: string; rank: number }>();
  for (const v of videos) {
    if (!v.projectId || !v.path) continue;
    const rank = RANK[v.kind] ?? 9;
    const cur = preview.get(v.projectId);
    if (!cur || rank < cur.rank) preview.set(v.projectId, { path: v.path, rank });
  }
  const firstClip = new Map<string, string>();
  for (const c of firstClips) if (c.videoAssetId && !preview.has(c.projectId) && !firstClip.has(c.projectId)) firstClip.set(c.projectId, c.videoAssetId);
  const clipAssetIds = [...firstClip.values()];
  if (clipAssetIds.length) {
    const clipAssets = await db
      .select({ id: creativeAssets.id, projectId: creativeAssets.projectId, path: creativeAssets.storagePath })
      .from(creativeAssets)
      .where(inArray(creativeAssets.id, clipAssetIds));
    for (const a of clipAssets) if (a.projectId && a.path && !preview.has(a.projectId)) preview.set(a.projectId, { path: a.path, rank: 3 });
  }
  const signed = await signPaths([...firstFrame.values(), ...[...preview.values()].map((v) => v.path)], 6 * 3600);
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
        previewUrl: preview.has(p.id) ? signed.get(preview.get(p.id)!.path) ?? null : null,
        updatedAt: p.updatedAt.toISOString(),
        batchId: p.batchId ?? null,
      };
    }),
  });
}

/** "New video": creates a project instantly in the studio (`?studio=`), no form. */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const studio = await studioFromRequest(access.ownerId, req);
  if (!studio) return studioNotFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : "Untitled video";
  const { format, rig } = cleanFormatRig(body?.format, body?.rig);
  // Who presents (a saved presenter of this studio; absent = the studio's default).
  const presenter = await presenterForStudio(access.ownerId, studio.id, body?.presenterId);
  if (presenter === undefined) return NextResponse.json({ error: "That presenter isn't in this studio." }, { status: 400 });

  const [created] = await db
    .insert(creativeProjects)
    .values({
      ownerId: access.ownerId,
      createdBy: access.actorId,
      studioId: studio.id,
      title,
      format,
      rig,
      brief: body?.brief ? cleanBrief(body.brief) : { ...EMPTY_BRIEF, direction: "" },
      presenter,
    })
    .returning({ id: creativeProjects.id });
  return NextResponse.json({ ok: true, id: created.id });
}
