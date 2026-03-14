import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { users, subscriptions, invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type Stripe from "stripe";
import { sendEmailWithLog, buildInvoicePaidEmail, buildPaymentReceiptEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/invoice-utils";
import { syncPaymentToAccounting } from "@/lib/accounting-sync";
import { createNotification } from "@/lib/notifications";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_PORTAL!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.nexli_invoice_id) {
        await handleInvoicePayment(session);
      } else {
        await handleCheckoutCompleted(session);
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const rawEmail = session.customer_details?.email;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!rawEmail) return;

  const customerEmail = rawEmail.toLowerCase().trim();

  // Check for existing user
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, customerEmail))
    .limit(1);

  let userId: string;

  if (existing[0]) {
    // Link Stripe customer to existing user
    await db
      .update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(users.id, existing[0].id));
    userId = existing[0].id;
  } else {
    // Create new client account with a random temporary password
    const tempPassword = crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const newUser = await db
      .insert(users)
      .values({
        email: customerEmail,
        name: session.customer_details?.name || null,
        hashedPassword,
        role: "client",
        stripeCustomerId: customerId,
      })
      .returning({ id: users.id });

    userId = newUser[0].id;

    // TODO: Send welcome email via GoHighLevel with password reset link
  }

  // Create subscription record
  if (subscriptionId) {
    const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId);
    const firstItem = stripeSub.items.data[0];
    await db
      .insert(subscriptions)
      .values({
        userId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: firstItem?.price.id || "",
        status: "active",
        currentPeriodStart: firstItem
          ? new Date(firstItem.current_period_start * 1000)
          : null,
        currentPeriodEnd: firstItem
          ? new Date(firstItem.current_period_end * 1000)
          : null,
      })
      .onConflictDoNothing({ target: subscriptions.stripeSubscriptionId });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const statusMap: Record<string, typeof subscriptions.$inferInsert.status> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    trialing: "trialing",
    unpaid: "unpaid",
  };

  const firstItem = subscription.items.data[0];
  await db
    .update(subscriptions)
    .set({
      status: statusMap[subscription.status] || "active",
      currentPeriodStart: firstItem
        ? new Date(firstItem.current_period_start * 1000)
        : null,
      currentPeriodEnd: firstItem
        ? new Date(firstItem.current_period_end * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
}

async function handleInvoicePayment(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata!.nexli_invoice_id;
  const isPartial = session.metadata?.is_partial_payment === "true";

  // Fetch the current invoice first
  const [currentInvoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!currentInvoice) return;

  let paymentAmount: number;
  let newAmountPaid: number;
  let newBalanceDue: number;
  let newStatus: "paid" | "partial";

  if (isPartial) {
    paymentAmount = parseInt(session.metadata!.payment_amount_cents, 10);
    newAmountPaid = currentInvoice.amountPaid + paymentAmount;
    newBalanceDue = currentInvoice.total - newAmountPaid;
    newStatus = newBalanceDue <= 0 ? "paid" : "partial";
  } else {
    // Full payment
    paymentAmount = currentInvoice.total;
    newAmountPaid = currentInvoice.total;
    newBalanceDue = 0;
    newStatus = "paid";
  }

  const [invoice] = await db
    .update(invoices)
    .set({
      status: newStatus,
      amountPaid: newAmountPaid,
      balanceDue: Math.max(0, newBalanceDue),
      paidAt: newStatus === "paid" ? new Date() : null,
      stripePaymentIntentId: session.payment_intent as string,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  if (!invoice) return;

  try {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, invoice.ownerId))
      .limit(1);

    if (owner?.email) {
      const paidLabel = newStatus === "paid"
        ? formatCurrency(invoice.total, invoice.currency)
        : `${formatCurrency(paymentAmount, invoice.currency)} (partial — ${formatCurrency(newBalanceDue, invoice.currency)} remaining)`;
      const { subject, html } = buildInvoicePaidEmail({
        senderName: owner.name || owner.email,
        clientName: invoice.clientName,
        invoiceNumber: invoice.invoiceNumber,
        total: paidLabel,
        paidAt: new Date(),
      });
      await sendEmailWithLog({ to: owner.email, subject, html, recipientName: owner.name || undefined, emailType: "invoice_paid", relatedId: invoice.id });
    }
  } catch (err) {
    console.error("Failed to send invoice paid email:", err);
  }

  // Send payment receipt to the client
  try {
    const portalUrl =
      process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

    const [owner] = await db
      .select({ name: users.name, email: users.email, companyName: users.companyName })
      .from(users)
      .where(eq(users.id, invoice.ownerId))
      .limit(1);

    const senderLabel = owner?.companyName || owner?.name || owner?.email || "Your Service Provider";

    const { subject: receiptSubject, html: receiptHtml } = buildPaymentReceiptEmail({
      clientName: invoice.clientName,
      senderName: senderLabel,
      invoiceNumber: invoice.invoiceNumber,
      amountPaid: formatCurrency(paymentAmount, invoice.currency),
      totalInvoice: formatCurrency(invoice.total, invoice.currency),
      remainingBalance: newBalanceDue > 0
        ? formatCurrency(newBalanceDue, invoice.currency)
        : null,
      paidAt: new Date(),
      portalUrl,
    });
    await sendEmailWithLog({ to: invoice.clientEmail, subject: receiptSubject, html: receiptHtml, recipientName: invoice.clientName, emailType: "payment_receipt", relatedId: invoice.id });
  } catch (err) {
    console.error("Failed to send payment receipt to client:", err);
  }

  // In-app notification
  createNotification({
    userId: invoice.ownerId,
    type: "invoice_paid",
    title: "Invoice Paid",
    message: `${invoice.clientName} paid invoice ${invoice.invoiceNumber}`,
    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, clientName: invoice.clientName },
  }).catch((err) => console.error("Invoice paid notification failed:", err));

  // Sync payment to accounting software (non-blocking)
  syncPaymentToAccounting(invoiceId).catch((err) =>
    console.error("Accounting payment sync failed:", err)
  );
}
