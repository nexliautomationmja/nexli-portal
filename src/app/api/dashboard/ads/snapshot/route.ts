import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { buildAdsSnapshot } from "@/lib/ads/snapshot";
import { getSettings } from "@/lib/ads/settings";
import { parseAdsRange } from "@/lib/ads/types";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** The Ads tab's numbers for a range: GET ?range=7|14|30|90&refresh=1. */
export async function GET(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  const range = parseAdsRange(req.nextUrl.searchParams.get("range"));
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const settings = await getSettings(access.ownerId, access.accountId).catch(() => null);
  try {
    const result = await buildAdsSnapshot({
      ownerId: access.ownerId,
      accountId: access.accountId,
      range,
      refresh,
      targets: { cpbCents: settings?.targetCpbCents ?? null, monthlyBudgetCents: settings?.monthlyBudgetCents ?? null },
      budgetMs: 90_000,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ads] snapshot failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't load the ad account right now. Try again in a minute." }, { status: 502 });
  }
}
