import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { requireAdsAdmin } from "@/lib/ads/access";
import { adGrades } from "@/lib/ads/tables";
import { advanceGrade, deleteGrade, linkGrade, retryGrade } from "@/lib/ads/grader";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * One grade. POST { action: "run" } carries it as far as this request allows
 * (watch → read → grade; the page calls again until it's done).
 * POST { action: "retry" } after a failure. POST { action: "link", adIds } ties it to
 * the live Meta ad(s) it became ({ adIds: [] } unlinks). DELETE removes it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected." }, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await db.select({ id: adGrades.id, status: adGrades.status }).from(adGrades).where(and(eq(adGrades.id, id), eq(adGrades.ownerId, access.ownerId), eq(adGrades.accountId, access.accountId))).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (body?.action === "run") {
    const after = await advanceGrade(id, Date.now() + 270_000);
    return NextResponse.json({ status: after?.status ?? row.status, error: after?.error ?? null });
  }
  if (body?.action === "retry") {
    return (await retryGrade(access.ownerId, id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Only a failed grade can be retried." }, { status: 409 });
  }
  if (body?.action === "link") {
    const adIds = Array.isArray(body.adIds) ? body.adIds.filter((x): x is string => typeof x === "string") : [];
    return (await linkGrade(access.ownerId, access.accountId, id, adIds)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Couldn't link it." }, { status: 400 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  const { id } = await params;
  return (await deleteGrade(access.ownerId, id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
