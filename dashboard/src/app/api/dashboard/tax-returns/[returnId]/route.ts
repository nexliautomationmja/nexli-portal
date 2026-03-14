import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { taxReturns } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { returnId } = await params;

  const [taxReturn] = await db
    .select()
    .from(taxReturns)
    .where(
      and(eq(taxReturns.id, returnId), eq(taxReturns.ownerId, session.user.id))
    )
    .limit(1);

  if (!taxReturn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ taxReturn });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { returnId } = await params;

  const [taxReturn] = await db
    .select()
    .from(taxReturns)
    .where(
      and(eq(taxReturns.id, returnId), eq(taxReturns.ownerId, session.user.id))
    )
    .limit(1);

  if (!taxReturn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  type TaxReturnStatus = "not_started" | "documents_received" | "in_progress" | "filed" | "accepted";
  const validStatuses: TaxReturnStatus[] = [
    "not_started", "documents_received", "in_progress", "filed", "accepted",
  ];

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  // Status update
  if (body.status && validStatuses.includes(body.status)) {
    updates.status = body.status;

    // Auto-set timestamps when moving to certain stages
    if (body.status === "filed" && !taxReturn.filedDate) {
      updates.filedDate = new Date();
    }
    if (body.status === "accepted" && !taxReturn.acceptedDate) {
      updates.acceptedDate = new Date();
    }
    // Clear timestamps if moving backwards
    if (body.status !== "filed" && body.status !== "accepted") {
      updates.filedDate = null;
      updates.acceptedDate = null;
    }
    if (body.status === "filed") {
      updates.acceptedDate = null;
    }
  }

  // Field updates
  if (body.clientName !== undefined) updates.clientName = body.clientName;
  if (body.clientEmail !== undefined) updates.clientEmail = body.clientEmail;
  if (body.clientCompany !== undefined) updates.clientCompany = body.clientCompany || null;
  if (body.taxYear !== undefined) updates.taxYear = body.taxYear;
  if (body.notes !== undefined) updates.notes = body.notes || null;
  if (body.dueDate !== undefined) {
    updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (body.returnType !== undefined) {
    type ReturnType = "1040" | "1120" | "1120S" | "1065" | "990" | "other";
    const validReturnTypes: ReturnType[] = ["1040", "1120", "1120S", "1065", "990", "other"];
    if (validReturnTypes.includes(body.returnType as ReturnType)) {
      updates.returnType = body.returnType;
    }
  }

  const [updated] = await db
    .update(taxReturns)
    .set(updates)
    .where(eq(taxReturns.id, returnId))
    .returning();

  return NextResponse.json({ taxReturn: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { returnId } = await params;

  const [taxReturn] = await db
    .select()
    .from(taxReturns)
    .where(
      and(eq(taxReturns.id, returnId), eq(taxReturns.ownerId, session.user.id))
    )
    .limit(1);

  if (!taxReturn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(taxReturns).where(eq(taxReturns.id, returnId));

  return NextResponse.json({ ok: true });
}
