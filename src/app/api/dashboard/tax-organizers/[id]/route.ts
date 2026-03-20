import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { taxOrganizers, taxOrganizerSections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptSectionData } from "@/lib/organizer-crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [organizer] = await db
    .select()
    .from(taxOrganizers)
    .where(
      and(eq(taxOrganizers.id, id), eq(taxOrganizers.ownerId, session.user.id))
    )
    .limit(1);

  if (!organizer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sections = await db
    .select()
    .from(taxOrganizerSections)
    .where(eq(taxOrganizerSections.organizerId, id));

  // Decrypt sensitive fields for CPA viewing
  const decryptedSections = sections.map((s) => ({
    ...s,
    data: decryptSectionData(s.data as Record<string, unknown>),
  }));

  return NextResponse.json({ organizer, sections: decryptedSections });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  const validStatuses = ["draft", "sent", "in_progress", "completed", "reviewed"] as const;
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (status) {
    updateData.status = status;
    if (status === "reviewed") updateData.reviewedAt = new Date();
  }

  const [updated] = await db
    .update(taxOrganizers)
    .set(updateData)
    .where(
      and(eq(taxOrganizers.id, id), eq(taxOrganizers.ownerId, session.user.id))
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ organizer: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(taxOrganizers)
    .where(
      and(eq(taxOrganizers.id, id), eq(taxOrganizers.ownerId, session.user.id))
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
