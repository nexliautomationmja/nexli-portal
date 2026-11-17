import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { actOnChange, type ChangeAction } from "@/lib/ads/corrections";

type Ctx = { params: Promise<{ id: string }> };

/** POST { action: "apply" | "dismiss" | "undo" } → only Marcel's tap changes anything. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected." }, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { action?: unknown };
  const action = body.action === "apply" || body.action === "dismiss" || body.action === "undo" ? (body.action as ChangeAction) : null;
  if (!action) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const r = await actOnChange({ ownerId: access.ownerId, accountId: access.accountId, actorId: access.actorId, id, action });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ change: r.change, goalsChanged: r.goalsChanged });
}
