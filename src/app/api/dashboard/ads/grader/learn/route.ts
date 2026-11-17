import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { advanceBacktest, advanceLearn, planLearn, startBacktest } from "@/lib/ads/grader";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Teaching the grader the account, and checking it.
 * POST { action: "start" } → queue past videos to watch (and watch the first few).
 * POST { action: "step" } → watch more (the page calls again until none are left; the cron carries on otherwise).
 * POST { action: "backtest" } → grade the past videos blind; { action: "backtest_step" } carries it on.
 */
export async function POST(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const deadline = Date.now() + 270_000;
  try {
    if (body?.action === "start") {
      const planned = await planLearn(access.ownerId, access.accountId, access.actorId);
      if (!planned.total) return NextResponse.json({ error: "None of your video ads has spent enough in the last 90 days to learn from yet." }, { status: 400 });
      return NextResponse.json({ ...planned, ...(await advanceLearn(access.ownerId, access.accountId, deadline)) });
    }
    if (body?.action === "step") return NextResponse.json(await advanceLearn(access.ownerId, access.accountId, deadline));
    if (body?.action === "backtest") {
      const started = await startBacktest(access.ownerId, access.accountId, access.actorId);
      return NextResponse.json({ ...started, ...((await advanceBacktest(access.ownerId, access.accountId, deadline)) ?? {}) });
    }
    if (body?.action === "backtest_step") return NextResponse.json((await advanceBacktest(access.ownerId, access.accountId, deadline)) ?? { left: 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ads grader] learn route:", msg);
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 400 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
