import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  engagements,
  engagementSigners,
  engagementTemplates,
  users,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { sendEmailWithLog, buildEngagementRequestEmail } from "@/lib/email";
import { generateSenderSignatureSvgDataUrl } from "@/lib/signature";

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

  // Fetch signers for all engagements
  const engagementIds = rows.map((r) => r.id);
  const allSigners =
    engagementIds.length > 0
      ? await db
          .select()
          .from(engagementSigners)
          .where(
            eq(
              engagementSigners.engagementId,
              engagementIds.length === 1 ? engagementIds[0] : engagementIds[0]
            )
          )
      : [];

  // If more than one engagement, fetch all signers at once
  let signersByEngagement: Record<string, (typeof allSigners)[number][]> = {};
  if (engagementIds.length > 0) {
    const signers = await db.select().from(engagementSigners);
    const ownerEngagementIds = new Set(engagementIds);
    for (const s of signers) {
      if (!ownerEngagementIds.has(s.engagementId)) continue;
      if (!signersByEngagement[s.engagementId]) {
        signersByEngagement[s.engagementId] = [];
      }
      signersByEngagement[s.engagementId].push(s);
    }
  }

  const enriched = rows.map((eng) => ({
    ...eng,
    signers: (signersByEngagement[eng.id] || []).sort(
      (a, b) => a.order - b.order
    ),
  }));

  // Fetch owner info for document preview
  const [owner] = await db
    .select({ name: users.name, companyName: users.companyName })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    engagements: enriched,
    from: {
      name: owner?.name || "",
      company: owner?.companyName || "",
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    recipients,
    subject,
    content,
    templateId,
    expiresInDays = 30,
    saveAsTemplate,
    templateName,
  } = body;

  if (
    !recipients ||
    !Array.isArray(recipients) ||
    recipients.length === 0 ||
    recipients.length > 5
  ) {
    return NextResponse.json(
      { error: "1 to 5 recipients are required" },
      { status: 400 }
    );
  }

  for (const r of recipients) {
    if (!r.name || !r.email) {
      return NextResponse.json(
        { error: "Each recipient must have a name and email" },
        { status: 400 }
      );
    }
  }

  if (!subject || !content) {
    return NextResponse.json(
      { error: "subject and content are required" },
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

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [engagement] = await db
    .insert(engagements)
    .values({
      ownerId: session.user.id,
      templateId: templateId || null,
      subject,
      content,
      status: "sent",
      sentAt: new Date(),
      expiresAt,
    })
    .returning();

  // Create signers and send emails
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const senderName = session.user.name || session.user.email || "Your Service Provider";
  const cpaEmail = session.user.email || "";
  const emailErrors: string[] = [];
  const signers: { name: string; email: string; engageUrl: string }[] = [];

  // Fetch company name for CPA representative role
  const [ownerInfo] = await db
    .select({ companyName: users.companyName })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const companyName = ownerInfo?.companyName || "";

  // Add the CPA (sender) as the first signer (order 0) — auto-signed.
  // The sender's signature is generated as a cursive SVG using their name and
  // attached immediately so the engagement letter ships pre-signed on the
  // Nexli side. The recipient just needs to add their signature.
  const cpaToken = crypto.randomBytes(32).toString("base64url");
  const cpaEngageUrl = `${portalUrl}/engage/${cpaToken}`;
  const senderSignatureSvg = generateSenderSignatureSvgDataUrl(senderName);
  const senderIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "system";

  await db.insert(engagementSigners).values({
    engagementId: engagement.id,
    name: senderName,
    email: cpaEmail,
    token: cpaToken,
    order: 0,
    status: "signed",
    sentAt: new Date(),
    signedAt: new Date(),
    signatureData: senderSignatureSvg,
    signatureIp: senderIp,
    signatureUserAgent: "Auto-signed by sender on document creation",
    role: companyName
      ? `Authorized Representative, ${companyName}`
      : "Authorized Representative",
  });

  signers.push({ name: senderName, email: cpaEmail, engageUrl: cpaEngageUrl });

  // The CPA is auto-signed on creation, so no "please sign" email is sent
  // to them. They still receive a notification when each recipient signs.

  // Add client recipients as signers (order 1+)
  for (let i = 0; i < recipients.length; i++) {
    const { name, email } = recipients[i];
    const token = crypto.randomBytes(32).toString("base64url");
    const engageUrl = `${portalUrl}/engage/${token}`;

    await db.insert(engagementSigners).values({
      engagementId: engagement.id,
      name,
      email,
      token,
      order: i + 1,
      status: "sent",
      sentAt: new Date(),
    });

    signers.push({ name, email, engageUrl });

    try {
      const { subject: emailSubject, html } = buildEngagementRequestEmail({
        clientName: name,
        senderName,
        subject,
        engageUrl,
        expiresAt,
      });
      await sendEmailWithLog({ to: email, subject: emailSubject, html, recipientName: name, emailType: "engagement_request", relatedId: engagement.id, sentBy: session.user.id });
    } catch (err) {
      console.error(`Failed to send engagement email to ${email}:`, err);
      emailErrors.push(
        `${email}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return NextResponse.json(
    {
      engagement,
      signers,
      emailErrors: emailErrors.length > 0 ? emailErrors : null,
    },
    { status: 201 }
  );
}
