import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { constructWebhookEvent, stripe } from "@/lib/stripe";
import {
  sendEmailWithLog,
  buildInvoicePaidEmail,
  buildPaymentReceiptEmail,
} from "@/lib/email";
import { formatCurrency } from "@/lib/invoice-utils";
import { syncPaymentToAccounting } from "@/lib/accounting-sync";
import { createNotification } from "@/lib/notifications";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Only process checkout completions
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) {
    console.error("Stripe webhook: no invoiceId in session metadata");
    return NextResponse.json({ received: true });
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    console.error(`Stripe webhook: no invoice found for id ${invoiceId}`);
    return NextResponse.json({ received: true });
  }

  // Idempotency: skip if already processed this payment intent
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (invoice.stripePaymentIntentId === paymentIntentId) {
    return NextResponse.json({ received: true });
  }

  // Calculate amounts (session.amount_total is in smallest currency unit = cents)
  const paymentAmountCents = session.amount_total || 0;
  const newAmountPaid = invoice.amountPaid + paymentAmountCents;
  const newBalanceDue = Math.max(0, invoice.total - newAmountPaid);
  const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

  // Detect payment method type
  let paymentMethodType = "card";
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.payment_method) {
        const pmId =
          typeof pi.payment_method === "string"
            ? pi.payment_method
            : pi.payment_method.id;
        const pm = await stripe.paymentMethods.retrieve(pmId);
        if (pm.type === "us_bank_account") {
          paymentMethodType = "ach";
        }
      }
    } catch {
      // Default to "card" if we can't determine
    }
  }

  const [updated] = await db
    .update(invoices)
    .set({
      status: newStatus,
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      paidAt: newStatus === "paid" ? new Date() : null,
      stripePaymentIntentId: paymentIntentId || null,
      stripeCheckoutSessionId: session.id,
      paymentMethod: paymentMethodType,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ received: true });
  }

  // Send notification email to CPA
  try {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, updated.ownerId))
      .limit(1);

    if (owner?.email) {
      const paidLabel =
        newStatus === "paid"
          ? formatCurrency(updated.total, updated.currency)
          : `${formatCurrency(paymentAmountCents, updated.currency)} (partial — ${formatCurrency(newBalanceDue, updated.currency)} remaining)`;

      const { subject, html } = buildInvoicePaidEmail({
        senderName: owner.name || owner.email,
        clientName: updated.clientName,
        invoiceNumber: updated.invoiceNumber,
        total: paidLabel,
        paidAt: new Date(),
      });
      await sendEmailWithLog({
        to: owner.email,
        subject,
        html,
        recipientName: owner.name || undefined,
        emailType: "invoice_paid",
        relatedId: updated.id,
      });
    }
  } catch (err) {
    console.error("Failed to send invoice paid email:", err);
  }

  // Send payment receipt to client
  try {
    const portalUrl =
      process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

    const [owner] = await db
      .select({
        name: users.name,
        email: users.email,
        companyName: users.companyName,
      })
      .from(users)
      .where(eq(users.id, updated.ownerId))
      .limit(1);

    const senderLabel =
      owner?.companyName ||
      owner?.name ||
      owner?.email ||
      "Your Service Provider";

    const { subject: receiptSubject, html: receiptHtml } =
      buildPaymentReceiptEmail({
        clientName: updated.clientName,
        senderName: senderLabel,
        invoiceNumber: updated.invoiceNumber,
        amountPaid: formatCurrency(paymentAmountCents, updated.currency),
        totalInvoice: formatCurrency(updated.total, updated.currency),
        remainingBalance:
          newBalanceDue > 0
            ? formatCurrency(newBalanceDue, updated.currency)
            : null,
        paidAt: new Date(),
        portalUrl,
      });
    await sendEmailWithLog({
      to: updated.clientEmail,
      subject: receiptSubject,
      html: receiptHtml,
      recipientName: updated.clientName,
      emailType: "payment_receipt",
      relatedId: updated.id,
    });
  } catch (err) {
    console.error("Failed to send payment receipt:", err);
  }

  // In-app notification
  try {
    await createNotification({
      userId: updated.ownerId,
      type: "invoice_paid",
      title: "Invoice Paid",
      message: `${updated.clientName} paid invoice ${updated.invoiceNumber}`,
      metadata: {
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        clientName: updated.clientName,
      },
    });
  } catch (err) {
    console.error("Invoice paid notification failed:", err);
  }

  // Sync payment to accounting software (non-blocking)
  syncPaymentToAccounting(invoice.id).catch((err) =>
    console.error("Accounting payment sync failed:", err)
  );

  return NextResponse.json({ received: true });
}
