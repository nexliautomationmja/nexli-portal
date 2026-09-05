import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { pipelineLeads } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { ensurePipelineTable, MAX_VALUE_CENTS } from "@/lib/pipeline-table";

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

// PATCH — update stage / value / name / notes on one of the owner's leads.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { leadId } = await params;
  await ensurePipelineTable();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updates: Partial<typeof pipelineLeads.$inferInsert> = {};

  if (body.stage !== undefined) {
    if (body.stage !== "open" && body.stage !== "won" && body.stage !== "lost") {
      return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
    }
    updates.stage = body.stage;
  }
  if (body.valueCents !== undefined) {
    const v = Number(body.valueCents);
    if (!Number.isInteger(v) || v < 0 || v > MAX_VALUE_CENTS) {
      return NextResponse.json(
        { error: "Deal value must be between $0 and $20,000,000." },
        { status: 400 }
      );
    }
    updates.valueCents = v;
  }
  if (body.name !== undefined) {
    const name = str(body.name, 200);
    if (!name) {
      return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    }
    updates.name = name;
  }
  if (body.notes !== undefined) {
    updates.notes = str(body.notes, 2000) || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const [lead] = await db
    .update(pipelineLeads)
    .set({ ...updates, updatedAt: new Date() })
    .where(
      and(
        eq(pipelineLeads.id, leadId),
        eq(pipelineLeads.ownerId, session.user.id),
        isNull(pipelineLeads.deletedAt)
      )
    )
    .returning();
  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

// DELETE — remove one of the owner's leads. Booked-call leads are
// soft-deleted (tombstone) so the GHL sync never re-imports them; manual
// leads are removed outright.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { leadId } = await params;
  await ensurePipelineTable();

  const scope = and(
    eq(pipelineLeads.id, leadId),
    eq(pipelineLeads.ownerId, session.user.id)
  );
  const [lead] = await db
    .select({ ghlContactId: pipelineLeads.ghlContactId })
    .from(pipelineLeads)
    .where(scope)
    .limit(1);
  if (!lead) return NextResponse.json({ ok: true });

  if (lead.ghlContactId) {
    await db
      .update(pipelineLeads)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(scope);
  } else {
    await db.delete(pipelineLeads).where(scope);
  }
  return NextResponse.json({ ok: true });
}
