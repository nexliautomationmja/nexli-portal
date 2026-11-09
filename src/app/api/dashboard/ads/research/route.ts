import { NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { advanceAnalysis, analysisView, enqueueAnalysis } from "@/lib/ads/analysis-service";
import { getSettings } from "@/lib/ads/settings";
import { manusConfigured } from "@/lib/creative-studio/manus";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Research the Ad Library now: queue a research run and get it started (pack + Manus). */
export async function POST() {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected yet." }, { status: 400 });
  if (!manusConfigured()) return NextResponse.json({ error: "Manus isn't connected yet. Add MANUS_API_KEY in Vercel." }, { status: 400 });
  const settings = await getSettings(access.ownerId, access.accountId);
  const { row, created } = await enqueueAnalysis({ ownerId: access.ownerId, accountId: access.accountId, kind: "research", trigger: "manual", startedBy: access.actorId, agentProfile: settings.agentProfile });
  if (!created) return NextResponse.json({ error: "Research is already running.", active: analysisView(row) }, { status: 409 });
  try {
    const advanced = await advanceAnalysis(row, { deadline: Date.now() + 270_000 });
    return NextResponse.json({ active: analysisView(advanced) });
  } catch (err) {
    console.error("[ads] research start failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ active: analysisView(row) });
  }
}
