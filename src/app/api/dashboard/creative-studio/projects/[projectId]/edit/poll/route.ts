import { NextRequest, NextResponse } from "next/server";
import { createWriteStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets, creativeEdits, type RenderSpecs } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { presignOutput, renderState } from "@/lib/creative-studio/remotion";
import { probeSpecs, tempDir } from "@/lib/creative-studio/autocut";
import { writeStorage } from "@/lib/creative-studio/frames";

export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/** Renders up to this size are copied into storage; bigger ones stay in the Lambda bucket. */
const COPY_LIMIT = 300 * 1024 * 1024;

/**
 * Check the Lambda render. When it's done: read the specs off the delivered
 * mp4 (rulebook § 7 gate 5) and copy it into storage next to everything else.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const [edit] = await db
    .select()
    .from(creativeEdits)
    .where(and(eq(creativeEdits.projectId, project.id), eq(creativeEdits.status, "rendering")))
    .orderBy(desc(creativeEdits.version))
    .limit(1);
  if (!edit?.renderId || !edit.renderBucket) return NextResponse.json(await projectDetail(project));

  const state = await renderState(edit.renderId, edit.renderBucket).catch((err) => {
    console.error("[creative-studio] render progress failed:", err instanceof Error ? err.message : err);
    return null;
  });
  if (!state) return NextResponse.json(await projectDetail(project));
  if (state.failed) {
    await db.update(creativeEdits).set({ status: "failed", error: state.failed, updatedAt: new Date() }).where(eq(creativeEdits.id, edit.id));
    return NextResponse.json(await projectDetail(project));
  }
  if (!state.done || !state.outKey || !state.outBucket) {
    const progress = Math.round(state.progress * 100);
    if (progress !== edit.progress) await db.update(creativeEdits).set({ progress, updatedAt: new Date() }).where(eq(creativeEdits.id, edit.id));
    return NextResponse.json(await projectDetail(project));
  }

  const dir = await tempDir("cs-render");
  try {
    const res = await fetch(await presignOutput(state.outBucket, state.outKey, 900));
    if (!res.ok || !res.body) throw new Error(`Couldn't download the render (${res.status})`);
    const file = path.join(dir, "out.mp4");
    await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), createWriteStream(file));
    const size = (await fs.stat(file)).size;

    const probed = await probeSpecs(file).catch(() => null);
    const vertical = edit.props.format !== "vsl_16x9";
    const expectedS = edit.props.durationS;
    const specs: RenderSpecs = {
      width: probed?.width ?? null,
      height: probed?.height ?? null,
      fps: probed?.fps ?? null,
      durationS: probed?.durationS ?? null,
      expectedS,
      hasAudio: probed?.hasAudio ?? false,
      ok: Boolean(
        probed &&
          probed.fps === 60 &&
          probed.width === (vertical ? 1080 : 1920) &&
          probed.height === (vertical ? 1920 : 1080) &&
          probed.durationS !== null &&
          Math.abs(probed.durationS - expectedS) <= 0.1 &&
          probed.hasAudio
      ),
    };

    let outputAssetId: string | null = null;
    if (size <= COPY_LIMIT) {
      const storagePath = `${project.id}/edits/v${edit.version}-${edit.id}.mp4`;
      try {
        await writeStorage(storagePath, await fs.readFile(file), "video/mp4");
      } catch (err) {
        // Over the storage upload limit (500 MB): keep it on AWS, downloaded from there.
        console.warn("[creative-studio] render kept on S3:", err instanceof Error ? err.message : err);
        await db
          .update(creativeEdits)
          .set({ status: "done", progress: 100, outputAssetId: null, outputKey: state.outKey, specs, updatedAt: new Date() })
          .where(eq(creativeEdits.id, edit.id));
        return NextResponse.json(await projectDetail(project));
      }
      const [asset] = await db
        .insert(creativeAssets)
        .values({
          projectId: project.id,
          kind: "render",
          storagePath,
          mime: "video/mp4",
          durationMs: probed?.durationS ? Math.round(probed.durationS * 1000) : null,
          width: probed?.width ?? null,
          height: probed?.height ?? null,
          source: "remotion",
          providerTaskId: edit.renderId,
          metadata: { editId: edit.id, version: edit.version, style: edit.style, bytes: size },
        })
        .returning({ id: creativeAssets.id });
      outputAssetId = asset.id;
    }
    await db
      .update(creativeEdits)
      .set({ status: "done", progress: 100, outputAssetId, outputKey: state.outKey, specs, updatedAt: new Date() })
      .where(eq(creativeEdits.id, edit.id));
    return NextResponse.json(await projectDetail(project));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Saving the render failed";
    console.error("[creative-studio] render save failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
