/**
 * POST /api/internal/subscription-status
 *
 * Called by the marketing app's Stripe webhook on subscription lifecycle
 * events (updated / deleted / payment failed). Guarded by `x-provision-secret`.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { checkProvisionSecret } from "@/lib/provision-firm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = checkProvisionSecret(req.headers.get("x-provision-secret"));
  if (guard === "unconfigured") {
    return NextResponse.json(
      { error: "Provisioning is not configured" },
      { status: 503 }
    );
  }
  if (guard === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stripeSubscriptionId =
    typeof body?.stripeSubscriptionId === "string"
      ? body.stripeSubscriptionId.trim()
      : "";
  const stripeCustomerId =
    typeof body?.stripeCustomerId === "string" ? body.stripeCustomerId.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const currentPeriodEndRaw =
    typeof body?.currentPeriodEnd === "string" ? body.currentPeriodEnd : undefined;

  const details: string[] = [];
  if (!stripeSubscriptionId) details.push("stripeSubscriptionId is required");
  if (!status) details.push("status is required");
  let currentPeriodEnd: Date | undefined;
  if (currentPeriodEndRaw !== undefined) {
    const d = new Date(currentPeriodEndRaw);
    if (Number.isNaN(d.getTime())) {
      details.push("currentPeriodEnd must be an ISO date string");
    } else {
      currentPeriodEnd = d;
    }
  }
  if (details.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details },
      { status: 400 }
    );
  }

  try {
    const patch: Partial<typeof users.$inferInsert> = {
      subscriptionStatus: status,
      updatedAt: new Date(),
    };
    if (currentPeriodEnd) patch.subscriptionCurrentPeriodEnd = currentPeriodEnd;

    let rows = await db
      .update(users)
      .set(patch)
      .where(eq(users.stripeSubscriptionId, stripeSubscriptionId))
      .returning({ id: users.id });

    if (rows.length === 0 && stripeCustomerId) {
      // Fallback: match on customer and attach the subscription id.
      rows = await db
        .update(users)
        .set({ ...patch, stripeSubscriptionId })
        .where(eq(users.stripeCustomerId, stripeCustomerId))
        .returning({ id: users.id });
    }

    return NextResponse.json({ ok: true, updated: rows.length > 0 });
  } catch (err) {
    console.error("[internal/subscription-status] unexpected error:", err);
    return NextResponse.json(
      {
        error: "Update failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
