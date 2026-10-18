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
import { and, eq, ne, sql } from "drizzle-orm";
import {
  sendEmailWithLog,
  buildInvoicePaidEmail,
  buildPaymentReceiptEmail,
  buildAutopayFailedEmail,
} from "@/lib/email";
import {
  formatCurrency,
  generateInvoiceNumber,
  generateInvoiceToken,
} from "@/lib/invoice-utils";
import { invoiceLineItems } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { getOwnerBranding } from "@/lib/branding";
import {
  autopayMetaOf,
  mergeAutopayEverywhere,
  type AutopayMeta,
  type AutopayMethod,
} from "@/lib/autopay";
import { syncPaymentToAccounting } from "@/lib/accounting-sync";
import { createNotification } from "@/lib/notifications";
import { onDrsInvoicePaid } from "@/lib/digital-rainmaker";
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

/** Pending one-time ACH payment, credited when the transfer settles. */
interface AchPending {
  paymentIntentId: string | null;
  amountCents: number;
}

function achPendingOf(invoice: typeof invoices.$inferSelect): AchPending | null {
  const m = invoice.metadata as { achPending?: unknown } | null;
  const p = m?.achPending as Partial<AchPending> | undefined;
  return p && typeof p === "object" && Number.isFinite(Number(p.amountCents))
    ? { paymentIntentId: p.paymentIntentId ?? null, amountCents: Number(p.amountCents) }
    : null;
}

// ── checkout.session.completed ──
// Subscription (DRS autopay) → handleAutopayCheckoutCompleted
// Card: payment_status === "paid" → done
// ACH:  payment_status === "unpaid" → pending settlement (credited on
//       checkout.session.async_payment_succeeded)
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  ctx: WebhookHandlerContext = {}
) {
  if (session.mode === "subscription") {
    await handleAutopayCheckoutCompleted(session);
    return;
  }

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

    // Digital Rainmaker: setup paid → onboarding opens; first monthly paid →
    // clear to launch ads. Never throws, but guard anyway.
    if (newStatus === "paid") {
      try {
        await onDrsInvoicePaid(invoice.id);
      } catch (err) {
        console.error("DRS paid hook failed:", err);
      }
    }
  } else if (session.payment_status === "unpaid") {
    // ACH initiated — pending settlement. Nothing is credited (status,
    // amountPaid, balanceDue unchanged) until the transfer settles;
    // metadata.achPending records what to credit then.
    const achPending: AchPending = {
      paymentIntentId: paymentIntentId || null,
      amountCents,
    };
    await db
      .update(invoices)
      .set({
        stripePaymentIntentId: paymentIntentId || null,
        stripeAccountId,
        paymentMethod: "ach",
        achSettlementStatus: "pending",
        metadata: sql`COALESCE(${invoices.metadata}, '{}'::jsonb) || jsonb_build_object('achPending', ${JSON.stringify(achPending)}::jsonb)`,
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
  if (session.mode === "subscription") {
    await handleAutopayAsyncSucceeded(session);
    return;
  }

  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  if (!(await accountMatchesInvoice(invoiceId, ctx))) return;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!invoice) return;

  const pending = achPendingOf(invoice);
  let settledStatus: string = invoice.status;
  if (pending) {
    // Credit the invoice now that the funds have settled. Conditional on
    // still being "pending" so a replayed event can't credit twice.
    const amountCents = pending.amountCents || invoicePortionCents(session);
    const newAmountPaid = invoice.amountPaid + amountCents;
    const newBalanceDue = Math.max(0, invoice.total - newAmountPaid);
    const newStatus = newBalanceDue <= 0 ? "paid" : "partial";
    const updated = await db
      .update(invoices)
      .set({
        status: newStatus,
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        paidAt: newStatus === "paid" ? new Date() : invoice.paidAt,
        achSettlementStatus: "approved",
        metadata: sql`${invoices.metadata} - 'achPending'`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(invoices.id, invoiceId), eq(invoices.achSettlementStatus, "pending"))
      )
      .returning({ status: invoices.status });
    if (updated.length === 0) return;
    settledStatus = updated[0].status;
  } else {
    // Legacy session (initiated before settle-on-success): the invoice was
    // already credited at initiation — just record the settlement.
    await db
      .update(invoices)
      .set({
        achSettlementStatus: "approved",
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));
  }

  // Funds settled — run the DRS paid hook now (never on ACH initiation).
  if (settledStatus === "paid") {
    try {
      await onDrsInvoicePaid(invoiceId);
    } catch (err) {
      console.error("DRS paid hook failed:", err);
    }
  }
}

// ── checkout.session.async_payment_failed ──
// ACH bank transfer failed — reverse the payment.
export async function handleAsyncPaymentFailed(
  session: Stripe.Checkout.Session,
  ctx: WebhookHandlerContext = {}
) {
  if (session.mode === "subscription") {
    await handleAutopayAsyncFailed(session);
    return;
  }

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

  // Settle-on-success flow: nothing was credited, so nothing to reverse.
  if (achPendingOf(invoice)) {
    await db
      .update(invoices)
      .set({
        achSettlementStatus: "declined",
        metadata: sql`${invoices.metadata} - 'achPending'`,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));
    return;
  }

  // Legacy session: the payment was credited at initiation — reverse it.
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
/**
 * Owner email + client receipt + in-app notification + accounting sync for a
 * payment of `paymentAmountCents`. `invoice` is the row as it was BEFORE the
 * payment was applied (paid/balance are recomputed from it). Also used by
 * the manual "mark paid" action (api/dashboard/invoices/[invoiceId]).
 */
export async function sendPaymentNotifications(
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

// ══════════════════════════════════════════════════════════
// Digital Rainmaker autopay (Checkout subscription mode, platform account)
// See lib/autopay.ts. Every handler logs and returns — never throws.
// ══════════════════════════════════════════════════════════

type InvoiceRow = typeof invoices.$inferSelect;

const idOf = (x: string | { id: string } | null | undefined): string | null =>
  !x ? null : typeof x === "string" ? x : x.id;

const methodOf = (v: unknown): AutopayMethod => (v === "card" ? "card" : "ach");

async function loadInvoice(id: string | null | undefined): Promise<InvoiceRow | null> {
  if (!id) return null;
  const [row] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return row ?? null;
}

async function findParentBySubscription(subscriptionId: string): Promise<InvoiceRow | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(sql`${invoices.metadata}->'autopay'->>'subscriptionId' = ${subscriptionId}`)
    .limit(1);
  return row ?? null;
}

/** Card checkout: the PaymentIntent behind the subscription's first invoice (best effort). */
async function firstPaymentIntentId(stripeInvoiceId: string | null): Promise<string | null> {
  if (!stripeInvoiceId) return null;
  try {
    const inv = await getStripe().invoices.retrieve(stripeInvoiceId, {
      expand: ["payments"],
    });
    const payment = inv.payments?.data?.[0]?.payment;
    return idOf(payment?.payment_intent ?? null);
  } catch (err) {
    console.error("Autopay: could not read the first invoice's PaymentIntent:", err);
    return null;
  }
}

/**
 * Settle the portal parent invoice (the first monthly) once its first
 * autopay charge is paid. Idempotent: the conditional update only wins once,
 * so checkout.session.completed (card) and invoice.paid (subscription_create)
 * can both call it.
 */
async function settleAutopayParent(
  invoiceId: string,
  method: AutopayMethod,
  opts: { baseCents?: number; paymentIntentId?: string | null } = {}
): Promise<void> {
  const invoice = await loadInvoice(invoiceId);
  if (!invoice || invoice.status === "paid") return;

  const outstanding = Math.max(0, invoice.total - invoice.amountPaid);
  const baseCents =
    opts.baseCents && opts.baseCents > 0 ? opts.baseCents : invoice.balanceDue || outstanding;
  const now = new Date();

  const updated = await db
    .update(invoices)
    .set({
      status: "paid",
      amountPaid: invoice.amountPaid + baseCents,
      balanceDue: 0,
      paidAt: now,
      paymentMethod: method,
      achSettlementStatus: method === "ach" ? "approved" : null,
      ...(opts.paymentIntentId ? { stripePaymentIntentId: opts.paymentIntentId } : {}),
      stripeAccountId: null,
      updatedAt: now,
    })
    .where(and(eq(invoices.id, invoiceId), ne(invoices.status, "paid")))
    .returning({ id: invoices.id });
  if (updated.length === 0) return;

  // Settled funds → no "pending settlement" wording.
  await sendPaymentNotifications(invoice, baseCents, false);
  try {
    await onDrsInvoicePaid(invoiceId);
  } catch (err) {
    console.error("DRS paid hook failed:", err);
  }
}

// ── checkout.session.completed (mode: subscription) ──
export async function handleAutopayCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const invoice = await loadInvoice(session.metadata?.invoiceId);
    if (!invoice) {
      console.error("Autopay checkout: no portal invoice for session", session.id);
      return;
    }
    const subscriptionId = idOf(session.subscription);
    const customerId = idOf(session.customer);
    const method = methodOf(session.metadata?.method);

    await mergeAutopayEverywhere(invoice, {
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(customerId ? { customerId } : {}),
      method,
      status: "active",
    });

    const baseCents = Number(session.metadata?.baseAmountCents);
    if (session.payment_status === "paid") {
      const paymentIntentId = await firstPaymentIntentId(idOf(session.invoice));
      await settleAutopayParent(invoice.id, "card", {
        baseCents: Number.isFinite(baseCents) ? baseCents : undefined,
        paymentIntentId,
      });
    } else if (session.payment_status === "unpaid") {
      // Bank transfer initiated — status stays as-is until invoice.paid.
      await db
        .update(invoices)
        .set({
          paymentMethod: "ach",
          achSettlementStatus: "pending",
          stripeAccountId: null,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, invoice.id), ne(invoices.status, "paid")));
    }
  } catch (err) {
    console.error("Autopay checkout.session.completed failed:", err);
  }
}

// ── checkout.session.async_payment_succeeded / _failed (mode: subscription) ──
async function handleAutopayAsyncSucceeded(session: Stripe.Checkout.Session) {
  try {
    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) return;
    const baseCents = Number(session.metadata?.baseAmountCents);
    await settleAutopayParent(invoiceId, methodOf(session.metadata?.method), {
      baseCents: Number.isFinite(baseCents) ? baseCents : undefined,
    });
  } catch (err) {
    console.error("Autopay async_payment_succeeded failed:", err);
  }
}

async function handleAutopayAsyncFailed(session: Stripe.Checkout.Session) {
  try {
    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) return;
    await db
      .update(invoices)
      .set({ achSettlementStatus: "declined", updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), ne(invoices.status, "paid")));
  } catch (err) {
    console.error("Autopay async_payment_failed failed:", err);
  }
}

// ── Stripe Invoice → portal parent ──

interface AutopayContext {
  parent: InvoiceRow;
  subscriptionId: string | null;
  method: AutopayMethod;
}

/**
 * Find the portal parent invoice for a Stripe subscription invoice. Reads
 * the subscription metadata snapshot from `parent.subscription_details`
 * (API ≥ 2025-03-31) or the legacy top-level `subscription` /
 * `subscription_details`, then falls back to retrieving the subscription,
 * then to the stored subscription id. Null = not a DRS autopay invoice.
 */
async function resolveAutopayContext(inv: Stripe.Invoice): Promise<AutopayContext | null> {
  const legacy = inv as unknown as {
    subscription?: string | { id: string } | null;
    subscription_details?: { metadata?: Stripe.Metadata | null } | null;
  };
  const details = inv.parent?.subscription_details ?? null;
  const subscriptionId = idOf(details?.subscription ?? legacy.subscription ?? null);
  if (!subscriptionId) return null;

  let meta: Stripe.Metadata | null =
    details?.metadata ?? legacy.subscription_details?.metadata ?? null;
  if (!meta?.invoiceId) {
    try {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      meta = sub.metadata ?? null;
    } catch (err) {
      console.error(`Autopay: could not retrieve subscription ${subscriptionId}:`, err);
    }
  }

  const parent =
    (await loadInvoice(meta?.invoiceId)) ?? (await findParentBySubscription(subscriptionId));
  if (!parent) return null;
  if (!meta?.invoiceId && !autopayMetaOf(parent)) return null;

  const method = methodOf(meta?.method ?? autopayMetaOf(parent)?.method);
  return { parent, subscriptionId, method };
}

/** End of the period this Stripe invoice paid for (= next charge date). */
function paidThrough(inv: Stripe.Invoice): string | null {
  const ends = (inv.lines?.data ?? [])
    .map((l) => l.period?.end)
    .filter((n): n is number => typeof n === "number");
  const end = ends.length > 0 ? Math.max(...ends) : null;
  return end ? new Date(end * 1000).toISOString() : null;
}

// ── invoice.paid ──
export async function handleStripeInvoicePaid(inv: Stripe.Invoice) {
  try {
    const ctx = await resolveAutopayContext(inv);
    if (!ctx) return;
    const { parent, subscriptionId, method } = ctx;

    if (inv.billing_reason === "subscription_create") {
      await settleAutopayParent(parent.id, method);
    } else if (inv.billing_reason === "subscription_cycle") {
      await recordAutopayCharge(parent, inv, method);
    }

    const currentPeriodEnd = paidThrough(inv);
    const customerId = idOf(inv.customer);
    const patch: AutopayMeta = {
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(customerId ? { customerId } : {}),
      method,
      status: "active",
      ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
    };
    await mergeAutopayEverywhere(parent, patch);
  } catch (err) {
    console.error("Autopay invoice.paid failed:", err);
  }
}

/**
 * A monthly autopay charge succeeded: record it as a new, already-paid
 * portal invoice (the client's receipt). Idempotent on the Stripe invoice id.
 */
async function recordAutopayCharge(parent: InvoiceRow, inv: Stripe.Invoice, method: AutopayMethod) {
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(sql`${invoices.metadata}->>'stripeInvoiceId' = ${inv.id}`)
    .limit(1);
  if (existing) return;

  const parentLines = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, parent.id));
  const baseCents = parent.total; // listed (ACH) price; card price never inflates amountPaid
  const now = new Date();
  const parentMeta = (parent.metadata ?? {}) as Record<string, unknown>;
  const label = method === "card" ? "Card" : "Bank transfer";

  const [row] = await db
    .insert(invoices)
    .values({
      ownerId: parent.ownerId,
      clientName: parent.clientName,
      clientEmail: parent.clientEmail,
      clientPhone: parent.clientPhone,
      clientCompany: parent.clientCompany,
      invoiceNumber: await generateInvoiceNumber(),
      token: generateInvoiceToken(),
      status: "paid",
      currency: parent.currency,
      subtotal: parent.subtotal,
      taxRate: parent.taxRate,
      taxAmount: parent.taxAmount,
      total: parent.total,
      issueDate: now,
      dueDate: now,
      notes: `Charged automatically via autopay (${label}).`,
      terms: parent.terms,
      amountPaid: baseCents,
      balanceDue: 0,
      paymentMethod: method,
      achSettlementStatus: method === "ach" ? "approved" : null,
      isRecurring: false,
      recurringParentId: parent.id,
      metadata: { ...parentMeta, stripeInvoiceId: inv.id, autopayCharge: true },
      sentAt: now,
      paidAt: now,
    })
    .returning();

  if (parentLines.length > 0) {
    await db.insert(invoiceLineItems).values(
      parentLines.map((item) => ({
        invoiceId: row.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        billingType: item.billingType,
        order: item.order,
      }))
    );
  }

  // Receipt to the client + owner notification (row as it was before payment).
  await sendPaymentNotifications({ ...row, amountPaid: 0, balanceDue: row.total }, baseCents, false);
}

// ── invoice.payment_failed / invoice.payment_action_required ──
async function emailClientAutopayProblem(
  parent: InvoiceRow,
  inv: Stripe.Invoice,
  reason: "failed" | "action_required"
) {
  try {
    const branding = await getOwnerBranding(parent.ownerId);
    const { subject, html } = buildAutopayFailedEmail({
      clientName: parent.clientName,
      amount: formatCurrency(inv.amount_due, inv.currency || parent.currency),
      payUrl: inv.hosted_invoice_url ?? null,
      reason,
      branding,
    });
    await sendEmailWithLog({
      to: parent.clientEmail,
      subject,
      html,
      fromName: branding.fromName,
      recipientName: parent.clientName,
      emailType: reason === "failed" ? "autopay_failed" : "autopay_action_required",
      relatedId: parent.id,
    });
  } catch (err) {
    console.error("Autopay client email failed:", err);
  }
}

export async function handleStripeInvoicePaymentFailed(inv: Stripe.Invoice) {
  try {
    const ctx = await resolveAutopayContext(inv);
    if (!ctx) return;
    const { parent } = ctx;

    await mergeAutopayEverywhere(parent, { status: "past_due" });
    if (inv.billing_reason === "subscription_create") {
      await db
        .update(invoices)
        .set({ achSettlementStatus: ctx.method === "ach" ? "declined" : null, updatedAt: new Date() })
        .where(and(eq(invoices.id, parent.id), ne(invoices.status, "paid")));
    }

    try {
      await createNotification({
        userId: parent.ownerId,
        type: "autopay_failed",
        title: "Autopay failed",
        message: `Autopay failed for ${parent.clientName} (${formatCurrency(inv.amount_due, inv.currency || parent.currency)}) — Stripe will retry`,
        metadata: {
          invoiceId: parent.id,
          invoiceNumber: parent.invoiceNumber,
          clientName: parent.clientName,
          stripeInvoiceId: inv.id,
        },
      });
    } catch (err) {
      console.error("Autopay failed notification failed:", err);
    }

    await emailClientAutopayProblem(parent, inv, "failed");
  } catch (err) {
    console.error("Autopay invoice.payment_failed failed:", err);
  }
}

export async function handleStripeInvoicePaymentActionRequired(inv: Stripe.Invoice) {
  try {
    const ctx = await resolveAutopayContext(inv);
    if (!ctx) return;
    await emailClientAutopayProblem(ctx.parent, inv, "action_required");
  } catch (err) {
    console.error("Autopay invoice.payment_action_required failed:", err);
  }
}

// ── customer.subscription.updated / .deleted ──
export async function handleAutopaySubscriptionChanged(
  sub: Stripe.Subscription,
  deleted: boolean
) {
  try {
    const parent =
      (await loadInvoice(sub.metadata?.invoiceId)) ?? (await findParentBySubscription(sub.id));
    if (!parent) return;
    if (!sub.metadata?.autopay && !autopayMetaOf(parent)) return;

    const periodEnd = sub.items?.data?.[0]?.current_period_end;
    const patch: AutopayMeta = {
      subscriptionId: sub.id,
      status: deleted ? "canceled" : sub.status,
      ...(typeof periodEnd === "number" && !deleted
        ? { currentPeriodEnd: new Date(periodEnd * 1000).toISOString() }
        : {}),
      ...(deleted || sub.canceled_at
        ? { canceledAt: new Date((sub.canceled_at ?? Date.now() / 1000) * 1000).toISOString() }
        : {}),
    };
    await mergeAutopayEverywhere(parent, patch);

    if (deleted) {
      try {
        await createNotification({
          userId: parent.ownerId,
          type: "autopay_canceled",
          title: "Autopay canceled",
          message: `${parent.clientName}'s Digital Rainmaker autopay subscription was canceled in Stripe — monthly charges have stopped.`,
          metadata: {
            invoiceId: parent.id,
            invoiceNumber: parent.invoiceNumber,
            clientName: parent.clientName,
            subscriptionId: sub.id,
          },
        });
      } catch (err) {
        console.error("Autopay canceled notification failed:", err);
      }
    }
  } catch (err) {
    console.error("Autopay subscription change failed:", err);
  }
}
