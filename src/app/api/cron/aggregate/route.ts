import { NextRequest, NextResponse } from "next/server";
import { aggregateDailyStats } from "@/lib/aggregate-stats";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await aggregateDailyStats(); // today
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await aggregateDailyStats(yesterday);

  return NextResponse.json({ ok: true });
}
