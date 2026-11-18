import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { actOnChange, proposeChange } from "@/lib/ads/corrections";
import { metaStructure } from "@/lib/ads/base-cache";
import { planStatus } from "@/lib/ads/meta-changes-shared";
import { META_SETUP_STEPS, metaWriteAccess, metaWriteConfigured } from "@/lib/ads/meta-write";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET → can the page change Meta? (?refresh=1 re-checks the token now) */
export async function GET(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false, canWrite: false, problems: [], notes: [], steps: META_SETUP_STEPS });
  const check = await metaWriteAccess(access.ownerId, access.accountId, req.nextUrl.searchParams.get("refresh") === "1").catch((err) => {
    console.error("[ads] Meta write check failed:", err instanceof Error ? err.message : err);
    return { configured: metaWriteConfigured(), canWrite: metaWriteConfigured(), problems: [], notes: ["Couldn't check the token just now."], checkedAt: new Date().toISOString() };
  });
  return NextResponse.json({ ...check, steps: META_SETUP_STEPS });
}

/**
 * POST { action: "off", adIds: string[], reason?: string } → the Turn off
 * buttons on Today's plan. Marcel's tap (and its confirm) is the Apply: the
 * change is recorded like any other, so it shows in "Your changes" with Undo.
 */
export async function POST(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected." }, { status: 400 });
  if (!metaWriteConfigured()) return NextResponse.json({ error: "Changes in Meta aren't switched on yet." }, { status: 400 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { action?: unknown; adIds?: unknown; reason?: unknown };
  if (body.action !== "off") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const adIds = Array.isArray(body.adIds) ? body.adIds.filter((x): x is string => typeof x === "string" && /^\d{3,30}$/.test(x)).slice(0, 10) : [];
  if (!adIds.length) return NextResponse.json({ error: "No ads given." }, { status: 400 });

  const st = await metaStructure(access.ownerId, access.accountId);
  if (!st) return NextResponse.json({ error: "The account's ads aren't loaded yet — reload the page." }, { status: 409 });
  const plan = planStatus(st, { to: "PAUSED", targets: adIds.map((id) => ({ level: "ad" as const, ref: id })), from: "plan" });
  if ("error" in plan) return NextResponse.json({ error: plan.error }, { status: 409 });
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  const change = await proposeChange({
    ownerId: access.ownerId,
    accountId: access.accountId,
    chatId: null,
    actorId: access.actorId,
    kind: "meta_status",
    adId: plan.adId,
    payload: plan.payload,
    summary: plan.summary,
    reason: reason || "Cut on Today's plan",
  });
  const r = await actOnChange({ ownerId: access.ownerId, accountId: access.accountId, actorId: access.actorId, id: change.id, action: "apply" });
  if (!r.ok) {
    // Nothing changed in Meta: drop the card so it doesn't sit there waiting.
    await actOnChange({ ownerId: access.ownerId, accountId: access.accountId, actorId: access.actorId, id: change.id, action: "dismiss" }).catch(() => null);
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ change: r.change, warning: r.warning ?? null });
}
