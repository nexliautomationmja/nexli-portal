import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export { stripe };

/**
 * Creates a Stripe Checkout Session for an invoice.
 * Returns the session ID and checkout URL.
 */
export async function createCheckoutSession(params: {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  lineItems: { description: string; quantity: number; unitPriceCents: number }[];
  taxAmountCents: number;
  currency: string;
  amountCents: number; // total or balance due (for partial payments)
  invoiceId: string; // internal DB id, stored in metadata
  invoiceToken: string; // for building success/cancel URLs
}): Promise<{
  sessionId: string;
  checkoutUrl: string;
}> {
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

  // Calculate full invoice total (line items + tax) to detect partial payments
  const fullTotal =
    params.lineItems.reduce(
      (sum, li) => sum + li.unitPriceCents * li.quantity,
      0
    ) + params.taxAmountCents;

  const isPartialPayment = params.amountCents < fullTotal;

  const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  if (isPartialPayment) {
    // Partial payment: single consolidated line item
    stripeLineItems.push({
      price_data: {
        currency: params.currency.toLowerCase(),
        product_data: {
          name: `Payment for Invoice ${params.invoiceNumber}`,
          description: "Partial payment",
        },
        unit_amount: params.amountCents,
      },
      quantity: 1,
    });
  } else {
    // Full payment: itemized line items
    for (const item of params.lineItems) {
      stripeLineItems.push({
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: item.description,
          },
          unit_amount: item.unitPriceCents,
        },
        quantity: item.quantity,
      });
    }

    // Add tax as a separate line item if applicable
    if (params.taxAmountCents > 0) {
      stripeLineItems.push({
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: "Tax",
          },
          unit_amount: params.taxAmountCents,
        },
        quantity: 1,
      });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.clientEmail,
    line_items: stripeLineItems,
    payment_method_types: ["card"],
    metadata: {
      invoiceId: params.invoiceId,
      invoiceNumber: params.invoiceNumber,
    },
    success_url: `${portalUrl}/invoice/${params.invoiceToken}?payment=success`,
    cancel_url: `${portalUrl}/invoice/${params.invoiceToken}?payment=canceled`,
  });

  return {
    sessionId: session.id,
    checkoutUrl: session.url!,
  };
}

/**
 * Constructs a Stripe webhook event from the raw body and signature header.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
