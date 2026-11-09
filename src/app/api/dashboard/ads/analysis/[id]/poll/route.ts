import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { advanceAnalysis, analysisView, loadAnalysis } from "@/lib/ads/analysis-service";
import { ManusError } from "@/lib/creative-studio/manus";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** Move a run along (the page calls this every few seconds while Manus works). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  const row = await loadAnalysis(access.ownerId, (await params).id);
  if (!row) return NextResponse.json({ error: "That analysis wasn't found" }, { status: 404 });
  try {
    const next = await advanceAnalysis(row, { deadline: Date.now() + 100_000 });
    return NextResponse.json({ analysis: analysisView(next) });
  } catch (err) {
    if (err instanceof ManusError) return NextResponse.json({ error: err.message, analysis: analysisView(row) }, { status: 400 });
    console.error("[ads] poll failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ analysis: analysisView(row) });
  }
}
