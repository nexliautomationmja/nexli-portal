import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceLineItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createInvoicePaymentLink,
  createPartialPaymentLink,
} from "@/lib/stripe";

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

  const isPartial = invoice.amountPaid > 0;

  try {
    let checkoutUrl: string;

    if (isPartial) {
      const result = await createPartialPaymentLink({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientEmail: invoice.clientEmail,
        amountCents: balanceDue,
        currency: invoice.currency,
        successUrl: `${portalUrl}/invoice/paid`,
        cancelUrl: `${portalUrl}/invoice/${invoice.token}`,
      });
      checkoutUrl = result.paymentUrl;
    } else {
      const lineItems = await db
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      const description = lineItems
        .sort((a, b) => a.order - b.order)
        .map((li) => li.description)
        .join(", ");

      const result = await createInvoicePaymentLink({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientEmail: invoice.clientEmail,
        totalCents: invoice.total,
        currency: invoice.currency,
        description: description || `Invoice ${invoice.invoiceNumber}`,
        successUrl: `${portalUrl}/invoice/paid`,
        cancelUrl: `${portalUrl}/invoice/${invoice.token}`,
      });
      checkoutUrl = result.paymentUrl;
    }

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error("Failed to create checkout session:", err);
    return NextResponse.json(
      { error: "Failed to create payment session. Please try again." },
      { status: 500 }
    );
  }
}
