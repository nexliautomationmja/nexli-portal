import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceLineItems } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import {
  createCheckoutSession,
  resolveStripeAccountForOwner,
} from "@/lib/stripe";
import { cardPriceCents, isAchOnlyInvoiceMeta } from "@/lib/drs-pricing";
import {
  createAutopayCheckout,
  hasLiveAutopay,
  isAutopayEligible,
} from "@/lib/autopay";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Payment method chosen on the invoice page. Default to ACH (fee-free) so
  // requests without a body — e.g. stale clients — stay safe.
  const body = await req.json().catch(() => ({}));
  const method: "ach" | "card" = body?.method === "card" ? "card" : "ach";

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.token, token))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (["canceled", "void"].includes(invoice.status)) {
    return NextResponse.json(
      { error: "This invoice is no longer valid" },
      { status: 410 }
    );
  }

  if (invoice.status === "paid") {
    return NextResponse.json(
      { error: "This invoice has already been paid" },
      { status: 400 }
    );
  }

  // A bank transfer (one-time or autopay) is already in flight — don't let
  // the client pay twice while it settles (3–5 business days).
  if (invoice.achSettlementStatus === "pending" || hasLiveAutopay(invoice)) {
    return NextResponse.json({ error: "payment_processing" }, { status: 409 });
  }

  // ACH-only invoices (the Enterprise License fee and the DRS setup
  // invoices) never accept card — the pay page hides the option, and this is
  // the server-side guarantee.
  const achOnly = isAchOnlyInvoiceMeta(invoice.metadata);
  if (achOnly && method === "card") {
    return NextResponse.json({ error: "card_not_accepted" }, { status: 400 });
  }

  const balanceDue = invoice.balanceDue ?? invoice.total;
  if (balanceDue <= 0) {
    return NextResponse.json(
      { error: "No balance due on this invoice" },
      { status: 400 }
    );
  }

  // Which Stripe account should this charge land on?
  //  - connected      → direct charge on the firm's Express account
  //  - platform       → Nexli's own account (legacy behavior)
  //  - not_configured → firm hasn't finished Connect onboarding
  const resolution = await resolveStripeAccountForOwner(invoice.ownerId);

  if (resolution.mode === "not_configured") {
    return NextResponse.json(
      { error: "payments_not_configured" },
      { status: 409 }
    );
  }

  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const invoicePageUrl = `${portalUrl}/invoice/${token}`;

  // Digital Rainmaker monthly invoice → autopay subscription. The client
  // pays this one invoice once; the chosen method is saved and charged
  // automatically every month at that method's price.
  if (await isAutopayEligible(invoice)) {
    try {
      const lineItems = await db
        .select({
          description: invoiceLineItems.description,
          amount: invoiceLineItems.amount,
        })
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoice.id))
        .orderBy(asc(invoiceLineItems.order));

      const { sessionId, checkoutUrl } = await createAutopayCheckout({
        invoice,
        lineItems,
        method,
        successUrl: `${invoicePageUrl}?payment=success`,
        cancelUrl: `${invoicePageUrl}?payment=canceled`,
      });

      await db
        .update(invoices)
        .set({
          stripeCheckoutSessionId: sessionId,
          stripeAccountId: null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id));

      return NextResponse.json({ checkoutUrl });
    } catch (err) {
      console.error("Failed to create Stripe autopay checkout session:", err);
      return NextResponse.json(
        { error: "Failed to create payment session" },
        { status: 500 }
      );
    }
  }

  // Dual pricing: the invoice balance is the discounted ACH price; card
  // payments are charged at the card price. Computed server-side — the
  // client only displays it.
  const chargeCents = method === "card" ? cardPriceCents(balanceDue) : balanceDue;

  try {
    const { sessionId, checkoutUrl, stripeAccount } =
      await createCheckoutSession({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientEmail: invoice.clientEmail,
        amountCents: balanceDue,
        chargeCents,
        method,
        currency: invoice.currency,
        successUrl: `${invoicePageUrl}?payment=success`,
        cancelUrl: `${invoicePageUrl}?payment=canceled`,
        stripeAccount: resolution.stripeAccount ?? undefined,
      });

    // Store the session ID and the account it was created on so webhooks and
    // any later PaymentIntent lookups hit the right Stripe account.
    await db
      .update(invoices)
      .set({
        stripeCheckoutSessionId: sessionId,
        stripeAccountId: stripeAccount,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error("Failed to create Stripe checkout session:", err);
    return NextResponse.json(
      { error: "Failed to create payment session" },
      { status: 500 }
    );
  }
}
