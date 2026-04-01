import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { taxReturns, taxOrganizerLinks, documentAuditLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { sendEmailWithLog, buildTaxOrganizerEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { returnId } = await params;
  const body = await req.json();
  const { expiresInDays = 30 } = body;

  // Verify ownership of the tax return
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

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [link] = await db
    .insert(taxOrganizerLinks)
    .values({
      ownerId: session.user.id,
      taxReturnId: taxReturn.id,
      token,
      clientName: taxReturn.clientName,
      clientEmail: taxReturn.clientEmail,
      taxYear: taxReturn.taxYear,
      returnType: taxReturn.returnType,
      expiresAt,
    })
    .returning();

  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const organizerUrl = `${portalUrl}/tax-organizer/${token}`;

  // Send email
  let emailSent = false;
  try {
    const senderName =
      session.user.name || session.user.email || "Your CPA";
    const { subject, html } = buildTaxOrganizerEmail({
      clientName: taxReturn.clientName,
      senderName,
      taxYear: taxReturn.taxYear,
      returnType: taxReturn.returnType,
      organizerUrl,
      expiresAt,
    });

    await sendEmailWithLog({
      to: taxReturn.clientEmail,
      subject,
      html,
      recipientName: taxReturn.clientName,
      emailType: "tax_organizer_request",
      relatedId: link.id,
      sentBy: session.user.id,
    });
    emailSent = true;
  } catch (err) {
    console.error("Failed to send tax organizer email:", err);
  }

  // Audit log
  await db.insert(documentAuditLog).values({
    linkId: link.id,
    action: "tax_organizer_sent",
    actorId: session.user.id,
    actorName: session.user.name || session.user.email,
    metadata: {
      taxReturnId: taxReturn.id,
      clientEmail: taxReturn.clientEmail,
      expiresAt: expiresAt.toISOString(),
      emailSent,
    },
  });

  return NextResponse.json({ link, organizerUrl, emailSent }, { status: 201 });
}
