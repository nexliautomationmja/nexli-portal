import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceLineItems, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (["canceled", "void"].includes(invoice.status)) {
    return NextResponse.json(
      { error: "This invoice is no longer valid" },
      { status: 410 }
    );
  }

  // Mark as viewed on first access (if sent)
  if (invoice.status === "sent" && !invoice.viewedAt) {
    await db
      .update(invoices)
      .set({ status: "viewed", viewedAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, invoice.id));
  }

  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoice.id));

  const [owner] = await db
    .select({ name: users.name, email: users.email, companyName: users.companyName })
    .from(users)
    .where(eq(users.id, invoice.ownerId))
    .limit(1);

  return NextResponse.json({
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.viewedAt ? invoice.status : "viewed",
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
      terms: invoice.terms,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientCompany: invoice.clientCompany,
      paymentUrl: invoice.paymentUrl,
      paidAt: invoice.paidAt,
    },
    lineItems: lineItems.sort((a, b) => a.order - b.order),
    from: {
      name: owner?.name || owner?.email || "",
      company: owner?.companyName || "",
    },
  });
}
