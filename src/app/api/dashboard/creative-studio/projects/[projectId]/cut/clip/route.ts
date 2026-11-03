import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeClips } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { renderPiece } from "@/lib/creative-studio/autocut";
import { clipVideoFile, ensureTranscript, entryFor, findPiece, loadCut, planFor, tempDir } from "@/lib/creative-studio/autocut-service";
import { writeStorage } from "@/lib/creative-studio/frames";

export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/** Cut one clip: word timings (once per take) → plan → render the piece, or reuse a cached one. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { cutId?: string; clipId?: string } | null;
  const cut = await loadCut(project.id, body?.cutId ?? "");
  if (!cut) return NextResponse.json({ error: "Cut not found" }, { status: 404 });
  const [clip] = await db
    .select()
    .from(creativeClips)
    .where(and(eq(creativeClips.id, body?.clipId ?? "00000000-0000-0000-0000-000000000000"), eq(creativeClips.projectId, project.id)))
    .limit(1);
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  if (clip.status !== "done") return NextResponse.json({ error: `Clip ${clip.idx + 1} isn't rendered yet` }, { status: 409 });

  const dir = await tempDir("cs-cut");
  try {
    let current = clip;
    let video: string | null = null;
    if (!current.transcript || current.transcript.version !== current.version) {
      video = await clipVideoFile(current, dir);
      current = await ensureTranscript(current, video);
    }
    const e = entryFor(cut, clip);
    const plan = planFor(project, current, cut.settings, e.overrides, e.manual);
    const cached = await findPiece(project.id, plan.hash);
    if (cached) return NextResponse.json({ ok: true, hash: plan.hash, keptS: plan.keptS, cached: true });

    video = video ?? (await clipVideoFile(current, dir));
    const out = path.join(dir, `piece-${plan.hash}.mp4`);
    await renderPiece(video, out, plan, cut.settings, project.format);
    const storagePath = `${project.id}/cut/${plan.hash}.mp4`;
    await writeStorage(storagePath, await fs.readFile(out), "video/mp4");
    await db.insert(creativeAssets).values({
      projectId: project.id,
      kind: "cut_part",
      storagePath,
      mime: "video/mp4",
      durationMs: Math.round((plan.keptS / cut.settings.speed) * 1000),
      source: "autocut",
      sort: clip.idx,
      metadata: { clipId: clip.id, hash: plan.hash, version: clip.version },
    });
    return NextResponse.json({ ok: true, hash: plan.hash, keptS: plan.keptS, cached: false });
  } catch (err) {
    console.error("[creative-studio] cut clip failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cutting the clip failed" }, { status: 500 });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
