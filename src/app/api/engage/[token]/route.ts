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
import { sendEmailWithLog, buildEngagementSignedEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import {
  generateInvoiceNumber,
  generateInvoiceToken,
  calculateLineAmount,
  calculateInvoiceTotals,
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

  if (allSigned) {
    await db
      .update(engagements)
      .set({ status: "signed", updatedAt: new Date() })
      .where(eq(engagements.id, engagement.id));

    // Auto-generate invoices from template's invoice schedule
    await generateInvoicesFromEngagement(engagement, allSigners);
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

// ── Auto-generate invoices from engagement template ──────
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

async function generateInvoicesFromEngagement(
  engagement: typeof engagements.$inferSelect,
  allSigners: (typeof engagementSigners.$inferSelect)[]
) {
  try {
    if (!engagement.templateId) return;

    const [template] = await db
      .select()
      .from(engagementTemplates)
      .where(eq(engagementTemplates.id, engagement.templateId))
      .limit(1);

    if (!template?.invoiceSchedule) return;

    const schedule = template.invoiceSchedule as ScheduleEntry[];
    if (!Array.isArray(schedule) || schedule.length === 0) return;

    // Find the client signer (first non-CPA signer, order > 0)
    const clientSigner = allSigners
      .filter((s) => s.order > 0)
      .sort((a, b) => a.order - b.order)[0];

    if (!clientSigner) return;

    const now = new Date();

    for (const entry of schedule) {
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + (entry.daysAfterSigning || 0));

      // Process line items
      const processedItems = entry.lineItems.map((li, i) => {
        const qty = Math.round(li.quantity * 100); // stored as qty * 100
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
        0 // no tax by default — CPA can adjust on the draft
      );

      const invoiceNumber = await generateInvoiceNumber();
      const token = generateInvoiceToken();

      const [invoice] = await db
        .insert(invoices)
        .values({
          ownerId: engagement.ownerId,
          engagementId: engagement.id,
          clientName: clientSigner.name,
          clientEmail: clientSigner.email,
          invoiceNumber,
          token,
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
          status: "draft",
        })
        .returning();

      for (const item of processedItems) {
        await db.insert(invoiceLineItems).values({
          invoiceId: invoice.id,
          ...item,
        });
      }
    }

    // Notify CPA about auto-generated invoices
    await createNotification({
      userId: engagement.ownerId,
      type: "engagement_signed",
      title: "Invoices Auto-Generated",
      message: `${schedule.length} draft invoice(s) created from "${engagement.subject}" — review and send when ready.`,
      metadata: { engagementId: engagement.id },
    });
  } catch (err) {
    console.error("Failed to auto-generate invoices from engagement:", err);
  }
}
