import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagements, engagementSigners } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { engagementId } = await params;

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(
      and(
        eq(engagements.id, engagementId),
        eq(engagements.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signers = await db
    .select()
    .from(engagementSigners)
    .where(eq(engagementSigners.engagementId, engagementId))
    .orderBy(engagementSigners.order);

  return NextResponse.json({ ...engagement, signers });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { engagementId } = await params;
  const body = await req.json();

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(
      and(
        eq(engagements.id, engagementId),
        eq(engagements.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "void") {
    await db
      .update(engagements)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(engagements.id, engagementId));

    // Also void all signers
    await db
      .update(engagementSigners)
      .set({ status: "expired" })
      .where(eq(engagementSigners.engagementId, engagementId));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { engagementId } = await params;

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(
      and(
        eq(engagements.id, engagementId),
        eq(engagements.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Signers cascade-deleted via FK
  await db.delete(engagements).where(eq(engagements.id, engagementId));

  return NextResponse.json({ ok: true });
}
