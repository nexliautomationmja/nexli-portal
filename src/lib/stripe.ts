import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

export async function createInvoicePaymentLink(params: {
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string;
  totalCents: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ paymentUrl: string; stripePaymentIntentId?: string }> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.clientEmail,
    line_items: [
      {
        price_data: {
          currency: params.currency,
          unit_amount: params.totalCents,
          product_data: {
            name: `Invoice ${params.invoiceNumber}`,
            description: params.description,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      nexli_invoice_id: params.invoiceId,
      invoice_number: params.invoiceNumber,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return {
    paymentUrl: session.url!,
    stripePaymentIntentId: session.payment_intent as string | undefined,
  };
}

// Partial payment — creates a checkout session for a custom amount
export async function createPartialPaymentLink(params: {
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ paymentUrl: string; stripePaymentIntentId?: string }> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.clientEmail,
    line_items: [
      {
        price_data: {
          currency: params.currency,
          unit_amount: params.amountCents,
          product_data: {
            name: `Partial Payment — Invoice ${params.invoiceNumber}`,
            description: `Partial payment of ${(params.amountCents / 100).toFixed(2)} toward Invoice ${params.invoiceNumber}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      nexli_invoice_id: params.invoiceId,
      invoice_number: params.invoiceNumber,
      is_partial_payment: "true",
      payment_amount_cents: String(params.amountCents),
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return {
    paymentUrl: session.url!,
    stripePaymentIntentId: session.payment_intent as string | undefined,
  };
}
