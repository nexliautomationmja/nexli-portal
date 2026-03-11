import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagements, engagementTemplates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { sendEmail, buildEngagementRequestEmail } from "@/lib/email";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(engagements)
    .where(eq(engagements.ownerId, session.user.id))
    .orderBy(desc(engagements.createdAt));

  return NextResponse.json({ engagements: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    clientName,
    clientEmail,
    subject,
    content,
    templateId,
    expiresInDays = 30,
    saveAsTemplate,
    templateName,
  } = body;

  if (!clientName || !clientEmail || !subject || !content) {
    return NextResponse.json(
      { error: "clientName, clientEmail, subject, and content are required" },
      { status: 400 }
    );
  }

  // Optionally save as template
  if (saveAsTemplate && templateName) {
    await db.insert(engagementTemplates).values({
      ownerId: session.user.id,
      name: templateName,
      content,
    });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [engagement] = await db
    .insert(engagements)
    .values({
      ownerId: session.user.id,
      templateId: templateId || null,
      token,
      clientName,
      clientEmail,
      subject,
      content,
      status: "sent",
      sentAt: new Date(),
      expiresAt,
    })
    .returning();

  // Send email
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const engageUrl = `${portalUrl}/engage/${token}`;
  const cpaName = session.user.name || session.user.email || "Your CPA";

  let emailError: string | null = null;
  try {
    const { subject: emailSubject, html } = buildEngagementRequestEmail({
      clientName,
      cpaName,
      subject,
      engageUrl,
      expiresAt,
    });
    await sendEmail({ to: clientEmail, subject: emailSubject, html });
  } catch (err) {
    console.error("Failed to send engagement email:", err);
    emailError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(
    { engagement, engageUrl, emailError },
    { status: 201 }
  );
}
