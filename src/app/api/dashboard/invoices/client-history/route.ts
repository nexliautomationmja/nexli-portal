import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, invoiceLineItems } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json(
      { error: "email query parameter is required" },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.ownerId, session.user.id),
        eq(invoices.clientEmail, email)
      )
    )
    .orderBy(desc(invoices.createdAt));

  // Fetch line items
  const invoiceIds = rows.map((r) => r.id);
  type LineItemRow = typeof invoiceLineItems.$inferSelect;
  const lineItemsByInvoice: Record<string, LineItemRow[]> = {};

  if (invoiceIds.length > 0) {
    for (const inv of rows) {
      const items = await db
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, inv.id));
      lineItemsByInvoice[inv.id] = items.sort((a, b) => a.order - b.order);
    }
  }

  const enriched = rows.map((inv) => ({
    ...inv,
    lineItems: lineItemsByInvoice[inv.id] || [],
  }));

  // Summary stats
  const totalInvoiced = rows.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = rows.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const totalOutstanding = rows
    .filter((inv) => ["sent", "viewed", "overdue", "partial"].includes(inv.status))
    .reduce((sum, inv) => sum + inv.balanceDue, 0);

  return NextResponse.json({
    clientEmail: email,
    clientName: rows[0]?.clientName || "",
    clientCompany: rows[0]?.clientCompany || "",
    invoices: enriched,
    summary: {
      totalInvoices: rows.length,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
    },
  });
}
