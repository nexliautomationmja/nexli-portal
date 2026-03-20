import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { taxOrganizers, taxOrganizerSections } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";
import { getSectionKeys } from "@/lib/tax-organizer-questions";

export async function GET(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.email;
  const ownerId = session.ownerId;

  const whereClause = ownerId
    ? and(eq(taxOrganizers.clientEmail, email), eq(taxOrganizers.ownerId, ownerId))
    : eq(taxOrganizers.clientEmail, email);

  const rows = await db
    .select()
    .from(taxOrganizers)
    .where(whereClause)
    .orderBy(desc(taxOrganizers.createdAt));

  // Filter to only sent/in_progress/completed (not drafts)
  const visible = rows.filter((r) => r.status !== "draft");

  const organizers = await Promise.all(
    visible.map(async (org) => {
      const sections = await db
        .select()
        .from(taxOrganizerSections)
        .where(eq(taxOrganizerSections.organizerId, org.id));
      const totalSections = getSectionKeys(
        org.returnType as "1040" | "1120" | "1120S" | "1065" | "1041"
      ).length;
      const completedSections = sections.filter((s) => s.isComplete).length;
      return {
        id: org.id,
        taxYear: org.taxYear,
        returnType: org.returnType,
        status: org.status,
        sentAt: org.sentAt,
        startedAt: org.startedAt,
        completedAt: org.completedAt,
        expiresAt: org.expiresAt,
        totalSections,
        completedSections,
      };
    })
  );

  return NextResponse.json({ organizers });
}
