import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }
  return _stripe;
}

// ── $1,010 threshold (in cents) ──
const ACH_ONLY_THRESHOLD_CENTS = 101_000;

/**
 * Creates a Stripe Checkout Session for an invoice.
 * - At or below $1,010: card + ACH
 * - Above $1,010: ACH only
 */
export async function createCheckoutSession(params: {
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const stripe = getStripe();

  const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
    params.amountCents <= ACH_ONLY_THRESHOLD_CENTS
      ? ["card", "us_bank_account"]
      : ["us_bank_account"];

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: paymentMethodTypes,
    customer_email: params.clientEmail,
    line_items: [
      {
        price_data: {
          currency: params.currency,
          unit_amount: params.amountCents,
          product_data: {
            name: `Invoice ${params.invoiceNumber}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: params.invoiceId,
      invoiceNumber: params.invoiceNumber,
    },
    payment_intent_data: {
      metadata: {
        invoiceId: params.invoiceId,
        invoiceNumber: params.invoiceNumber,
      },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return { sessionId: session.id, checkoutUrl: session.url };
}

/**
 * Construct and verify a Stripe webhook event from raw body + signature.
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
