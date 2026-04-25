import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { constructWebhookEvent } from "@/lib/stripe";
import {
  sendEmailWithLog,
  buildInvoicePaidEmail,
  buildPaymentReceiptEmail,
} from "@/lib/email";
import { formatCurrency } from "@/lib/invoice-utils";
import { syncPaymentToAccounting } from "@/lib/accounting-sync";
import { createNotification } from "@/lib/notifications";
import { triggerDrsPostInitialPaid } from "@/lib/digital-rainmaker";
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

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case "checkout.session.async_payment_succeeded":
      await handleAsyncPaymentSucceeded(
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case "checkout.session.async_payment_failed":
      await handleAsyncPaymentFailed(
        event.data.object as Stripe.Checkout.Session
      );
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

// ── checkout.session.completed ──
// Card: payment_status === "paid" → done
// ACH:  payment_status === "unpaid" → pending settlement
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) {
    console.error("Stripe webhook: no invoiceId in session metadata");
    return;
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    console.error(`Stripe webhook: no invoice found for id ${invoiceId}`);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  // Idempotency: skip if we already processed this payment intent
  if (paymentIntentId && invoice.stripePaymentIntentId === paymentIntentId) {
    return;
  }

  const amountCents = session.amount_total ?? 0;
  const newAmountPaid = invoice.amountPaid + amountCents;
  const newBalanceDue = Math.max(0, invoice.total - newAmountPaid);
  const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

  if (session.payment_status === "paid") {
    // Card payment — immediately settled
    await db
      .update(invoices)
      .set({
        status: newStatus,
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        paidAt: newStatus === "paid" ? new Date() : null,
        stripePaymentIntentId: paymentIntentId || null,
        paymentMethod: "card",
        achSettlementStatus: null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));

    await sendPaymentNotifications(invoice, amountCents, false);

    // Digital Rainmaker System auto-invoicing: if this paid invoice was the
    // DRS Initial Setup Fee, generate and send the Final Setup Fee + first
    // Monthly Subscription invoices (both due in 30 days).
    if (newStatus === "paid") {
      try {
        const [refreshed] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, invoice.id))
          .limit(1);
        if (refreshed) {
          await triggerDrsPostInitialPaid(refreshed);
        }
      } catch (err) {
        console.error("DRS post-paid trigger failed:", err);
      }
    }
  } else if (session.payment_status === "unpaid") {
    // ACH initiated — pending settlement
    await db
      .update(invoices)
      .set({
        status: newStatus,
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        paidAt: newStatus === "paid" ? new Date() : null,
        stripePaymentIntentId: paymentIntentId || null,
        paymentMethod: "ach",
        achSettlementStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));

    await sendPaymentNotifications(invoice, amountCents, true);
  }
}

// ── checkout.session.async_payment_succeeded ──
// ACH bank transfer completed successfully.
async function handleAsyncPaymentSucceeded(
  session: Stripe.Checkout.Session
) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  await db
    .update(invoices)
    .set({
      achSettlementStatus: "approved",
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  // Digital Rainmaker System auto-invoicing: ACH payments only count as
  // truly settled here. If the now-settled invoice is the DRS Initial Setup
  // Fee and is fully paid, kick off the Final + Monthly invoices.
  try {
    const [refreshed] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (refreshed && refreshed.status === "paid") {
      await triggerDrsPostInitialPaid(refreshed);
    }
  } catch (err) {
    console.error("DRS post-paid (ACH) trigger failed:", err);
  }
}

// ── checkout.session.async_payment_failed ──
// ACH bank transfer failed — reverse the payment.
async function handleAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) return;

  const failedAmountCents = session.amount_total ?? 0;
  const revertedAmountPaid = Math.max(
    0,
    invoice.amountPaid - failedAmountCents
  );
  const revertedBalanceDue = Math.max(0, invoice.total - revertedAmountPaid);
  const revertedStatus = revertedAmountPaid > 0 ? "partial" : "sent";

  await db
    .update(invoices)
    .set({
      achSettlementStatus: "declined",
      amountPaid: revertedAmountPaid,
      balanceDue: revertedBalanceDue,
      status: revertedStatus,
      paidAt: null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));
}

// ── Shared notification logic ──
async function sendPaymentNotifications(
  invoice: typeof invoices.$inferSelect,
  paymentAmountCents: number,
  isACH: boolean
) {
  const newAmountPaid = invoice.amountPaid + paymentAmountCents;
  const newBalanceDue = Math.max(0, invoice.total - newAmountPaid);
  const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

  // Email CPA
  try {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, invoice.ownerId))
      .limit(1);

    if (owner?.email) {
      const paidLabel =
        newStatus === "paid"
          ? formatCurrency(invoice.total, invoice.currency)
          : `${formatCurrency(paymentAmountCents, invoice.currency)} (partial — ${formatCurrency(newBalanceDue, invoice.currency)} remaining)`;

      const achNote = isACH ? " (ACH — pending settlement)" : "";

      const { subject, html } = buildInvoicePaidEmail({
        senderName: owner.name || owner.email,
        clientName: invoice.clientName,
        invoiceNumber: invoice.invoiceNumber,
        total: paidLabel + achNote,
        paidAt: new Date(),
      });
      await sendEmailWithLog({
        to: owner.email,
        subject,
        html,
        recipientName: owner.name || undefined,
        emailType: "invoice_paid",
        relatedId: invoice.id,
      });
    }
  } catch (err) {
    console.error("Failed to send invoice paid email:", err);
  }

  // Receipt to client
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
      .where(eq(users.id, invoice.ownerId))
      .limit(1);

    const senderLabel =
      owner?.companyName ||
      owner?.name ||
      owner?.email ||
      "Your Service Provider";

    const { subject: receiptSubject, html: receiptHtml } =
      buildPaymentReceiptEmail({
        clientName: invoice.clientName,
        senderName: senderLabel,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: formatCurrency(paymentAmountCents, invoice.currency),
        totalInvoice: formatCurrency(invoice.total, invoice.currency),
        remainingBalance:
          newBalanceDue > 0
            ? formatCurrency(newBalanceDue, invoice.currency)
            : null,
        paidAt: new Date(),
        portalUrl,
      });
    await sendEmailWithLog({
      to: invoice.clientEmail,
      subject: receiptSubject,
      html: receiptHtml,
      recipientName: invoice.clientName,
      emailType: "payment_receipt",
      relatedId: invoice.id,
    });
  } catch (err) {
    console.error("Failed to send payment receipt:", err);
  }

  // In-app notification
  try {
    await createNotification({
      userId: invoice.ownerId,
      type: "invoice_paid",
      title: "Invoice Paid",
      message: `${invoice.clientName} paid invoice ${invoice.invoiceNumber}${isACH ? " (ACH — pending settlement)" : ""}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
      },
    });
  } catch (err) {
    console.error("Invoice paid notification failed:", err);
  }

  // Sync to accounting
  syncPaymentToAccounting(invoice.id).catch((err) =>
    console.error("Accounting payment sync failed:", err)
  );
}
