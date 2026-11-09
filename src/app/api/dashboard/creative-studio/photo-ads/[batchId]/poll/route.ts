import { NextRequest, NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { ManusError } from "@/lib/creative-studio/manus";
import { advanceBatch, batchView, loadBatch } from "@/lib/creative-studio/photo-ads-service";

export const maxDuration = 120;

type Ctx = { params: Promise<{ batchId: string }> };

/** Check the batch's Manus tasks, save finished ads and start the next ones in line. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const batch = await loadBatch(access.ownerId, (await params).batchId);
  if (!batch) return NextResponse.json({ error: "That batch wasn't found" }, { status: 404 });
  try {
    await advanceBatch(batch);
  } catch (err) {
    if (err instanceof ManusError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[creative-studio] photo ads poll failed:", err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ batch: await batchView(batch) });
}
