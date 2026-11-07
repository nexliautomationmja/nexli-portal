import { NextRequest, NextResponse } from "next/server";
import { mercuryConfigured, syncMercury } from "@/lib/mercury";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Every 10 minutes: read new money in Nexli's Mercury account and mark the
 * up-front invoices it pays as paid (lib/mercury.ts). Also keeps the read-only
 * token in use — Mercury deletes tokens unused for 45 days.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!mercuryConfigured()) return NextResponse.json({ skipped: "MERCURY_API_TOKEN isn't set" });
  try {
    return NextResponse.json(await syncMercury());
  } catch (err) {
    console.error("[cron/mercury-sync] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Mercury sync failed" }, { status: 500 });
  }
}
