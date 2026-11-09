import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { loadAnalysis } from "@/lib/ads/analysis-service";

type Ctx = { params: Promise<{ id: string }> };

/** Download exactly what Manus was given for this analysis. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  const row = await loadAnalysis(access.ownerId, (await params).id);
  const pack = (row?.dataPack as { pack?: unknown } | null)?.pack;
  if (!row || !pack) return NextResponse.json({ error: "No data pack for this analysis (packs are kept 12 weeks)." }, { status: 404 });
  return new NextResponse(JSON.stringify(pack, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexli-ads-${row.kind === "research" ? "research" : "data"}-${row.throughDate ?? row.id}.json"`,
    },
  });
}
