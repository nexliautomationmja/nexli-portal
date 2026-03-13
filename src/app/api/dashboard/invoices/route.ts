import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, invoiceLineItems, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  generateInvoiceNumber,
  generateInvoiceToken,
  dollarsToCents,
  calculateLineAmount,
  calculateInvoiceTotals,
} from "@/lib/invoice-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.ownerId, session.user.id))
    .orderBy(desc(invoices.createdAt));

  // Fetch line items for owner's invoices
  const invoiceIds = rows.map((r) => r.id);
  type LineItemRow = typeof invoiceLineItems.$inferSelect;
  const lineItemsByInvoice: Record<string, LineItemRow[]> = {};
  if (invoiceIds.length > 0) {
    const allLineItems = await db.select().from(invoiceLineItems);
    const ownerInvoiceIds = new Set(invoiceIds);
    for (const li of allLineItems) {
      if (!ownerInvoiceIds.has(li.invoiceId)) continue;
      if (!lineItemsByInvoice[li.invoiceId]) {
        lineItemsByInvoice[li.invoiceId] = [];
      }
      lineItemsByInvoice[li.invoiceId].push(li);
    }
  }

  const enriched = rows.map((inv) => ({
    ...inv,
    lineItems: (lineItemsByInvoice[inv.id] || []).sort(
      (a, b) => a.order - b.order
    ),
  }));

  // Fetch owner info for document preview
  const [owner] = await db
    .select({ name: users.name, companyName: users.companyName })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    invoices: enriched,
    from: {
      name: owner?.name || "",
      company: owner?.companyName || "",
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    clientName,
    clientEmail,
    clientPhone,
    clientCompany,
    lineItems,
    taxRate = 0,
    dueDate,
    notes,
    terms,
    currency = "usd",
    reminderConfig,
  } = body;

  if (!clientName || !clientEmail) {
    return NextResponse.json(
      { error: "clientName and clientEmail are required" },
      { status: 400 }
    );
  }
  if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json(
      { error: "At least one line item is required" },
      { status: 400 }
    );
  }
  if (!dueDate) {
    return NextResponse.json(
      { error: "dueDate is required" },
      { status: 400 }
    );
  }

  const dueDateObj = new Date(dueDate);
  const maxDue = new Date();
  maxDue.setDate(maxDue.getDate() + 365);
  if (dueDateObj > maxDue) {
    return NextResponse.json(
      { error: "Due date cannot be more than 365 days from today" },
      { status: 400 }
    );
  }

  // Process line items
  type BillingType = "one_time" | "monthly" | "quarterly" | "yearly";
  const validBillingTypes: BillingType[] = ["one_time", "monthly", "quarterly", "yearly"];

  const processedItems = lineItems.map(
    (
      item: { description: string; quantity: number; unitPrice: number; billingType?: string },
      i: number
    ) => {
      const qty = Math.round(item.quantity * 100);
      const price = dollarsToCents(item.unitPrice);
      const amount = calculateLineAmount(qty, price);
      const bt = validBillingTypes.includes(item.billingType as BillingType)
        ? (item.billingType as BillingType)
        : ("one_time" as const);
      return {
        description: item.description,
        quantity: qty,
        unitPrice: price,
        amount,
        billingType: bt,
        order: i,
      };
    }
  );

  const hasRecurring = processedItems.some((p) => p.billingType !== "one_time");

  const { subtotal, taxAmount, total } = calculateInvoiceTotals(
    processedItems,
    taxRate
  );

  const invoiceNumber = await generateInvoiceNumber();
  const token = generateInvoiceToken();

  const [invoice] = await db
    .insert(invoices)
    .values({
      ownerId: session.user.id,
      clientName,
      clientEmail,
      clientPhone: clientPhone || null,
      clientCompany: clientCompany || null,
      invoiceNumber,
      token,
      currency,
      subtotal,
      taxRate,
      taxAmount,
      total,
      amountPaid: 0,
      balanceDue: total,
      isRecurring: hasRecurring,
      recurringInterval: body.recurringInterval || null,
      recurringEndDate: body.recurringEndDate ? new Date(body.recurringEndDate) : null,
      nextRecurrenceDate: hasRecurring ? dueDateObj : null,
      dueDate: dueDateObj,
      notes: notes || null,
      terms: terms || null,
      reminderConfig: reminderConfig || null,
      status: "draft",
    })
    .returning();

  // Insert line items
  for (const item of processedItems) {
    await db.insert(invoiceLineItems).values({
      invoiceId: invoice.id,
      ...item,
    });
  }

  return NextResponse.json({ invoice }, { status: 201 });
}
