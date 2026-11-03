import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { jobViews, loadJob, metaOf } from "@/lib/creative-studio/ad-copy-jobs";

type Ctx = { params: Promise<{ jobId: string }> };

/** Undo the last change to a job's copy: drop the newest version. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const job = await loadJob(access.ownerId, (await params).jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = metaOf(job);
  const versions = m.versions ?? [];
  if (versions.length < 2) return NextResponse.json({ error: "Nothing to undo" }, { status: 400 });
  await db.update(creativeAssets).set({ metadata: { ...m, versions: versions.slice(0, -1) } }).where(eq(creativeAssets.id, job.id));
  const [view] = await jobViews([(await loadJob(access.ownerId, job.id))!]);
  return NextResponse.json({ job: view });
}
