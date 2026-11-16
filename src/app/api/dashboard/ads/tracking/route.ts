import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { loadTrackingData } from "@/lib/ads/tracking-data";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** GET → Meta vs the CRM: the last 14 days (cached 30 min) and today so far (cached 2 min). ?refresh=1 re-reads the 14 days. */
export async function GET(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  try {
    const data = await loadTrackingData(access.ownerId, access.accountId, { refresh: req.nextUrl.searchParams.get("refresh") === "1" });
    if (!data) return NextResponse.json({ configured: false });
    return NextResponse.json({ configured: true, data });
  } catch (err) {
    console.error("[ads] tracking check failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't check tracking right now." }, { status: 502 });
  }
}
