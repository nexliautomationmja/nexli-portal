import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { requireAdsAdmin } from "@/lib/ads/access";
import { adSteps } from "@/lib/ads/tables";
import { stepView } from "@/lib/ads/analysis-service";
import { cachedStructure, cachedTimezone } from "@/lib/ads/snapshot";
import { checkBackAt } from "@/lib/ads/time";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Work a next step: PATCH { status?: "done" | "skipped" | "open", snoozeDays?: 1|3|7,
 * skippedReason?, note?, selfOutcome?: "better"|"same"|"worse", checked?: true,
 * handoff?: "photos" | "videos" }.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Step not found" }, { status: 404 });
  const [step] = await db.select().from(adSteps).where(and(eq(adSteps.id, id), eq(adSteps.ownerId, access.ownerId))).limit(1);
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  const patch: Partial<typeof adSteps.$inferInsert> = { updatedAt: new Date() };
  if (body.status === "done") Object.assign(patch, { status: "done", doneAt: new Date(), doneBy: access.actorId });
  else if (body.status === "skipped") Object.assign(patch, { status: "skipped", skippedReason: typeof body.skippedReason === "string" ? body.skippedReason.slice(0, 500) : null });
  else if (body.status === "open") Object.assign(patch, { status: "open", doneAt: null, doneBy: null, skippedReason: null });
  if (typeof body.note === "string") patch.note = body.note.slice(0, 1000) || null;
  if (body.selfOutcome === "better" || body.selfOutcome === "same" || body.selfOutcome === "worse") Object.assign(patch, { selfOutcome: body.selfOutcome, checkedAt: new Date() });
  if (body.checked === true) patch.checkedAt = new Date();
  if (body.snoozeDays === 1 || body.snoozeDays === 3 || body.snoozeDays === 7) {
    const tz = await cachedTimezone(access.ownerId, step.accountId);
    Object.assign(patch, { checkBackAt: checkBackAt(new Date(), body.snoozeDays, tz), remindSentAt: null, checkedAt: null });
  }
  if (body.handoff === "photos" || body.handoff === "videos") patch.handoff = { kind: body.handoff, at: new Date().toISOString() };

  const [updated] = await db.update(adSteps).set(patch).where(eq(adSteps.id, id)).returning();
  const now = await cachedStructure(access.ownerId, step.accountId).catch(() => null);
  return NextResponse.json({ step: stepView(updated, step.accountId, now) });
}
