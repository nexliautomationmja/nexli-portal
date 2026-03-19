import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, invoiceLineItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await params;
  const body = await req.json();
  const { amountDollars } = body;

  if (!amountDollars || amountDollars <= 0) {
    return NextResponse.json(
      { error: "amountDollars must be a positive number" },
      { status: 400 }
    );
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, invoiceId), eq(invoices.ownerId, session.user.id))
    )
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!["sent", "viewed", "overdue", "partial"].includes(invoice.status)) {
    return NextResponse.json(
      { error: "Invoice is not eligible for partial payment" },
      { status: 400 }
    );
  }

  const amountCents = Math.round(amountDollars * 100);
  if (amountCents > invoice.balanceDue) {
    return NextResponse.json(
      { error: "Amount exceeds balance due" },
      { status: 400 }
    );
  }

  // Fetch line items for the Checkout Session
  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));

  const { sessionId, checkoutUrl } = await createCheckoutSession({
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    lineItems: lineItems
      .sort((a, b) => a.order - b.order)
      .map((li) => ({
        description: li.description,
        quantity: li.quantity / 100,
        unitPriceCents: li.unitPrice,
      })),
    taxAmountCents: invoice.taxAmount || 0,
    currency: invoice.currency,
    amountCents,
    invoiceId: invoice.id,
    invoiceToken: invoice.token,
  });

  // Store the checkout session ID
  await db
    .update(invoices)
    .set({
      stripeCheckoutSessionId: sessionId,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));

  return NextResponse.json({ paymentUrl: checkoutUrl });
}
