/**
 * Digital Rainmaker autopay (server-only).
 *
 * The first recurring DRS invoice (drsRole "platform_monthly" $9,997 or
 * "ad_spend_monthly" $5,000, created at Build complete) is paid through a
 * Stripe Checkout Session in SUBSCRIPTION mode instead of a one-time payment.
 * The client picks bank (ACH) or card once; Stripe saves that method and
 * charges it every month at that method's price (dual pricing: ACH = the
 * listed price, card = cardPriceCents per line). The method is locked — the
 * client can update details of the same type through the Stripe Customer
 * Portal; switching type goes through Marcel.
 *
 * State lives in `invoices.metadata.autopay` on the portal parent invoice
 * (mirrored onto `engagements.metadata.autopay`):
 *   { subscriptionId, customerId, method, status, currentPeriodEnd? }
 * Webhooks (lib/payments-webhook-handlers.ts) keep it in sync; each monthly
 * charge becomes a new, already-paid portal invoice row (a receipt) and the
 * recurring cron skips parents that have a subscription.
 */
import type Stripe from "stripe";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { engagements, invoices } from "@/db/schema";
import { getStripe, resolveStripeAccountForOwner } from "@/lib/stripe";
import { cardPriceCents } from "@/lib/drs-pricing";

export const AUTOPAY_ROLES = ["platform_monthly", "ad_spend_monthly"] as const;
export type AutopayRole = (typeof AUTOPAY_ROLES)[number];
export type AutopayMethod = "ach" | "card";

type InvoiceRow = typeof invoices.$inferSelect;

/** Shape of `metadata.autopay` on the parent invoice and the engagement. */
export interface AutopayMeta {
  subscriptionId?: string;
  customerId?: string;
  method?: AutopayMethod;
  /** Stripe subscription status (active, past_due, canceled, …). */
  status?: string;
  /** ISO end of the current paid period = next charge date. */
  currentPeriodEnd?: string;
  canceledAt?: string;
}

export type AutopayInfo = {
  eligible: boolean;
  active: boolean;
  method: AutopayMethod | null;
  monthlyAchCents: number;
  monthlyCardCents: number;
  nextChargeDate: string | null;
  status: string | null;
};

/** Subscription statuses that mean "autopay is no longer running". */
const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);

function metaOf(invoice: Pick<InvoiceRow, "metadata">): Record<string, unknown> {
  const m = invoice.metadata;
  return m && typeof m === "object" ? (m as Record<string, unknown>) : {};
}

export function autopayMetaOf(
  invoice: Pick<InvoiceRow, "metadata">
): AutopayMeta | null {
  const a = metaOf(invoice).autopay;
  return a && typeof a === "object" ? (a as AutopayMeta) : null;
}

/** True when an autopay subscription exists and hasn't ended. */
export function hasLiveAutopay(invoice: Pick<InvoiceRow, "metadata">): boolean {
  const a = autopayMetaOf(invoice);
  return Boolean(a?.subscriptionId) && !ENDED_STATUSES.has(a?.status ?? "");
}

/**
 * Pure part of eligibility: the portal parent of a DRS launch invoice that
 * isn't settled and has no running subscription. Monthly receipts created by
 * autopay (metadata.autopayCharge) and cron roll-forward copies
 * (recurringParentId) are never eligible.
 */
function isAutopayCandidate(invoice: InvoiceRow): boolean {
  const meta = metaOf(invoice);
  const role = meta.drsRole;
  if (typeof role !== "string" || !(AUTOPAY_ROLES as readonly string[]).includes(role)) {
    return false;
  }
  if (meta.autopayCharge) return false;
  if (invoice.recurringParentId) return false;
  if (["paid", "void", "canceled"].includes(invoice.status)) return false;
  if (hasLiveAutopay(invoice)) return false;
  return true;
}

/**
 * Should this invoice be paid via an autopay subscription? DRS launch role,
 * billed on the platform (Nexli) account, not already on autopay, and not
 * paid / void / canceled.
 */
export async function isAutopayEligible(invoice: InvoiceRow): Promise<boolean> {
  if (!isAutopayCandidate(invoice)) return false;
  const resolution = await resolveStripeAccountForOwner(invoice.ownerId);
  return resolution.mode === "platform" && !resolution.stripeAccount;
}

/**
 * What the invoice page shows about autopay. Pure — reads the invoice row
 * (and its line items for the card price), never calls Stripe. `eligible`
 * here is the role/status check only; the checkout route re-checks the
 * Stripe account server-side.
 */
export function getAutopayInfo(
  invoice: InvoiceRow,
  lineItems: { amount: number }[]
): AutopayInfo {
  const a = autopayMetaOf(invoice);
  const monthlyAchCents =
    lineItems.length > 0
      ? lineItems.reduce((s, l) => s + l.amount, 0)
      : invoice.total;
  const monthlyCardCents =
    lineItems.length > 0
      ? lineItems.reduce((s, l) => s + cardPriceCents(l.amount), 0)
      : cardPriceCents(invoice.total);
  const active = hasLiveAutopay(invoice);
  return {
    eligible: isAutopayCandidate(invoice),
    active,
    method: a?.method === "ach" || a?.method === "card" ? a.method : null,
    monthlyAchCents,
    monthlyCardCents,
    nextChargeDate: active && a?.currentPeriodEnd ? a.currentPeriodEnd : null,
    status: a?.status ?? null,
  };
}

/**
 * Stripe Checkout in subscription mode: one monthly price per invoice line at
 * the chosen method's price, payment method type locked to that method.
 */
export async function createAutopayCheckout(params: {
  invoice: InvoiceRow;
  lineItems: { description: string; amount: number }[];
  method: AutopayMethod;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const { invoice, method } = params;
  const stripe = getStripe();
  const meta = metaOf(invoice);

  const lines =
    params.lineItems.length > 0
      ? params.lineItems
      : [{ description: `Invoice ${invoice.invoiceNumber}`, amount: invoice.total }];

  const metadata: Record<string, string> = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    engagementId: typeof meta.engagementId === "string" ? meta.engagementId : "",
    drsRole: typeof meta.drsRole === "string" ? meta.drsRole : "",
    method,
    baseAmountCents: String(invoice.balanceDue ?? invoice.total),
    autopay: "1",
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: [method === "card" ? "card" : "us_bank_account"],
    customer_email: invoice.clientEmail,
    line_items: lines.map((line) => ({
      price_data: {
        currency: invoice.currency,
        unit_amount: method === "card" ? cardPriceCents(line.amount) : line.amount,
        recurring: { interval: "month" },
        product_data: { name: line.description },
      },
      quantity: 1,
    })),
    metadata,
    subscription_data: {
      metadata,
      description: "Digital Rainmaker System — monthly autopay",
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };
  if (method === "ach") {
    sessionParams.payment_method_options = {
      us_bank_account: { verification_method: "automatic" },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { sessionId: session.id, checkoutUrl: session.url };
}

/** Stripe Customer Portal session (update payment details, invoice history). */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

// ── metadata.autopay persistence (jsonb merge, never clobbers siblings) ──

/** Merge `patch` into invoices.metadata.autopay. */
export async function mergeInvoiceAutopay(
  invoiceId: string,
  patch: AutopayMeta
): Promise<void> {
  const json = JSON.stringify(patch);
  await db
    .update(invoices)
    .set({
      metadata: sql`jsonb_set(COALESCE(${invoices.metadata}, '{}'::jsonb), '{autopay}', COALESCE(${invoices.metadata}->'autopay', '{}'::jsonb) || ${json}::jsonb, true)`,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));
}

/** Merge `patch` into engagements.metadata.autopay. */
export async function mergeEngagementAutopay(
  engagementId: string,
  patch: AutopayMeta
): Promise<void> {
  const json = JSON.stringify(patch);
  await db
    .update(engagements)
    .set({
      metadata: sql`jsonb_set(COALESCE(${engagements.metadata}, '{}'::jsonb), '{autopay}', COALESCE(${engagements.metadata}->'autopay', '{}'::jsonb) || ${json}::jsonb, true)`,
      updatedAt: new Date(),
    })
    .where(eq(engagements.id, engagementId));
}

/** Merge into the parent invoice and (when known) its engagement. Never throws. */
export async function mergeAutopayEverywhere(
  invoice: Pick<InvoiceRow, "id" | "metadata">,
  patch: AutopayMeta
): Promise<void> {
  try {
    await mergeInvoiceAutopay(invoice.id, patch);
    const engagementId = metaOf(invoice).engagementId;
    if (typeof engagementId === "string" && engagementId) {
      await mergeEngagementAutopay(engagementId, patch);
    }
  } catch (err) {
    console.error(`Autopay: metadata merge failed for invoice ${invoice.id}:`, err);
  }
}
