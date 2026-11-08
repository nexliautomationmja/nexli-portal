import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeProjects } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail } from "@/lib/creative-studio/service";
import { claudeError } from "@/lib/creative-studio/script";
import { normalizeCopy, reviseAdCopy, writeAdCopy, type AdCopyVersion, type CopyContext } from "@/lib/creative-studio/ad-copy";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import { namedFirm, studioById } from "@/lib/creative-studio/studios";

export const maxDuration = 120;

type Ctx = { params: Promise<{ projectId: string }> };
type Project = typeof creativeProjects.$inferSelect;

async function latestCopy(projectId: string) {
  const [row] = await db
    .select()
    .from(creativeAssets)
    .where(and(eq(creativeAssets.projectId, projectId), eq(creativeAssets.kind, "ad_copy")))
    .orderBy(desc(creativeAssets.sort))
    .limit(1);
  return row ?? null;
}

async function copyContext(project: Project, ownerId: string): Promise<CopyContext> {
  const [clips, edit] = await Promise.all([clipsOf(project.id), latestEdit(project.id)]);
  const o = edit?.props.overlays;
  const onScreen = o
    ? [
        o.title && `Title: ${o.title.text}`,
        o.qualifier && `Qualifier: ${o.qualifier.text}`,
        o.cta && `CTA: ${o.cta.text}`,
        ...o.stickers.map((x) => `Sticker: ${x.text}`),
        ...o.cards.map((x) => `Card: ${x.text}`),
        ...o.rungs.map((r) => `Rung: ${r.pill} · ${r.tag}`),
      ].filter((x): x is string => Boolean(x))
    : [];
  return {
    title: project.title,
    direction: project.brief?.direction ?? "",
    lines: clips.map((c) => ({ section: c.section, line: c.line })),
    onScreen,
    firm: namedFirm(await studioById(ownerId, project.studioId)),
  };
}

/**
 * Meta ad copy for the video. POST {} writes a new one from the video;
 * POST { note } changes the newest one ("punchier hook", "fewer emojis").
 * Every call is a new version.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { note?: unknown } | null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";

  try {
    const ctx = await copyContext(project, access.ownerId);
    if (!ctx.lines?.length && !ctx.direction) return NextResponse.json({ error: "Write the script first" }, { status: 400 });
    const prev = await latestCopy(project.id);
    const current = prev ? normalizeCopy(prev.metadata) : null;
    const copy = note && current ? await reviseAdCopy(ctx, current, note) : await writeAdCopy(ctx);
    const version = (current?.version ?? 0) + 1;
    const metadata: AdCopyVersion = { ...copy, version, note: note || null };
    await db.insert(creativeAssets).values({
      projectId: project.id,
      kind: "ad_copy",
      source: "claude",
      sort: version,
      metadata: metadata as unknown as Record<string, unknown>,
    });
    return NextResponse.json(await projectDetail(project));
  } catch (err) {
    console.error("[creative-studio] ad copy failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: claudeError(err, "Writing the ad copy failed") }, { status: 500 });
  }
}
