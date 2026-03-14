import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { documentLinks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { linkId } = await params;
  const body = await req.json();

  // Verify ownership
  const [link] = await db
    .select()
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.id, linkId),
        eq(documentLinks.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (body.status && ["active", "expired", "revoked"].includes(body.status)) {
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  await db
    .update(documentLinks)
    .set(updates)
    .where(eq(documentLinks.id, linkId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { linkId } = await params;

  const [link] = await db
    .select()
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.id, linkId),
        eq(documentLinks.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(documentLinks).where(eq(documentLinks.id, linkId));

  return NextResponse.json({ ok: true });
}
