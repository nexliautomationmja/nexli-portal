import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceLineItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createCheckoutSession, createSubscriptionCheckout } from "@/lib/stripe";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

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

  const balanceDue = invoice.balanceDue ?? invoice.total;
  if (balanceDue <= 0) {
    return NextResponse.json(
      { error: "No balance due on this invoice" },
      { status: 400 }
    );
  }

  // Fetch line items for the Checkout Session
  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoice.id));

  const sortedItems = lineItems.sort((a, b) => a.order - b.order);

  // Check if this invoice has recurring items with Stripe Price IDs → use subscription mode
  const recurringStripeItems = sortedItems.filter(
    (li) => li.billingType !== "one_time" && li.stripePriceId
  );

  let sessionId: string;
  let checkoutUrl: string;

  if (recurringStripeItems.length > 0) {
    // Subscription checkout: use real Stripe Price IDs for recurring items
    const oneTimeItems = sortedItems.filter(
      (li) => li.billingType === "one_time" || !li.stripePriceId
    );

    const result = await createSubscriptionCheckout({
      invoiceNumber: invoice.invoiceNumber,
      clientEmail: invoice.clientEmail,
      recurringItems: recurringStripeItems.map((li) => ({
        stripePriceId: li.stripePriceId!,
        quantity: Math.max(1, Math.round(li.quantity / 100)),
      })),
      oneTimeItems: oneTimeItems.map((li) => ({
        description: li.description,
        amountCents: li.amount,
        currency: invoice.currency,
      })),
      invoiceId: invoice.id,
      invoiceToken: token,
    });

    sessionId = result.sessionId;
    checkoutUrl = result.checkoutUrl;
  } else {
    // One-time payment checkout (existing flow)
    const result = await createCheckoutSession({
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      lineItems: sortedItems.map((li) => ({
        description: li.description,
        quantity: li.quantity / 100,
        unitPriceCents: li.unitPrice,
      })),
      taxAmountCents: invoice.taxAmount || 0,
      currency: invoice.currency,
      amountCents: balanceDue,
      invoiceId: invoice.id,
      invoiceToken: token,
    });

    sessionId = result.sessionId;
    checkoutUrl = result.checkoutUrl;
  }

  // Store the latest checkout session ID
  await db
    .update(invoices)
    .set({
      stripeCheckoutSessionId: sessionId,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));

  return NextResponse.json({ checkoutUrl });
}
