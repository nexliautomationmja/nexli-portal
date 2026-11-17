import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { vslBoardFor } from "@/lib/ads/vsl";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** GET → the VSL scoreboard (cached 15 min; ?refresh=1 re-reads GoHighLevel and Meta). */
export async function GET(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  try {
    const board = await vslBoardFor(access.ownerId, access.accountId, { refresh: req.nextUrl.searchParams.get("refresh") === "1" });
    return NextResponse.json({ configured: Boolean(board), board });
  } catch (err) {
    console.error("[ads] VSL board failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't load the VSL scoreboard right now." }, { status: 502 });
  }
}
