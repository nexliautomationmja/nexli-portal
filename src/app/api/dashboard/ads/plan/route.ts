import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { latestPlan, makeDailyPlan, markPlanSeen, planDateFor, planView } from "@/lib/ads/daily-plan";
import { loadTags } from "@/lib/ads/creative-ai";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** GET → the newest daily plan (with what to make) and each creative's type. */
export async function GET() {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  const [row, today, tags] = await Promise.all([
    latestPlan(access.ownerId, access.accountId),
    planDateFor(access.ownerId, access.accountId),
    loadTags(access.ownerId, access.accountId).catch(() => ({})),
  ]);
  return NextResponse.json({ configured: true, today, plan: row ? planView(row) : null, tags });
}

/**
 * POST { action: "make" } → make today's plan now (when the morning run
 * hasn't yet, or failed). POST { action: "seen", id } → clears the badge.
 */
export async function POST(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected." }, { status: 400 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { action?: string; id?: string };
  if (body.action === "seen" && typeof body.id === "string") {
    await markPlanSeen(access.ownerId, body.id);
    return NextResponse.json({ ok: true });
  }
  if (body.action !== "make") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const made = await makeDailyPlan(access.ownerId, access.accountId, { deadline: Date.now() + 270_000 });
  const row = made ?? (await latestPlan(access.ownerId, access.accountId));
  const tags = await loadTags(access.ownerId, access.accountId).catch(() => ({}));
  if (row?.status === "failed") return NextResponse.json({ plan: planView(row), tags, error: row.error ?? "Couldn't make today's plan." }, { status: 502 });
  return NextResponse.json({ plan: row ? planView(row) : null, tags, busy: !made && row?.status === "making" });
}
