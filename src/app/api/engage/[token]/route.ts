import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  engagements,
  engagementSigners,
  engagementTemplates,
  invoices,
  invoiceLineItems,
  users,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmailWithLog, buildEngagementSignedEmail, buildEngagementCompletedEmail, buildInvoiceEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import {
  generateInvoiceNumber,
  generateInvoiceToken,
  calculateLineAmount,
  calculateInvoiceTotals,
  formatCurrency,
} from "@/lib/invoice-utils";

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

  // Fetch all signers who have already signed (to show their signatures on the document)
  const signedSigners = await db
    .select({
      name: engagementSigners.name,
      role: engagementSigners.role,
      signatureData: engagementSigners.signatureData,
      signedAt: engagementSigners.signedAt,
    })
    .from(engagementSigners)
    .where(eq(engagementSigners.engagementId, engagement.id));

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
    signers: signedSigners.map((s) => ({
      name: s.name,
      role: s.role,
      signatureData: s.signatureData,
      signedAt: s.signedAt ? new Date(s.signedAt).toISOString() : null,
    })),
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const typedName = typeof body.typedName === "string" ? body.typedName.trim() : "";
  // signatureData is now the typed name (rendered in script font on the frontend)
  const signatureData = typeof body.signatureData === "string" ? body.signatureData.trim() : typedName;

  if (!typedName) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  if (typedName.length > 200) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
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

  let firstInvoiceToken: string | null = null;

  if (allSigned) {
    await db
      .update(engagements)
      .set({ status: "signed", updatedAt: new Date() })
      .where(eq(engagements.id, engagement.id));

    // Auto-generate FIRST invoice from template's invoice schedule
    firstInvoiceToken = await generateFirstInvoiceFromEngagement(engagement, allSigners);
  }

  // Fetch owner for emails
  const [owner] = await db
    .select()
    .from(users)
    .where(eq(users.id, engagement.ownerId))
    .limit(1);

  if (allSigned) {
    // Send fully-signed engagement document to BOTH parties
    try {
      const portalUrl =
        process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
      const dashboardUrl = `${portalUrl}/dashboard/engagements`;

      // Re-fetch all signers with updated signature data
      const completedSigners = await db
        .select()
        .from(engagementSigners)
        .where(eq(engagementSigners.engagementId, engagement.id));

      const signerData = completedSigners
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          name: s.name,
          role: s.role,
          signatureData: s.signatureData,
          signedAt: s.signedAt,
        }));

      // Send to CPA (owner)
      if (owner?.email) {
        const { subject, html } = buildEngagementCompletedEmail({
          recipientName: owner.name || owner.email,
          subject: engagement.subject,
          content: engagement.content,
          signers: signerData,
          completedAt: new Date(),
          dashboardUrl,
        });
        await sendEmailWithLog({
          to: owner.email,
          subject,
          html,
          recipientName: owner.name || undefined,
          emailType: "engagement_completed",
          relatedId: engagement.id,
        });
      }

      // Send to all client signers (order > 0)
      for (const cs of completedSigners.filter((s) => s.order > 0)) {
        const { subject, html } = buildEngagementCompletedEmail({
          recipientName: cs.name,
          subject: engagement.subject,
          content: engagement.content,
          signers: signerData,
          completedAt: new Date(),
        });
        await sendEmailWithLog({
          to: cs.email,
          subject,
          html,
          recipientName: cs.name,
          emailType: "engagement_completed",
          relatedId: engagement.id,
        });
      }
    } catch (err) {
      console.error("Failed to send engagement completed emails:", err);
    }
  } else {
    // Not all signed yet — just notify CPA that this signer signed
    try {
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
  }

  // In-app notification
  try {
    await createNotification({
      userId: engagement.ownerId,
      type: "engagement_signed",
      title: allSigned ? "Engagement Fully Signed" : "Engagement Letter Signed",
      message: allSigned
        ? `All parties have signed "${engagement.subject}"`
        : `${signer.name} signed "${engagement.subject}"`,
      metadata: { engagementId: engagement.id, signerName: signer.name, subject: engagement.subject },
    });
  } catch (err) {
    console.error("Engagement notification failed:", err);
  }

  // Only redirect client signers (order > 0) to the invoice, not the owner
  const isClientSigner = signer.order > 0;

  return NextResponse.json({
    ok: true,
    signedAt: new Date().toISOString(),
    allSigned,
    invoiceToken: isClientSigner ? firstInvoiceToken : null,
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

// ── Auto-generate FIRST invoice from engagement template ──────
// Only the first invoice (daysAfterSigning=0) is created immediately.
// Subsequent invoices are created when the first is paid (see payments webhook).
interface ScheduleLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  billingType: "one_time" | "monthly" | "quarterly" | "yearly";
}

interface ScheduleEntry {
  label: string;
  daysAfterSigning: number;
  lineItems: ScheduleLineItem[];
}

async function generateFirstInvoiceFromEngagement(
  engagement: typeof engagements.$inferSelect,
  allSigners: (typeof engagementSigners.$inferSelect)[]
): Promise<string | null> {
  try {
    if (!engagement.templateId) return null;

    const [template] = await db
      .select()
      .from(engagementTemplates)
      .where(eq(engagementTemplates.id, engagement.templateId))
      .limit(1);

    if (!template?.invoiceSchedule) return null;

    const schedule = template.invoiceSchedule as ScheduleEntry[];
    if (!Array.isArray(schedule) || schedule.length === 0) return null;

    // Find the client signer (first non-CPA signer, order > 0)
    const clientSigner = allSigners
      .filter((s) => s.order > 0)
      .sort((a, b) => a.order - b.order)[0];

    if (!clientSigner) return null;

    // Only create the FIRST schedule entry (immediate invoice)
    const firstEntry = schedule[0];
    const now = new Date();
    const dueDate = new Date(now);
    // Minimum 1 day out so the invoice doesn't show as overdue immediately
    const daysOut = Math.max(firstEntry.daysAfterSigning || 0, 1);
    dueDate.setDate(dueDate.getDate() + daysOut);

    const processedItems = firstEntry.lineItems.map((li, i) => {
      const qty = Math.round(li.quantity * 100);
      const amount = calculateLineAmount(qty, li.unitPriceCents);
      return {
        description: li.description,
        quantity: qty,
        unitPrice: li.unitPriceCents,
        amount,
        billingType: li.billingType || "one_time",
        order: i,
      };
    });

    const hasRecurring = processedItems.some(
      (p) => p.billingType !== "one_time"
    );

    const { subtotal, taxAmount, total } = calculateInvoiceTotals(
      processedItems,
      0
    );

    const invoiceNumber = await generateInvoiceNumber();
    const invToken = generateInvoiceToken();

    // Store remaining schedule entries as pendingSchedule so the
    // payments webhook can create the next invoice when this one is paid
    const pendingSchedule = schedule.length > 1 ? schedule.slice(1) : null;

    const [invoice] = await db
      .insert(invoices)
      .values({
        ownerId: engagement.ownerId,
        engagementId: engagement.id,
        clientName: clientSigner.name,
        clientEmail: clientSigner.email,
        invoiceNumber,
        token: invToken,
        currency: "usd",
        subtotal,
        taxRate: 0,
        taxAmount,
        total,
        amountPaid: 0,
        balanceDue: total,
        isRecurring: hasRecurring,
        dueDate,
        notes: `Auto-generated from engagement: ${engagement.subject}`,
        status: "sent",
        sentAt: new Date(),
        // Store remaining schedule for deferred invoice creation
        reminderConfig: pendingSchedule
          ? { pendingEngagementSchedule: pendingSchedule }
          : undefined,
      })
      .returning();

    for (const item of processedItems) {
      await db.insert(invoiceLineItems).values({
        invoiceId: invoice.id,
        ...item,
      });
    }

    // Send invoice email to the client so they have a link to pay
    try {
      const portalUrl =
        process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
      const invoiceUrl = `${portalUrl}/invoice/${invToken}`;

      const [owner] = await db
        .select({ name: users.name, email: users.email, companyName: users.companyName })
        .from(users)
        .where(eq(users.id, engagement.ownerId))
        .limit(1);

      const senderName =
        owner?.companyName || owner?.name || owner?.email || "Your Service Provider";

      const { subject: invSubject, html: invHtml } = buildInvoiceEmail({
        clientName: clientSigner.name,
        senderName,
        invoiceNumber,
        total: formatCurrency(total, "usd"),
        dueDate,
        invoiceUrl,
      });

      await sendEmailWithLog({
        to: clientSigner.email,
        subject: invSubject,
        html: invHtml,
        recipientName: clientSigner.name,
        emailType: "invoice",
        relatedId: invoice.id,
      });
    } catch (err) {
      console.error("Failed to send initial invoice email:", err);
    }

    // Notify CPA about the auto-generated invoice
    await createNotification({
      userId: engagement.ownerId,
      type: "engagement_signed",
      title: "Invoice Auto-Generated",
      message: `Initial setup invoice created and emailed to ${clientSigner.name} from "${engagement.subject}".${pendingSchedule ? ` Next invoice will be created automatically when this one is paid.` : ""}`,
      metadata: { engagementId: engagement.id, invoiceId: invoice.id },
    });

    return invToken;
  } catch (err) {
    console.error("Failed to auto-generate invoice from engagement:", err);
    return null;
  }
}
