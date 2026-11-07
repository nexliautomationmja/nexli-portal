import { NextResponse } from "next/server";
import { mercuryConfigured, mercuryStatus, syncMercury } from "@/lib/mercury";
import { requireNexliAdmin } from "@/lib/mercury-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The Mercury chip on the Invoices page: connection status + the review list. */
export async function GET() {
  const access = await requireNexliAdmin();
  if (!access.ok) return access.response;
  return NextResponse.json(await mercuryStatus());
}

/** "Check now": run the sync immediately. */
export async function POST() {
  const access = await requireNexliAdmin();
  if (!access.ok) return access.response;
  if (!mercuryConfigured()) return NextResponse.json({ error: "Mercury isn't connected: add MERCURY_API_TOKEN in Vercel." }, { status: 400 });
  try {
    const result = await syncMercury();
    return NextResponse.json({ ...(await mercuryStatus()), result });
  } catch (err) {
    return NextResponse.json({ ...(await mercuryStatus()), error: err instanceof Error ? err.message : "Mercury sync failed" }, { status: 502 });
  }
}
