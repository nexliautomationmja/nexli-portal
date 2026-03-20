import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  taxOrganizers,
  taxOrganizerSections,
  users,
  documentLinks,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";
import { encryptSectionData } from "@/lib/organizer-crypto";
import { getSectionKeys } from "@/lib/tax-organizer-questions";
import {
  generateDocumentList,
  type GeneratedDocument,
} from "@/lib/organizer-doc-rules";
import { sendEmailWithLog, buildOrganizerCompletedEmail } from "@/lib/email";

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; sectionKey: string }> }
) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, sectionKey } = await params;
  const email = session.email;
  const ownerId = session.ownerId;

  // Verify organizer belongs to this client
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

  if (organizer.status === "completed" || organizer.status === "reviewed") {
    return NextResponse.json(
      { error: "Organizer already completed" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { data, isComplete } = body;

  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "data is required" }, { status: 400 });
  }

  // Encrypt sensitive fields before storage
  const encryptedData = encryptSectionData(data as Record<string, unknown>);

  // Upsert section
  const existing = await db
    .select()
    .from(taxOrganizerSections)
    .where(
      and(
        eq(taxOrganizerSections.organizerId, id),
        eq(taxOrganizerSections.sectionKey, sectionKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(taxOrganizerSections)
      .set({
        data: encryptedData,
        isComplete: isComplete ?? false,
        completedAt: isComplete ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(taxOrganizerSections.id, existing[0].id));
  } else {
    await db.insert(taxOrganizerSections).values({
      organizerId: id,
      sectionKey,
      data: encryptedData,
      isComplete: isComplete ?? false,
      completedAt: isComplete ? new Date() : null,
    });
  }

  // Check if all sections are complete
  const allSections = await db
    .select()
    .from(taxOrganizerSections)
    .where(eq(taxOrganizerSections.organizerId, id));

  const allKeys = getSectionKeys(
    organizer.returnType as "1040" | "1120" | "1120S" | "1065" | "1041"
  );
  const allComplete = allKeys.every((key) => {
    const section = allSections.find((s) => s.sectionKey === key);
    if (key === sectionKey) return isComplete ?? false;
    return section?.isComplete ?? false;
  });

  if (allComplete) {
    // Build all section data for document generation
    const sectionDataMap: Record<string, Record<string, unknown>> = {};
    for (const s of allSections) {
      sectionDataMap[s.sectionKey] = s.data as Record<string, unknown>;
    }
    // Include current save (might not be reflected in allSections yet)
    sectionDataMap[sectionKey] = encryptedData;

    // Generate document list
    const docs: GeneratedDocument[] = generateDocumentList(
      organizer.returnType as "1040" | "1120" | "1120S" | "1065" | "1041",
      sectionDataMap
    );

    // Update organizer as completed
    await db
      .update(taxOrganizers)
      .set({
        status: "completed",
        completedAt: new Date(),
        generatedDocuments: docs,
        updatedAt: new Date(),
      })
      .where(eq(taxOrganizers.id, id));

    // Auto-create document upload link for the generated docs
    if (docs.length > 0) {
      const linkToken = crypto.randomBytes(32).toString("base64url");
      const linkExpires = new Date();
      linkExpires.setDate(linkExpires.getDate() + 60);

      await db.insert(documentLinks).values({
        ownerId: organizer.ownerId,
        token: linkToken,
        clientName: organizer.clientName,
        clientEmail: organizer.clientEmail,
        clientPhone: organizer.clientPhone,
        message: `Documents needed for your ${organizer.taxYear} tax return based on your completed organizer.`,
        requiredDocuments: docs.map((d) => d.document),
        maxUploads: 25,
        expiresAt: linkExpires,
        deliveryMethod: "email",
      });

      // Notify CPA
      try {
        const [owner] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, organizer.ownerId))
          .limit(1);

        if (owner?.email) {
          const portalUrl =
            process.env.NEXT_PUBLIC_PORTAL_URL ||
            process.env.NEXT_PUBLIC_BASE_URL ||
            "https://portal.nexli.net";

          const emailContent = buildOrganizerCompletedEmail({
            clientName: organizer.clientName,
            taxYear: organizer.taxYear,
            returnType: organizer.returnType,
            dashboardUrl: `${portalUrl}/dashboard/tax-organizers`,
            documentCount: docs.length,
          });

          await sendEmailWithLog({
            to: owner.email,
            subject: emailContent.subject,
            html: emailContent.html,
            recipientName: owner.name || "CPA",
            emailType: "tax_organizer_completed",
            relatedId: organizer.id,
            sentBy: undefined,
          });
        }
      } catch {
        // Don't block on email failure
      }
    }

    return NextResponse.json({
      saved: true,
      organizerCompleted: true,
      generatedDocuments: docs,
    });
  }

  return NextResponse.json({ saved: true, organizerCompleted: false });
}
