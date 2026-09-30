import Stripe from "stripe";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Platform fee taken on direct charges made on a connected account, in cents.
 *
 * Currently 0: the CPA firm keeps the full amount (minus Stripe's own
 * processing fees). To start collecting a platform fee, set this to a
 * non-zero value (or compute it per-invoice) and it will be passed as
 * `payment_intent_data.application_fee_amount` on the Checkout Session.
 * Application fees are only valid on direct charges to a connected account;
 * they are never applied to platform-account (Nexli) invoices.
 */
export const PLATFORM_FEE_CENTS = 0;

/**
 * Creates a Stripe Checkout Session for an invoice.
 *
 * Dual pricing: the client chooses the payment method up front (two buttons
 * on the invoice page, each showing its all-in price) because a single
 * Checkout Session can't vary its total by which method the customer picks:
 * - "ach"  → us_bank_account, charged the discounted bank transfer price
 * - "card" → card, charged the card price
 *
 * Each session has ONE line item at that method's price — never a base price
 * plus a fee line — which is the surcharge-law-safe presentation.
 *
 * The webhook credits the invoice by `baseAmountCents` from metadata (the
 * ACH-listed invoice balance) so the card price never inflates `amountPaid`.
 *
 * When `stripeAccount` is provided, the session is created as a direct charge
 * on that connected account (the firm is merchant of record: Stripe fees,
 * disputes and 1099-K reporting sit with the firm).
 */
export async function createCheckoutSession(params: {
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string;
  /** Invoice balance at the listed (ACH) price — credited on payment. */
  amountCents: number;
  /** Amount actually charged: card price for card, equal to amountCents for ACH. */
  chargeCents: number;
  method: "ach" | "card";
  currency: string;
  successUrl: string;
  cancelUrl: string;
  /** Connected account id (acct_...) for a direct charge. Omit for platform. */
  stripeAccount?: string;
}): Promise<{
  sessionId: string;
  checkoutUrl: string;
  stripeAccount: string | null;
}> {
  const stripe = getStripe();

  const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
    params.method === "card" ? ["card"] : ["us_bank_account"];

  const metadata = {
    invoiceId: params.invoiceId,
    invoiceNumber: params.invoiceNumber,
    baseAmountCents: String(params.amountCents),
  };

  const stripeAccount = params.stripeAccount ?? null;

  const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData =
    { metadata };

  // Platform fee plumbing — only meaningful on a connected-account direct charge.
  if (stripeAccount && PLATFORM_FEE_CENTS > 0) {
    paymentIntentData.application_fee_amount = PLATFORM_FEE_CENTS;
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: paymentMethodTypes,
    customer_email: params.clientEmail,
    line_items: [
      {
        price_data: {
          currency: params.currency,
          unit_amount: params.chargeCents,
          product_data: {
            name: `Invoice ${params.invoiceNumber}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: paymentIntentData,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };

  const session = stripeAccount
    ? await stripe.checkout.sessions.create(sessionParams, { stripeAccount })
    : await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return { sessionId: session.id, checkoutUrl: session.url, stripeAccount };
}

/**
 * Construct and verify a Stripe webhook event from raw body + signature.
 * (Platform-account endpoint: /api/webhooks/payments)
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

/**
 * Construct and verify a Stripe Connect webhook event (events that originate
 * on connected accounts, delivered to /api/webhooks/connect). Uses a separate
 * signing secret because Connect endpoints are registered separately in the
 * Stripe Dashboard.
 */
export function constructConnectWebhookEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET is not configured");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// ── Stripe Connect (Express) ─────────────────────────────

/**
 * Create an Express connected account for a CPA firm.
 */
export async function createConnectAccount(user: {
  id: string;
  email: string;
  companyName?: string | null;
}): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.create({
    type: "express",
    country: "US",
    email: user.email,
    business_type: "company",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
      us_bank_account_ach_payments: { requested: true },
    },
    business_profile: user.companyName ? { name: user.companyName } : undefined,
    metadata: { ownerId: user.id },
  });
}

/**
 * One-time onboarding link for an Express account (hosted by Stripe).
 */
export async function createConnectOnboardingLink(
  accountId: string,
  opts: { returnUrl: string; refreshUrl: string }
): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: opts.returnUrl,
    refresh_url: opts.refreshUrl,
  });
  return link.url;
}

/**
 * Short-lived login link to the Express dashboard for a connected account.
 */
export async function createConnectLoginLink(
  accountId: string
): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

export async function retrieveConnectAccount(
  accountId: string
): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.retrieve(accountId);
}

export type StripeAccountResolution = {
  stripeAccount: string | null;
  mode: "connected" | "platform" | "not_configured";
};

/**
 * Decide which Stripe account an owner's invoices should be charged on.
 *
 * - connected:      owner has an enabled Connect account → direct charge on it
 * - platform:       Nexli admin, or a legacy/DRS client without a Connect
 *                   account → charge on the platform account (current behavior)
 * - not_configured: Foundation-tier firm that hasn't finished Connect
 *                   onboarding → online payments unavailable
 */
export async function resolveStripeAccountForOwner(
  ownerId: string
): Promise<StripeAccountResolution> {
  const [owner] = await db
    .select({
      role: users.role,
      tier: users.tier,
      stripeConnectAccountId: users.stripeConnectAccountId,
      stripeConnectChargesEnabled: users.stripeConnectChargesEnabled,
    })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  if (!owner) {
    return { stripeAccount: null, mode: "not_configured" };
  }

  if (owner.stripeConnectAccountId && owner.stripeConnectChargesEnabled) {
    return { stripeAccount: owner.stripeConnectAccountId, mode: "connected" };
  }

  if (owner.role === "admin") {
    return { stripeAccount: null, mode: "platform" };
  }

  // Legacy / DRS clients are billed through the platform account. This holds
  // even if they started (but haven't finished) Connect onboarding, so an
  // in-progress onboarding never breaks existing payment links.
  if (owner.tier === null || owner.tier === "drs") {
    return { stripeAccount: null, mode: "platform" };
  }

  // Foundation tier without an enabled connected account.
  return { stripeAccount: null, mode: "not_configured" };
}
