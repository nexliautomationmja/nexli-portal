import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, invoiceLineItems, invoiceReminders, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendEmailWithLog, buildInvoiceEmail } from "@/lib/email";
import { getOwnerBranding } from "@/lib/branding";
import { formatCurrency } from "@/lib/invoice-utils";
import { syncInvoiceToAccounting } from "@/lib/accounting-sync";
import { resolveStripeAccountForOwner } from "@/lib/stripe";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, invoiceId), eq(invoices.ownerId, session.user.id))
    )
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (invoice.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be sent" },
      { status: 400 }
    );
  }

  // Update invoice status (Stripe Checkout Session is created at checkout time)
  const [updated] = await db
    .update(invoices)
    .set({
      status: "sent",
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  // Send email to client
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const senderName =
    session.user.name || session.user.email || "Your Service Provider";
  const invoiceUrl = `${portalUrl}/invoice/${invoice.token}`;

  try {
    const branding = await getOwnerBranding(session.user.id);
    const { subject, html } = buildInvoiceEmail({
      clientName: invoice.clientName,
      senderName,
      invoiceNumber: invoice.invoiceNumber,
      total: formatCurrency(invoice.total, invoice.currency),
      dueDate: invoice.dueDate,
      invoiceUrl,
      branding,
    });
    await sendEmailWithLog({
      to: invoice.clientEmail,
      subject,
      html,
      fromName: branding.fromName,
      recipientName: invoice.clientName,
      emailType: "invoice",
      relatedId: invoice.id,
      sentBy: session.user.id,
    });
  } catch (err) {
    console.error("Failed to send invoice email:", err);
  }

  // Sync to accounting software (non-blocking)
  syncInvoiceToAccounting(invoiceId).catch((err) =>
    console.error("Accounting sync failed:", err)
  );

  // Materialize reminders from reminderConfig
  if (invoice.reminderConfig) {
    try {
      const config = invoice.reminderConfig as {
        schedule?: { dayOffset: number }[];
      };
      if (config.schedule?.length) {
        const dueDate = invoice.dueDate;
        const reminderRows = config.schedule.map((r) => {
          const scheduledFor = new Date(dueDate);
          scheduledFor.setDate(scheduledFor.getDate() + r.dayOffset);
          return {
            invoiceId,
            dayOffset: r.dayOffset,
            scheduledFor,
          };
        });
        await db
          .insert(invoiceReminders)
          .values(reminderRows)
          .onConflictDoNothing();
      }
    } catch (err) {
      console.error("Failed to create invoice reminders:", err);
    }
  }

  // Warn (don't block) if the firm can't yet accept online payments: the
  // client will see a "pay by the method on the invoice" notice instead of
  // the Stripe checkout button.
  let warning: "payments_not_configured" | undefined;
  try {
    const resolution = await resolveStripeAccountForOwner(session.user.id);
    if (resolution.mode === "not_configured") {
      warning = "payments_not_configured";
    }
  } catch (err) {
    console.error("Stripe account resolution failed on send:", err);
  }

  return NextResponse.json({ invoice: updated, warning });
}
