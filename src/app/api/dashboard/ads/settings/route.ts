import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { requireAdsAdmin } from "@/lib/ads/access";
import { adSettings } from "@/lib/ads/tables";
import { getSettings, settingsPatch, settingsView } from "@/lib/ads/settings";

/** Goals and preferences for the ad account. */
export async function GET() {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  return NextResponse.json({ configured: true, settings: settingsView(await getSettings(access.ownerId, access.accountId)) });
}

/** PUT { targetCostPerBookedUsd?, targetCplUsd?, monthlyBudgetUsd?, maxCacUsd?, context?, weeklyAuto?, agentProfile?, notifyEmail? } */
export async function PUT(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  await getSettings(access.ownerId, access.accountId);
  const patch = settingsPatch(body);
  if (Object.keys(patch).length) {
    await db
      .update(adSettings)
      .set({ ...patch, updatedBy: access.actorId, updatedAt: new Date() })
      .where(and(eq(adSettings.ownerId, access.ownerId), eq(adSettings.accountId, access.accountId)));
  }
  return NextResponse.json({ settings: settingsView(await getSettings(access.ownerId, access.accountId)) });
}
