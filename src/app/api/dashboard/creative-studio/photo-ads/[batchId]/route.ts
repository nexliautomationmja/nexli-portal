import { NextRequest, NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { batchView, deleteBatch, loadBatch } from "@/lib/creative-studio/photo-ads-service";
import { applyPlanEdits } from "./edits";

type Ctx = { params: Promise<{ batchId: string }> };

const missing = () => NextResponse.json({ error: "That batch wasn't found" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const batch = await loadBatch(access.ownerId, (await params).batchId);
  if (!batch) return missing();
  return NextResponse.json({ batch: await batchView(batch) });
}

/** Save review changes to the planned concepts (headline, line, scene, look; remove). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const batch = await loadBatch(access.ownerId, (await params).batchId);
  if (!batch) return missing();
  await applyPlanEdits(batch.id, await req.json().catch(() => null));
  return NextResponse.json({ batch: await batchView(batch) });
}

/** Delete the batch: stops its Manus tasks and removes its images. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const batch = await loadBatch(access.ownerId, (await params).batchId);
  if (!batch) return missing();
  await deleteBatch(batch);
  return NextResponse.json({ ok: true });
}
