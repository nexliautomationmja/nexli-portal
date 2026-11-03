import { NextRequest, NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { batchSummary, loadBatch } from "@/lib/creative-studio/batch-service";

type Ctx = { params: Promise<{ batchId: string }> };

/** Where every video in the batch is (polled by the batch page). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const batch = await loadBatch(access.ownerId, (await params).batchId);
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  return NextResponse.json(await batchSummary(batch));
}
