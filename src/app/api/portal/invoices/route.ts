import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceLineItems } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = session.ownerId;

  const rows = await db
    .select()
    .from(invoices)
    .where(
      ownerId
        ? and(eq(invoices.clientEmail, session.email), eq(invoices.ownerId, ownerId))
        : eq(invoices.clientEmail, session.email)
    )
    .orderBy(desc(invoices.createdAt));

  // Exclude drafts
  const visible = rows.filter((i) => i.status !== "draft");

  // Fetch line items for all visible invoices
  let lineItems: (typeof invoiceLineItems.$inferSelect)[] = [];
  for (const inv of visible) {
    const items = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, inv.id))
      .orderBy(invoiceLineItems.order);
    lineItems.push(...items);
  }

  // Group line items by invoiceId
  const itemsByInvoice = new Map<string, typeof lineItems>();
  for (const item of lineItems) {
    const existing = itemsByInvoice.get(item.invoiceId) || [];
    existing.push(item);
    itemsByInvoice.set(item.invoiceId, existing);
  }

  const result = visible.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientCompany: inv.clientCompany,
    status: inv.status,
    currency: inv.currency,
    subtotal: inv.subtotal,
    taxRate: inv.taxRate,
    taxAmount: inv.taxAmount,
    total: inv.total,
    amountPaid: inv.amountPaid,
    balanceDue: inv.balanceDue,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    token: inv.token,
    stripePaymentUrl: inv.stripePaymentUrl,
    terms: inv.terms,
    createdAt: inv.createdAt,
    lineItems: (itemsByInvoice.get(inv.id) || []).map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
      billingType: li.billingType,
    })),
  }));

  return NextResponse.json({ invoices: result });
}
