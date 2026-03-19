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

  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);

    case "invoice.paid":
      return handleInvoicePaid(event.data.object as Stripe.Invoice);

    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);

    case "customer.subscription.updated":
      return handleSubscriptionUpdated(event.data.object as Stripe.Subscription);

    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);

    default:
      return NextResponse.json({ received: true });
  }
}

// ── checkout.session.completed ─────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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

  // For subscription checkouts, store subscription + customer IDs
  if (session.mode === "subscription") {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

    await db
      .update(invoices)
      .set({
        stripeSubscriptionId: subscriptionId || null,
        stripeCustomerId: customerId || null,
        subscriptionStatus: "active",
        stripeCheckoutSessionId: session.id,
        status: "paid",
        amountPaid: invoice.total,
        balanceDue: 0,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));

    // Send emails and notifications for subscription start
    await sendPaymentNotifications(invoice, invoice.total, "paid", 0);

    return NextResponse.json({ received: true });
  }

  // For one-time payment checkouts (existing flow)
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  // Idempotency: skip if already processed this payment intent
  if (invoice.stripePaymentIntentId === paymentIntentId) {
    return NextResponse.json({ received: true });
  }

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

  await db
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
    .where(eq(invoices.id, invoice.id));

  await sendPaymentNotifications(invoice, paymentAmountCents, newStatus, newBalanceDue);

  // Sync payment to accounting software (non-blocking)
  syncPaymentToAccounting(invoice.id).catch((err) =>
    console.error("Accounting payment sync failed:", err)
  );

  return NextResponse.json({ received: true });
}

// ── invoice.paid (subscription renewals) ───────────────────
async function handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
  const sub = stripeInvoice.parent?.subscription_details?.subscription;
  const subscriptionId =
    typeof sub === "string" ? sub : sub?.id;

  if (!subscriptionId) {
    // Not a subscription invoice — skip (checkout.session.completed handles one-time)
    return NextResponse.json({ received: true });
  }

  // Find our invoice by stripeSubscriptionId
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!invoice) {
    console.error(`Stripe webhook invoice.paid: no invoice found for subscription ${subscriptionId}`);
    return NextResponse.json({ received: true });
  }

  const paymentAmountCents = stripeInvoice.amount_paid || 0;

  // Update payment tracking
  const newAmountPaid = invoice.amountPaid + paymentAmountCents;
  await db
    .update(invoices)
    .set({
      amountPaid: newAmountPaid,
      subscriptionStatus: "active",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));

  // Send payment notifications
  await sendPaymentNotifications(invoice, paymentAmountCents, "paid", 0);

  return NextResponse.json({ received: true });
}

// ── invoice.payment_failed ─────────────────────────────────
async function handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
  const sub = stripeInvoice.parent?.subscription_details?.subscription;
  const subscriptionId =
    typeof sub === "string" ? sub : sub?.id;

  if (!subscriptionId) {
    return NextResponse.json({ received: true });
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ received: true });
  }

  await db
    .update(invoices)
    .set({
      subscriptionStatus: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));

  // Notify CPA about failed payment
  try {
    await createNotification({
      userId: invoice.ownerId,
      type: "invoice_paid",
      title: "Payment Failed",
      message: `Payment failed for ${invoice.clientName}'s subscription (Invoice ${invoice.invoiceNumber}). Stripe will retry automatically.`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
      },
    });
  } catch (err) {
    console.error("Payment failed notification error:", err);
  }

  return NextResponse.json({ received: true });
}

// ── customer.subscription.updated ──────────────────────────
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const invoiceId = subscription.metadata?.invoiceId;

  // Try to find by metadata first, then by subscriptionId
  let invoice;
  if (invoiceId) {
    [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
  }
  if (!invoice) {
    [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.stripeSubscriptionId, subscription.id))
      .limit(1);
  }
  if (!invoice) {
    return NextResponse.json({ received: true });
  }

  // Map Stripe subscription status to our status
  let subscriptionStatus: string;
  switch (subscription.status) {
    case "active":
      subscriptionStatus = "active";
      break;
    case "past_due":
      subscriptionStatus = "past_due";
      break;
    case "canceled":
      subscriptionStatus = "canceled";
      break;
    case "unpaid":
      subscriptionStatus = "unpaid";
      break;
    default:
      subscriptionStatus = subscription.status;
  }

  await db
    .update(invoices)
    .set({
      subscriptionStatus,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));

  return NextResponse.json({ received: true });
}

// ── customer.subscription.deleted ──────────────────────────
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ received: true });
  }

  await db
    .update(invoices)
    .set({
      subscriptionStatus: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));

  // Notify CPA
  try {
    await createNotification({
      userId: invoice.ownerId,
      type: "invoice_paid",
      title: "Subscription Canceled",
      message: `${invoice.clientName}'s subscription for Invoice ${invoice.invoiceNumber} has been canceled.`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
      },
    });
  } catch (err) {
    console.error("Subscription canceled notification error:", err);
  }

  return NextResponse.json({ received: true });
}

// ── Shared: send payment notifications ─────────────────────
async function sendPaymentNotifications(
  invoice: typeof invoices.$inferSelect,
  paymentAmountCents: number,
  newStatus: string,
  newBalanceDue: number
) {
  // Send notification email to CPA
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

      const { subject, html } = buildInvoicePaidEmail({
        senderName: owner.name || owner.email,
        clientName: invoice.clientName,
        invoiceNumber: invoice.invoiceNumber,
        total: paidLabel,
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
      message: `${invoice.clientName} paid invoice ${invoice.invoiceNumber}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
      },
    });
  } catch (err) {
    console.error("Invoice paid notification failed:", err);
  }
}
