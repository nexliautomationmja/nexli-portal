import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  taxOrganizerLinks,
  taxOrganizerSubmissions,
  documentAuditLog,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { sendEmailWithLog, buildTaxOrganizerEmail } from "@/lib/email";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const links = await db
    .select()
    .from(taxOrganizerLinks)
    .where(eq(taxOrganizerLinks.ownerId, session.user.id))
    .orderBy(desc(taxOrganizerLinks.createdAt));

  // Attach submission data if submitted
  const organizers = await Promise.all(
    links.map(async (link) => {
      let submission = null;
      if (link.submittedAt) {
        const [sub] = await db
          .select()
          .from(taxOrganizerSubmissions)
          .where(eq(taxOrganizerSubmissions.linkId, link.id))
          .limit(1);
        if (sub) {
          submission = {
            id: sub.id,
            formData: sub.formData as Record<string, unknown>,
            uploadedDocumentIds: sub.uploadedDocumentIds as string[] | null,
            createdAt: sub.createdAt.toISOString(),
          };
        }
      }
      return {
        ...link,
        expiresAt: link.expiresAt.toISOString(),
        lastAccessedAt: link.lastAccessedAt?.toISOString() || null,
        submittedAt: link.submittedAt?.toISOString() || null,
        createdAt: link.createdAt.toISOString(),
        submission,
      };
    })
  );

  return NextResponse.json({ organizers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { clientName, clientEmail, taxYear, returnType, expiresInDays = 30 } = body;

  if (!clientName || !clientEmail || !taxYear) {
    return NextResponse.json(
      { error: "clientName, clientEmail, and taxYear are required" },
      { status: 400 }
    );
  }

  const validTypes = ["1040", "1120", "1120S", "1065", "1041"];
  const rt = validTypes.includes(returnType) ? returnType : "1040";

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [link] = await db
    .insert(taxOrganizerLinks)
    .values({
      ownerId: session.user.id,
      token,
      clientName,
      clientEmail,
      taxYear,
      returnType: rt,
      expiresAt,
    })
    .returning();

  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const organizerUrl = `${portalUrl}/tax-organizer/${token}`;

  // Send email
  let emailSent = false;
  try {
    const senderName = session.user.name || session.user.email || "Your CPA";
    const { subject, html } = buildTaxOrganizerEmail({
      clientName,
      senderName,
      taxYear,
      returnType: rt,
      organizerUrl,
      expiresAt,
    });

    await sendEmailWithLog({
      to: clientEmail,
      subject,
      html,
      recipientName: clientName,
      emailType: "tax_organizer_request",
      relatedId: link.id,
      sentBy: session.user.id,
    });
    emailSent = true;
  } catch (err) {
    console.error("Tax organizer email failed:", err);
  }

  // Audit log
  await db.insert(documentAuditLog).values({
    linkId: link.id,
    action: "tax_organizer_sent",
    actorId: session.user.id,
    actorName: session.user.name || session.user.email,
    metadata: {
      clientEmail,
      expiresAt: expiresAt.toISOString(),
      emailSent,
    },
  });

  return NextResponse.json({ link, organizerUrl, emailSent }, { status: 201 });
}
