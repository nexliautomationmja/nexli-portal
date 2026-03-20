import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { taxOrganizers, taxOrganizerSections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";
import { getSectionsForReturnType } from "@/lib/tax-organizer-questions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const email = session.email;
  const ownerId = session.ownerId;

  const whereClause = ownerId
    ? and(
        eq(taxOrganizers.id, id),
        eq(taxOrganizers.clientEmail, email),
        eq(taxOrganizers.ownerId, ownerId)
      )
    : and(eq(taxOrganizers.id, id), eq(taxOrganizers.clientEmail, email));

  const [organizer] = await db
    .select()
    .from(taxOrganizers)
    .where(whereClause)
    .limit(1);

  if (!organizer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Mark as in_progress if first access
  if (organizer.status === "sent") {
    await db
      .update(taxOrganizers)
      .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(taxOrganizers.id, id));
    organizer.status = "in_progress";
  }

  const sections = await db
    .select()
    .from(taxOrganizerSections)
    .where(eq(taxOrganizerSections.organizerId, id));

  // Don't decrypt — portal client doesn't need to see encrypted values as raw text
  // They see their own input which is pre-populated from the saved (encrypted) data
  // Decryption happens only on CPA side

  const questionDefs = getSectionsForReturnType(
    organizer.returnType as "1040" | "1120" | "1120S" | "1065" | "1041"
  );

  return NextResponse.json({
    organizer: {
      id: organizer.id,
      clientName: organizer.clientName,
      taxYear: organizer.taxYear,
      returnType: organizer.returnType,
      status: organizer.status,
      message: organizer.message,
      generatedDocuments: organizer.generatedDocuments,
      expiresAt: organizer.expiresAt,
    },
    sections: sections.map((s) => ({
      id: s.id,
      sectionKey: s.sectionKey,
      data: s.data,
      isComplete: s.isComplete,
    })),
    questionDefs,
  });
}
