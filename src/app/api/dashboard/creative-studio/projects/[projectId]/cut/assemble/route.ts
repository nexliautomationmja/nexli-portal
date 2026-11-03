import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeCuts } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf, projectDetail } from "@/lib/creative-studio/service";
import { joinPieces } from "@/lib/creative-studio/autocut";
import { entryFor, findPiece, loadCut, planFor, tempDir } from "@/lib/creative-studio/autocut-service";
import { readStorage, writeStorage } from "@/lib/creative-studio/frames";

export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/** Join every clip's piece (same encode → no re-encode) into the rough cut for this version. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { cutId?: string } | null;
  const cut = await loadCut(project.id, body?.cutId ?? "");
  if (!cut) return NextResponse.json({ error: "Cut not found" }, { status: 404 });

  const clips = await clipsOf(project.id);
  const plans = clips.map((c) => {
    const e = entryFor(cut, c);
    return planFor(project, c, cut.settings, e.overrides, e.manual);
  });
  const pieces = await Promise.all(plans.map((pl) => findPiece(project.id, pl.hash)));
  const missing = clips.filter((_, i) => !pieces[i]).map((c) => c.id);
  if (missing.length > 0) return NextResponse.json({ error: "Some clips aren't cut yet", missing }, { status: 409 });

  const dir = await tempDir("cs-join");
  try {
    const files: string[] = [];
    for (let i = 0; i < pieces.length; i++) {
      const file = path.join(dir, `${String(i).padStart(3, "0")}.mp4`);
      await fs.writeFile(file, await readStorage(pieces[i]!.storagePath!));
      files.push(file);
    }
    const out = path.join(dir, "rough.mp4");
    await joinPieces(files, out, dir);
    const storagePath = `${project.id}/cut/rough-v${cut.version}.mp4`;
    await writeStorage(storagePath, await fs.readFile(out), "video/mp4");
    const totalKept = plans.reduce((t, p) => t + p.keptS, 0);
    const [asset] = await db
      .insert(creativeAssets)
      .values({
        projectId: project.id,
        kind: "rough_cut",
        storagePath,
        mime: "video/mp4",
        durationMs: Math.round((totalKept / cut.settings.speed) * 1000),
        source: "autocut",
        metadata: { cutId: cut.id, version: cut.version },
      })
      .returning({ id: creativeAssets.id });
    await db
      .update(creativeCuts)
      .set({ plan: plans, status: "ready", assetId: asset.id, error: null })
      .where(eq(creativeCuts.id, cut.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Joining the cut failed";
    console.error("[creative-studio] assemble failed:", message);
    await db.update(creativeCuts).set({ status: "failed", error: message.slice(0, 500) }).where(eq(creativeCuts.id, cut.id));
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  return NextResponse.json(await projectDetail(project));
}
