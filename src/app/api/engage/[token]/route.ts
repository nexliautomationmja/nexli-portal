import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engagements, engagementSigners, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmailWithLog, buildEngagementSignedEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import {
  triggerDrsPostSign,
  getPrimaryClientSigner,
  isDigitalRainmakerEngagement,
  sendOnboardingWelcomeEmails,
} from "@/lib/digital-rainmaker";
import { initOnboarding } from "@/lib/onboarding";
import {
  isEnterpriseEngagement,
  triggerEnterprisePostSign,
} from "@/lib/enterprise-invoicing";

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

  // Fetch the sender signer (order=0) so the recipient can see the pre-attached
  // signature on the document during signing.
  const [senderSigner] = await db
    .select({
      name: engagementSigners.name,
      role: engagementSigners.role,
      signedAt: engagementSigners.signedAt,
      signatureData: engagementSigners.signatureData,
    })
    .from(engagementSigners)
    .where(eq(engagementSigners.engagementId, engagement.id))
    .orderBy(engagementSigners.order)
    .limit(1);

  return NextResponse.json({
    clientName: signer.name,
    clientCompany: clientCompanyOf(engagement.metadata),
    subject: engagement.subject,
    content: engagement.content,
    expiresAt: engagement.expiresAt,
    status: signer.viewedAt ? signer.status : "viewed",
    role: signer.role || null,
    from: {
      name: owner?.name || "",
      company: owner?.companyName || "",
    },
    sender: senderSigner
      ? {
          name: senderSigner.name,
          role: senderSigner.role,
          signedAt: senderSigner.signedAt,
          signatureData: senderSigner.signatureData,
        }
      : null,
  });
}

function clientCompanyOf(metadata: unknown): string | null {
  const v = (metadata as { clientCompany?: unknown } | null)?.clientCompany;
  return typeof v === "string" && v.trim() ? v : null;
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const signatureData = typeof body.signatureData === "string" ? body.signatureData : "";
  const typedName = typeof body.typedName === "string" ? body.typedName.trim() : "";

  if (!signatureData || !typedName) {
    return NextResponse.json(
      { error: "Signature and name are required" },
      { status: 400 }
    );
  }

  if (typedName.length > 200) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }
  if (signatureData.length > 500_000) {
    return NextResponse.json({ error: "Signature data too large" }, { status: 400 });
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

  let isDrsLetter = false;
  if (allSigned) {
    await db
      .update(engagements)
      .set({ status: "signed", updatedAt: new Date() })
      .where(eq(engagements.id, engagement.id));

    // Nexli Enterprise License: one up-front ACH/wire-only invoice for the
    // tier's license fee. Enterprise clients get no Launch Pad/onboarding
    // (that's DRS-only) — the kickoff week is scheduled once funds clear.
    let enterprise = false;
    try {
      enterprise = await isEnterpriseEngagement(engagement.templateId);
    } catch (err) {
      console.error("Enterprise template check failed:", err);
    }

    // Digital Rainmaker letters: signing sends ONLY the up-front invoice
    // ($32,000 Setup Fee, or one $74,000 setup + annual invoice). Onboarding
    // and the welcome email wait until that invoice is paid
    // (onDrsInvoicePaid in lib/digital-rainmaker.ts).
    let isDrs = false;
    if (!enterprise) {
      try {
        isDrs = await isDigitalRainmakerEngagement(engagement.templateId);
      } catch (err) {
        console.error("DRS template check failed:", err);
      }
    }
    isDrsLetter = isDrs;

    if (enterprise) {
      try {
        const primary = await getPrimaryClientSigner(engagement.id);
        if (primary) {
          await triggerEnterprisePostSign({ engagement, primarySigner: primary });
        }
      } catch (err) {
        console.error("Enterprise post-sign trigger failed:", err);
      }
    } else if (isDrs) {
      try {
        const primary = await getPrimaryClientSigner(engagement.id);
        if (primary) {
          await triggerDrsPostSign({ engagement, primarySigner: primary });
        }
      } catch (err) {
        console.error("DRS post-sign trigger failed:", err);
      }
    } else {
      // Other letters: kick off the client onboarding Launch Pad right away.
      // Never blocks signing — idempotent, so a concurrent second signer
      // finishing is a no-op.
      try {
        await initOnboarding(engagement.id, "auto_sign");
      } catch (err) {
        console.error("Onboarding init failed:", err);
      }

      // Send every client signer their Launch Pad link.
      await sendOnboardingWelcomeEmails(engagement.id);
    }
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
  try {
    await createNotification({
      userId: engagement.ownerId,
      type: "engagement_signed",
      title: "Engagement Letter Signed",
      message: `${signer.name} signed "${engagement.subject}"`,
      metadata: { engagementId: engagement.id, signerName: signer.name, subject: engagement.subject },
    });
  } catch (err) {
    console.error("Engagement notification failed:", err);
  }

  return NextResponse.json({
    ok: true,
    signedAt: new Date().toISOString(),
    allSigned,
    // DRS: onboarding opens once the up-front invoice is paid, not at signing.
    onboardingUrl: allSigned && !isDrsLetter ? `/onboarding/${signer.token}` : null,
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : null;

  await db
    .update(engagementSigners)
    .set({
      status: "declined",
      declinedAt: new Date(),
      declineReason: reason,
    })
    .where(eq(engagementSigners.id, signer.id));

  // Update engagement status to declined
  await db
    .update(engagements)
    .set({ status: "declined", updatedAt: new Date() })
    .where(eq(engagements.id, signer.engagementId));

  return NextResponse.json({ ok: true });
}
