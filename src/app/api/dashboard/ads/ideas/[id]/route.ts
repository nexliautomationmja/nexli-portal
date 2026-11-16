import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { linkProjects, markLive } from "@/lib/ads/ideas";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH { projectIds, batchId? } → the Creative Studio videos made from the ideas.
 * PATCH { action: "live" | "not_live", projectId } → Marcel uploaded it to Meta (it leaves the deck).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  const { id } = await params;
  const body = ((await req.json().catch(() => null)) ?? {}) as { projectIds?: unknown; batchId?: unknown; action?: unknown; projectId?: unknown };
  if ((body.action === "live" || body.action === "not_live") && typeof body.projectId === "string") {
    const ok = await markLive(access.ownerId, id, body.projectId, body.action === "live");
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "That video isn't on deck." }, { status: 404 });
  }
  if (!Array.isArray(body.projectIds)) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  const batchId = typeof body.batchId === "string" && /^[0-9a-f-]{36}$/i.test(body.batchId) ? body.batchId : null;
  const set = await linkProjects(access.ownerId, id, body.projectIds as (string | null)[], batchId);
  return set ? NextResponse.json({ set }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
