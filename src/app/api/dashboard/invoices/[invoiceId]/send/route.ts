import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, invoiceLineItems, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createInvoicePaymentLink } from "@/lib/stripe";
import { sendEmail, buildInvoiceEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/invoice-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await params;

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

  if (invoice.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be sent" },
      { status: 400 }
    );
  }

  // Get line items for description
  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));

  const description = lineItems
    .sort((a, b) => a.order - b.order)
    .map((li) => li.description)
    .join(", ");

  // Create Stripe payment link
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

  const { paymentUrl } = await createInvoicePaymentLink({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientEmail: invoice.clientEmail,
    totalCents: invoice.total,
    currency: invoice.currency,
    description: description || `Invoice ${invoice.invoiceNumber}`,
    successUrl: `${portalUrl}/invoice/paid`,
    cancelUrl: `${portalUrl}/invoice/${invoice.token}`,
  });

  // Update invoice status
  const [updated] = await db
    .update(invoices)
    .set({
      status: "sent",
      sentAt: new Date(),
      stripePaymentUrl: paymentUrl,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  // Send email to client
  const cpaName = session.user.name || session.user.email || "Your Service Provider";
  const invoiceUrl = `${portalUrl}/invoice/${invoice.token}`;

  try {
    const { subject, html } = buildInvoiceEmail({
      clientName: invoice.clientName,
      cpaName,
      invoiceNumber: invoice.invoiceNumber,
      total: formatCurrency(invoice.total, invoice.currency),
      dueDate: invoice.dueDate,
      invoiceUrl,
    });
    await sendEmail({ to: invoice.clientEmail, subject, html });
  } catch (err) {
    console.error("Failed to send invoice email:", err);
  }

  return NextResponse.json({ invoice: updated });
}
