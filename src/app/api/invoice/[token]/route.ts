import { NextRequest, NextResponse } from "next/server";
import { isAchOnlyInvoiceMeta } from "@/lib/drs-pricing";
import { db } from "@/db";
import { invoices, invoiceLineItems, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAutopayInfo } from "@/lib/autopay";

/** What the invoice is for — drives the pay page's "what happens next" copy. */
type InvoiceKind =
  | "setup"
  | "annual"
  | "monthly"
  | "ad_budget"
  | "renewal"
  | "enterprise"
  | "other";

function invoiceKind(meta: Record<string, unknown> | null): InvoiceKind {
  switch (meta?.drsRole) {
    case "setup_fee":
      return "setup";
    case "setup_annual":
      return "annual";
    case "platform_monthly":
      return "monthly";
    case "ad_spend_monthly":
      return "ad_budget";
    case "platform_annual_renewal":
      return "renewal";
  }
  if (meta?.offer === "enterprise") return "enterprise";
  return "other";
}

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

  const meta = (invoice.metadata ?? null) as Record<string, unknown> | null;
  const autopay = getAutopayInfo(invoice, lineItems);

  const [owner] = await db
    .select({ name: users.name, email: users.email, companyName: users.companyName })
    .from(users)
    .where(eq(users.id, invoice.ownerId))
    .limit(1);

  return NextResponse.json({
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      // The first view of a "sent" invoice flips it to "viewed" above, after
      // `invoice` was read — report that. Every other status (paid, partial,
      // overdue, …) is reported as stored.
      status: invoice.status === "sent" && !invoice.viewedAt ? "viewed" : invoice.status,
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
      achOnly: isAchOnlyInvoiceMeta(meta),
      paymentMethod: invoice.paymentMethod,
      achSettlementStatus: invoice.achSettlementStatus,
      kind: invoiceKind(meta),
      autopay,
    },
    lineItems: lineItems.sort((a, b) => a.order - b.order),
    from: {
      name: owner?.name || owner?.email || "",
      company: owner?.companyName || "",
    },
  });
}
