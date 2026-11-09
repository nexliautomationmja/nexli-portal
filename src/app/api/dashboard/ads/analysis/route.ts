import { NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { advanceAnalysis, analysisState, analysisView, enqueueAnalysis } from "@/lib/ads/analysis-service";
import { researchState } from "@/lib/ads/research-service";
import { getSettings, settingsView } from "@/lib/ads/settings";
import { cachedTimezone } from "@/lib/ads/snapshot";
import { nextWeeklyAt, weekKey } from "@/lib/ads/time";
import { manusConfigured } from "@/lib/creative-studio/manus";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Manus's side of the Ads tab: the run in flight, the latest analysis, its next steps, history, goals. */
export async function GET() {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  const [state, research, settings, tz] = await Promise.all([
    analysisState(access.ownerId, access.accountId),
    researchState(access.ownerId, access.accountId),
    getSettings(access.ownerId, access.accountId),
    cachedTimezone(access.ownerId, access.accountId).catch(() => "America/Chicago"),
  ]);
  const view = settingsView(settings);
  // The next Monday run — skipping this week when it's already been claimed (or the feature just arrived).
  let next = nextWeeklyAt(new Date(), tz);
  const thisWeek = weekKey(new Date(), tz);
  if (weekKey(next, tz) === thisWeek && (!settings.lastWeeklyKey || settings.lastWeeklyKey === thisWeek)) next = new Date(next.getTime() + 7 * 86400000);
  return NextResponse.json({
    configured: true,
    manus: {
      configured: manusConfigured(),
      connector: view.connector?.id ? { id: view.connector.id, name: view.connector.name } : null,
      libraryConnector: view.libraryConnector?.id ? { id: view.libraryConnector.id, name: view.libraryConnector.name } : null,
    },
    ...state,
    research,
    settings: view,
    timezone: tz,
    nextWeeklyAt: view.weeklyAuto ? next.toISOString() : null,
  });
}

/** Analyze now: queue a run and get it started (data pack + Manus). */
export async function POST() {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected yet." }, { status: 400 });
  if (!manusConfigured()) return NextResponse.json({ error: "Manus isn't connected yet. Add MANUS_API_KEY in Vercel." }, { status: 400 });
  const settings = await getSettings(access.ownerId, access.accountId);
  const { row, created } = await enqueueAnalysis({ ownerId: access.ownerId, accountId: access.accountId, trigger: "manual", startedBy: access.actorId, agentProfile: settings.agentProfile });
  if (!created) return NextResponse.json({ error: "An analysis is already running.", active: analysisView(row) }, { status: 409 });
  try {
    const advanced = await advanceAnalysis(row, { deadline: Date.now() + 270_000 });
    return NextResponse.json({ active: analysisView(advanced) });
  } catch (err) {
    console.error("[ads] analyze now failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ active: analysisView(row) });
  }
}
