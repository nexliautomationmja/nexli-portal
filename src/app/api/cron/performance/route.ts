import { NextRequest, NextResponse } from "next/server";
import { prepareStatements } from "@/lib/performance/service";

// Reads each client's CRM and Meta: give it room.
export const maxDuration = 300;

// Daily (vercel.json → 11:00 UTC). Performance Pay on the Nov 19 2026
// pricing: for every client on it, refresh its ad leads, open a draft
// statement for each billing month that has ended, and tell Marcel when a
// month has money collected from ad-sourced clients to review. It never
// invoices anyone: he presses Send on the client's Client Tracker page.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await prepareStatements(new Date());
  return NextResponse.json({ ok: true, ...result });
}
