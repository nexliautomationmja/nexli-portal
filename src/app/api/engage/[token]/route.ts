import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engagements, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail, buildEngagementSignedEmail } from "@/lib/email";

// GET — validate token, return engagement info, mark as viewed
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.token, token))
    .limit(1);

  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (new Date(engagement.expiresAt) < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  if (engagement.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 410 });
  }
  if (engagement.status === "declined") {
    return NextResponse.json({ error: "This engagement was declined" }, { status: 410 });
  }
  if (engagement.status === "expired") {
    return NextResponse.json({ error: "This engagement has been voided" }, { status: 410 });
  }

  // Mark as viewed if first time
  if (!engagement.viewedAt) {
    await db
      .update(engagements)
      .set({ status: "viewed", viewedAt: new Date(), updatedAt: new Date() })
      .where(eq(engagements.id, engagement.id));
  }

  return NextResponse.json({
    clientName: engagement.clientName,
    subject: engagement.subject,
    content: engagement.content,
    expiresAt: engagement.expiresAt,
    status: engagement.viewedAt ? engagement.status : "viewed",
  });
}

// POST — submit signature
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.token, token))
    .limit(1);

  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (new Date(engagement.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }
  if (engagement.status === "signed") {
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

  await db
    .update(engagements)
    .set({
      status: "signed",
      signedAt: new Date(),
      signatureData,
      signatureIp: ip,
      signatureUserAgent: ua,
      updatedAt: new Date(),
    })
    .where(eq(engagements.id, engagement.id));

  // Notify CPA via email
  try {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, engagement.ownerId))
      .limit(1);

    if (owner?.email) {
      const { subject, html } = buildEngagementSignedEmail({
        cpaName: owner.name || owner.email,
        clientName: engagement.clientName,
        subject: engagement.subject,
        signedAt: new Date(),
      });
      await sendEmail({ to: owner.email, subject, html });
    }
  } catch (err) {
    console.error("Failed to send engagement signed email:", err);
  }

  return NextResponse.json({ ok: true, signedAt: new Date().toISOString() });
}

// PATCH — decline
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.token, token))
    .limit(1);

  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (engagement.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 410 });
  }

  const body = await req.json();
  const { reason } = body;

  await db
    .update(engagements)
    .set({
      status: "declined",
      declinedAt: new Date(),
      declineReason: reason || null,
      updatedAt: new Date(),
    })
    .where(eq(engagements.id, engagement.id));

  return NextResponse.json({ ok: true });
}
