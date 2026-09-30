/**
 * Shared Stripe Checkout webhook handlers.
 *
 * Used by both the platform-account endpoint (/api/webhooks/payments) and the
 * Connect endpoint (/api/webhooks/connect). Behavior is identical; when a
 * `stripeAccount` is supplied (Connect direct charges), any follow-up Stripe
 * API call is scoped to that connected account via `{ stripeAccount }`.
 */
import { db } from "@/db";
import { invoices, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  sendEmailWithLog,
  buildInvoicePaidEmail,
  buildPaymentReceiptEmail,
} from "@/lib/email";
import { formatCurrency } from "@/lib/invoice-utils";
import { syncPaymentToAccounting } from "@/lib/accounting-sync";
import { createNotification } from "@/lib/notifications";
import type Stripe from "stripe";

/**
 * Amount to credit against the invoice. Card sessions charge the card price
 * (dual pricing), so `amount_total` exceeds the invoice balance at its listed
 * ACH price — `baseAmountCents` in the session metadata is the true invoice
 * portion. Falls back to `amount_total` for sessions created before dual
 * pricing existed.
 */
function invoicePortionCents(session: Stripe.Checkout.Session): number {
  const base = Number(session.metadata?.baseAmountCents);
  return Number.isFinite(base) && base > 0 ? base : session.amount_total ?? 0;
}

export interface WebhookHandlerContext {
  /** Connected account the event originated on (acct_...). Undefined = platform. */
  stripeAccount?: string | null;
}

/**
 * Request options to pass to any Stripe SDK call made while handling an
 * event. Returns undefined for platform-account events.
 */
export function stripeRequestOptions(
  ctx?: WebhookHandlerContext
): Stripe.RequestOptions | undefined {
  return ctx?.stripeAccount ? { stripeAccount: ctx.stripeAccount } : undefined;
}

/**
 * For Connect events, ensure the event's account matches the account the
 * invoice's checkout was created on. Returns true when OK (or not applicable).
 */
async function accountMatchesInvoice(
  invoiceId: string,
  ctx: WebhookHandlerContext
): Promise<boolean> {
  if (!ctx.stripeAccount) return true;
  const [row] = await db
    .select({ stripeAccountId: invoices.stripeAccountId })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!row) return false;
  if (row.stripeAccountId && row.stripeAccountId !== ctx.stripeAccount) {
    console.error(
      `Stripe webhook: account mismatch for invoice ${invoiceId} (event ${ctx.stripeAccount}, invoice ${row.stripeAccountId})`
    );
    return false;
  }
  return true;
}

// ── checkout.session.completed ──
// Card: payment_status === "paid" → done
// ACH:  payment_status === "unpaid" → pending settlement
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  ctx: WebhookHandlerContext = {}
) {
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

  // Guard: a Connect event must match the account the checkout was created on.
  if (
    ctx.stripeAccount &&
    invoice.stripeAccountId &&
    invoice.stripeAccountId !== ctx.stripeAccount
  ) {
    console.error(
      `Stripe webhook: account mismatch for invoice ${invoiceId} (event ${ctx.stripeAccount}, invoice ${invoice.stripeAccountId})`
    );
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

  const amountCents = invoicePortionCents(session);
  const newAmountPaid = invoice.amountPaid + amountCents;
  const newBalanceDue = Math.max(0, invoice.total - newAmountPaid);
  const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

  // Persist the account the charge landed on (null = platform).
  const stripeAccountId = ctx.stripeAccount ?? invoice.stripeAccountId ?? null;

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
        stripeAccountId,
        paymentMethod: "card",
        achSettlementStatus: null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));

    await sendPaymentNotifications(invoice, amountCents, false);
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
        stripeAccountId,
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
export async function handleAsyncPaymentSucceeded(
  session: Stripe.Checkout.Session,
  ctx: WebhookHandlerContext = {}
) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  if (!(await accountMatchesInvoice(invoiceId, ctx))) return;

  await db
    .update(invoices)
    .set({
      achSettlementStatus: "approved",
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));
}

// ── checkout.session.async_payment_failed ──
// ACH bank transfer failed — reverse the payment.
export async function handleAsyncPaymentFailed(
  session: Stripe.Checkout.Session,
  ctx: WebhookHandlerContext = {}
) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) return;

  if (
    ctx.stripeAccount &&
    invoice.stripeAccountId &&
    invoice.stripeAccountId !== ctx.stripeAccount
  ) {
    console.error(
      `Stripe webhook: account mismatch for invoice ${invoiceId} (event ${ctx.stripeAccount}, invoice ${invoice.stripeAccountId})`
    );
    return;
  }

  const failedAmountCents = invoicePortionCents(session);
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
