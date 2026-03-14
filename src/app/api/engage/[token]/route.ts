import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engagements, engagementSigners, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmailWithLog, buildEngagementSignedEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

// GET — validate token, return engagement info, mark signer as viewed
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [signer] = await db
    .select()
    .from(engagementSigners)
    .where(eq(engagementSigners.token, token))
    .limit(1);

  if (!signer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, signer.engagementId))
    .limit(1);

  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (new Date(engagement.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "This link has expired" },
      { status: 410 }
    );
  }

  if (signer.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 410 });
  }
  if (signer.status === "declined") {
    return NextResponse.json(
      { error: "This engagement was declined" },
      { status: 410 }
    );
  }
  if (signer.status === "expired" || engagement.status === "expired") {
    return NextResponse.json(
      { error: "This engagement has been voided" },
      { status: 410 }
    );
  }

  // Mark signer as viewed if first time
  if (!signer.viewedAt) {
    await db
      .update(engagementSigners)
      .set({ status: "viewed", viewedAt: new Date() })
      .where(eq(engagementSigners.id, signer.id));
  }

  // Fetch owner info for letterhead
  const [owner] = await db
    .select({ name: users.name, companyName: users.companyName })
    .from(users)
    .where(eq(users.id, engagement.ownerId))
    .limit(1);

  return NextResponse.json({
    clientName: signer.name,
    subject: engagement.subject,
    content: engagement.content,
    expiresAt: engagement.expiresAt,
    status: signer.viewedAt ? signer.status : "viewed",
    role: signer.role || null,
    from: {
      name: owner?.name || "",
      company: owner?.companyName || "",
    },
  });
}

// POST — submit signature for this signer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [signer] = await db
    .select()
    .from(engagementSigners)
    .where(eq(engagementSigners.token, token))
    .limit(1);

  if (!signer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, signer.engagementId))
    .limit(1);

  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (new Date(engagement.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }
  if (signer.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 410 });
  }

  const body = await req.json();
  const { signatureData, typedName } = body;

  if (!signatureData || !typedName) {
    return NextResponse.json(
      { error: "signatureData and typedName are required" },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ua = req.headers.get("user-agent") || "unknown";

  // Update this signer
  await db
    .update(engagementSigners)
    .set({
      status: "signed",
      signedAt: new Date(),
      signatureData,
      signatureIp: ip,
      signatureUserAgent: ua,
    })
    .where(eq(engagementSigners.id, signer.id));

  // Check if all signers have signed → update engagement status
  const allSigners = await db
    .select()
    .from(engagementSigners)
    .where(eq(engagementSigners.engagementId, engagement.id));

  const allSigned = allSigners.every(
    (s) => s.id === signer.id || s.status === "signed"
  );

  if (allSigned) {
    await db
      .update(engagements)
      .set({ status: "signed", updatedAt: new Date() })
      .where(eq(engagements.id, engagement.id));
  }

  // Notify CPA via email
  try {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, engagement.ownerId))
      .limit(1);

    if (owner?.email) {
      const { subject, html } = buildEngagementSignedEmail({
        senderName: owner.name || owner.email,
        clientName: signer.name,
        subject: engagement.subject,
        signedAt: new Date(),
      });
      await sendEmailWithLog({ to: owner.email, subject, html, recipientName: owner.name || undefined, emailType: "engagement_signed", relatedId: engagement.id });
    }
  } catch (err) {
    console.error("Failed to send engagement signed email:", err);
  }

  // In-app notification
  createNotification({
    userId: engagement.ownerId,
    type: "engagement_signed",
    title: "Engagement Letter Signed",
    message: `${signer.name} signed "${engagement.subject}"`,
    metadata: { engagementId: engagement.id, signerName: signer.name, subject: engagement.subject },
  }).catch((err) => console.error("Engagement notification failed:", err));

  return NextResponse.json({
    ok: true,
    signedAt: new Date().toISOString(),
    allSigned,
  });
}

// PATCH — decline for this signer
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [signer] = await db
    .select()
    .from(engagementSigners)
    .where(eq(engagementSigners.token, token))
    .limit(1);

  if (!signer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (signer.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 410 });
  }

  const body = await req.json();
  const { reason } = body;

  await db
    .update(engagementSigners)
    .set({
      status: "declined",
      declinedAt: new Date(),
      declineReason: reason || null,
    })
    .where(eq(engagementSigners.id, signer.id));

  // Update engagement status to declined
  await db
    .update(engagements)
    .set({ status: "declined", updatedAt: new Date() })
    .where(eq(engagements.id, signer.engagementId));

  return NextResponse.json({ ok: true });
}
