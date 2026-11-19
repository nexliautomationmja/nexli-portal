import { NextRequest, NextResponse } from "next/server";
import { isAchOnlyInvoiceMeta, isChargebackWaivedInvoiceMeta } from "@/lib/drs-pricing";
import { db } from "@/db";
import { engagements, invoices, invoiceLineItems, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAutopayInfo } from "@/lib/autopay";
import { offersWire, remitDetails, usesBankTransfer } from "@/lib/mercury";

/** What the invoice is for — drives the pay page's "what happens next" copy. */
type InvoiceKind =
  | "setup"
  | "annual"
  | "monthly"
  | "ad_budget"
  | "renewal"
  | "enterprise"
  // Nov 19 2026 pricing:
  | "agency" // the monthly Agency Fee
  | "prepay" // the six-month prepayment
  | "performance" // a month's Performance Pay
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
    case "agency_monthly":
      return "agency";
    case "agency_prepay":
      return "prepay";
    case "performance_pay":
      return "performance";
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

  // Up-front invoices are paid by bank transfer into Mercury (lib/mercury.ts):
  // the page shows the account details instead of Stripe checkout.
  const bankTransfer = await usesBankTransfer(invoice);
  const open = !["paid", "canceled", "void"].includes(invoice.status) && invoice.balanceDue > 0;
  const remit = bankTransfer && open ? await remitDetails() : null;
  // Prepayment and Performance Pay invoices: card or ACH through Stripe, or a wire to the same bank account.
  const wireRemit = !bankTransfer && open && (await offersWire(invoice)) ? await remitDetails() : null;

  // An Agency Fee invoice paid before the client has a Launch Pad is their
  // first payment: paying it opens the Launch Pad (the page says so).
  let firstPayment = false;
  if ((meta?.drsRole === "agency_monthly" || meta?.drsRole === "agency_prepay") && typeof meta.engagementId === "string") {
    try {
      const [eng] = await db
        .select({ metadata: engagements.metadata })
        .from(engagements)
        .where(eq(engagements.id, meta.engagementId))
        .limit(1);
      firstPayment = Boolean(eng) && !(eng.metadata as { onboarding?: unknown } | null)?.onboarding;
    } catch (err) {
      console.error("Invoice page: engagement lookup failed:", err);
    }
  }

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
      chargebackWaived: isChargebackWaivedInvoiceMeta(meta),
      paymentMethod: invoice.paymentMethod,
      achSettlementStatus: invoice.achSettlementStatus,
      kind: invoiceKind(meta),
      autopay,
      payVia: bankTransfer ? "bank_transfer" : "stripe",
      remit,
      wireRemit,
      firstPayment,
      // Performance Pay invoices: the month's totals (never the client list — that stays inside the portal).
      statement: meta?.drsRole === "performance_pay" && meta.statement && typeof meta.statement === "object" ? meta.statement : null,
      transferSentAt: typeof meta?.transferSentAt === "string" ? meta.transferSentAt : null,
    },
    lineItems: lineItems.sort((a, b) => a.order - b.order),
    from: {
      name: owner?.name || owner?.email || "",
      company: owner?.companyName || "",
    },
  });
}
