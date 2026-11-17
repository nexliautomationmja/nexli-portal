import { NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { listChanges } from "@/lib/ads/corrections";

export const dynamic = "force-dynamic";

/** GET → Marcel's corrections: cards waiting for Apply, applied and undone ones. */
export async function GET() {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  return NextResponse.json({ configured: true, changes: await listChanges(access.ownerId, access.accountId) });
}
