import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createCheckoutSession } from "@/lib/stripe";

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

  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
  const invoicePageUrl = `${portalUrl}/invoice/${token}`;

  try {
    const { sessionId, checkoutUrl } = await createCheckoutSession({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientEmail: invoice.clientEmail,
      amountCents: balanceDue,
      currency: invoice.currency,
      successUrl: `${invoicePageUrl}?payment=success`,
      cancelUrl: `${invoicePageUrl}?payment=canceled`,
    });

    // Store the session ID for reference
    await db
      .update(invoices)
      .set({
        stripeSessionId: sessionId,
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
