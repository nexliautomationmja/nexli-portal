import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clientWeeklyUpdates } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureClientSuccessTables, weekStartOf } from "@/lib/client-success-tables";
import { listClientWeeklyUpdates } from "@/lib/client-success";
import { ensurePortalMessageColumns } from "@/lib/portal-messages-table";
import {
  MAX_BODY,
  emailWeeklyUpdate,
  loadWeeklyUpdateClient as loadClient,
  parseAdSpend,
  parseHeadline,
  parseWeekStart,
  postTextWeeklyUpdateToThread,
} from "@/lib/weekly-update-thread";

/**
 * Admin composer for the weekly "here's what we did on your account" note.
 * One row per (client, week): save as draft, or send — which emails the
 * client, posts the note into their Nexli message thread, and surfaces it
 * on their dashboard Overview. Voice updates: ./voice/route.ts.
 */

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session.user.id;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { clientId } = await params;
  if (!(await loadClient(clientId))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const updates = await listClientWeeklyUpdates(clientId, 12);
  return NextResponse.json({ updates, currentWeekStart: weekStartOf(new Date()) });
}

// POST — upsert this week's note; action "draft" | "send"
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { clientId } = await params;
  const client = await loadClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const action = body.action === "send" ? "send" : body.action === "draft" ? "draft" : null;
  if (!action) {
    return NextResponse.json({ error: "action must be 'draft' or 'send'." }, { status: 400 });
  }
  const weekStart = parseWeekStart(body.weekStart);
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart must be YYYY-MM-DD." }, { status: 400 });
  }
  const text = typeof body.body === "string" ? body.body.trim().slice(0, MAX_BODY) : "";
  if (!text) {
    return NextResponse.json({ error: "Write the update before saving." }, { status: 400 });
  }
  const headline = parseHeadline(body.headline);
  const adSpendCents = parseAdSpend(body.adSpendCents);
  if (adSpendCents === undefined && body.adSpendCents !== undefined) {
    return NextResponse.json({ error: "Ad spend must be a positive number." }, { status: 400 });
  }

  await ensureClientSuccessTables();
  const now = new Date();
  const [existing] = await db
    .select({ id: clientWeeklyUpdates.id, status: clientWeeklyUpdates.status, sentAt: clientWeeklyUpdates.sentAt })
    .from(clientWeeklyUpdates)
    .where(and(eq(clientWeeklyUpdates.clientUserId, clientId), eq(clientWeeklyUpdates.weekStart, weekStart)))
    .limit(1);

  const sending = action === "send";
  // A note that already went out stays "sent" even if re-saved as a draft.
  const nextStatus = sending || existing?.status === "sent" ? "sent" : "draft";
  const values = {
    headline,
    body: text,
    adSpendCents: adSpendCents ?? null,
    authorId: adminId,
    status: nextStatus,
    sentAt: sending ? now : existing?.sentAt ?? null,
    updatedAt: now,
  };

  let update: typeof clientWeeklyUpdates.$inferSelect;
  if (existing) {
    [update] = await db
      .update(clientWeeklyUpdates)
      .set(values)
      .where(eq(clientWeeklyUpdates.id, existing.id))
      .returning();
  } else {
    [update] = await db
      .insert(clientWeeklyUpdates)
      .values({ clientUserId: clientId, weekStart, ...values })
      .returning();
  }

  let emailed = false;
  let emailError: string | null = null;
  if (sending) {
    await ensurePortalMessageColumns().catch((err) =>
      console.error("[weekly-update] portal_messages columns:", err)
    );
    await postTextWeeklyUpdateToThread({ update, client, senderAdminId: adminId });
    emailed = await emailWeeklyUpdate({ update, client, senderAdminId: adminId, now });
    if (!emailed) emailError = "Saved and marked sent, but the email couldn't be delivered.";
  }

  return NextResponse.json({
    ok: true,
    update,
    emailed,
    ...(emailError ? { warning: emailError } : {}),
  });
}

// PATCH — edit a draft in place
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { clientId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  await ensureClientSuccessTables();
  const [existing] = await db
    .select({ id: clientWeeklyUpdates.id, status: clientWeeklyUpdates.status })
    .from(clientWeeklyUpdates)
    .where(and(eq(clientWeeklyUpdates.id, id), eq(clientWeeklyUpdates.clientUserId, clientId)))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.status === "sent") {
    return NextResponse.json(
      { error: "This update was already sent. Save a new one for the week instead." },
      { status: 409 }
    );
  }

  const set: Partial<typeof clientWeeklyUpdates.$inferInsert> = { updatedAt: new Date() };
  if ("headline" in body) {
    set.headline = parseHeadline(body.headline);
  }
  if ("body" in body) {
    const text = typeof body.body === "string" ? body.body.trim().slice(0, MAX_BODY) : "";
    if (!text) {
      return NextResponse.json({ error: "The update can't be empty." }, { status: 400 });
    }
    set.body = text;
  }
  if ("adSpendCents" in body) {
    const cents = parseAdSpend(body.adSpendCents);
    if (cents === undefined) {
      return NextResponse.json({ error: "Ad spend must be a positive number." }, { status: 400 });
    }
    set.adSpendCents = cents;
  }

  const [update] = await db
    .update(clientWeeklyUpdates)
    .set(set)
    .where(eq(clientWeeklyUpdates.id, id))
    .returning();
  return NextResponse.json({ ok: true, update });
}
