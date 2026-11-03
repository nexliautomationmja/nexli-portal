import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { claudeError } from "@/lib/creative-studio/script";
import { reviseAdCopy, writeAdCopy, type AdCopyVersion } from "@/lib/creative-studio/ad-copy";
import { copyContextFor, jobViews, loadJob, metaOf } from "@/lib/creative-studio/ad-copy-jobs";
import { removePaths } from "@/lib/creative-studio/storage";

export const maxDuration = 300;

type Ctx = { params: Promise<{ jobId: string }> };

/**
 * Write the copy for a dropped-in video or image: the first time it listens
 * and watches, then writes 4 primary texts + 4 headlines. POST {} again for
 * fresh variations; POST { note } to change the newest set.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const job = await loadJob(access.ownerId, (await params).jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { note?: unknown } | null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";

  try {
    const ctx = await copyContextFor(job, access.ownerId);
    const fresh = (await loadJob(access.ownerId, job.id))!;
    const m = metaOf(fresh);
    const versions = m.versions ?? [];
    const current = versions[versions.length - 1];
    const copy = note && current ? await reviseAdCopy(ctx, current, note) : await writeAdCopy(ctx);
    const next: AdCopyVersion = { ...copy, version: (current?.version ?? 0) + 1, note: note || null };
    await db
      .update(creativeAssets)
      .set({ metadata: { ...m, versions: [...versions, next].slice(-20) } })
      .where(eq(creativeAssets.id, job.id));
    const [view] = await jobViews([(await loadJob(access.ownerId, job.id))!]);
    return NextResponse.json({ job: view });
  } catch (err) {
    console.error("[creative-studio] ad copy job failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: claudeError(err, "Writing the copy failed") }, { status: 500 });
  }
}

/** Delete the job and its files. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const job = await loadJob(access.ownerId, (await params).jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await removePaths([job.storagePath, ...(metaOf(job).framePaths ?? []), metaOf(job).audioPath]);
  await db.delete(creativeAssets).where(eq(creativeAssets.id, job.id));
  return NextResponse.json({ ok: true });
}
