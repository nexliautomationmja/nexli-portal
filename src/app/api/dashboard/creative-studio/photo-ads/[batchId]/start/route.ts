import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativePhotoAds, creativePhotoBatches } from "@/lib/creative-studio/tables";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { manusConfigured, ManusError } from "@/lib/creative-studio/manus";
import { advanceBatch, batchView, loadBatch } from "@/lib/creative-studio/photo-ads-service";
import { applyPlanEdits } from "../edits";

export const maxDuration = 120;

type Ctx = { params: Promise<{ batchId: string }> };

/** The review is done: save its last changes and put every concept in line for Manus. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const batch = await loadBatch(access.ownerId, (await params).batchId);
  if (!batch) return NextResponse.json({ error: "That batch wasn't found" }, { status: 404 });
  if (!manusConfigured()) return NextResponse.json({ error: "Manus isn't connected yet. Add MANUS_API_KEY in Vercel." }, { status: 400 });

  await applyPlanEdits(batch.id, await req.json().catch(() => null));
  await db
    .update(creativePhotoAds)
    .set({ status: "queued", updatedAt: new Date() })
    .where(and(eq(creativePhotoAds.batchId, batch.id), eq(creativePhotoAds.status, "planned")));
  await db.update(creativePhotoBatches).set({ status: "started", updatedAt: new Date() }).where(eq(creativePhotoBatches.id, batch.id));
  try {
    await advanceBatch(batch);
  } catch (err) {
    if (err instanceof ManusError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[creative-studio] photo ads start failed:", err instanceof Error ? err.message : err);
  }
  const fresh = (await loadBatch(access.ownerId, batch.id)) ?? batch;
  return NextResponse.json({ batch: await batchView(fresh) });
}
