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
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const stripe = getStripe();

  const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
    params.method === "card" ? ["card"] : ["us_bank_account"];

  const metadata = {
    invoiceId: params.invoiceId,
    invoiceNumber: params.invoiceNumber,
    baseAmountCents: String(params.amountCents),
  };

  const session = await stripe.checkout.sessions.create({
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
    payment_intent_data: {
      metadata,
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
