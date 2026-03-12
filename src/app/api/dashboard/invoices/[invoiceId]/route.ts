import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, invoiceLineItems, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  dollarsToCents,
  calculateLineAmount,
  calculateInvoiceTotals,
} from "@/lib/invoice-utils";

export async function GET(
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

  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));

  const [owner] = await db
    .select({ name: users.name, email: users.email, companyName: users.companyName })
    .from(users)
    .where(eq(users.id, invoice.ownerId))
    .limit(1);

  return NextResponse.json({
    invoice: {
      ...invoice,
      lineItems: lineItems.sort((a, b) => a.order - b.order),
      ownerName: owner?.name || owner?.email || "",
      ownerCompany: owner?.companyName || "",
    },
  });
}

export async function PATCH(
  req: NextRequest,
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

  const body = await req.json();
  const { action } = body;

  // Status change actions
  if (action === "void") {
    if (!["sent", "viewed", "overdue"].includes(invoice.status)) {
      return NextResponse.json(
        { error: "Only sent/viewed/overdue invoices can be voided" },
        { status: 400 }
      );
    }
    const [updated] = await db
      .update(invoices)
      .set({ status: "void", canceledAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return NextResponse.json({ invoice: updated });
  }

  if (action === "cancel") {
    if (invoice.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft invoices can be canceled" },
        { status: 400 }
      );
    }
    const [updated] = await db
      .update(invoices)
      .set({
        status: "canceled",
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return NextResponse.json({ invoice: updated });
  }

  // Content update — only drafts
  if (invoice.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be edited" },
      { status: 400 }
    );
  }

  const {
    clientName,
    clientEmail,
    clientPhone,
    clientCompany,
    lineItems,
    taxRate,
    dueDate,
    notes,
    terms,
    currency,
    reminderConfig,
  } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (clientName !== undefined) updates.clientName = clientName;
  if (clientEmail !== undefined) updates.clientEmail = clientEmail;
  if (clientPhone !== undefined) updates.clientPhone = clientPhone || null;
  if (clientCompany !== undefined) updates.clientCompany = clientCompany || null;
  if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
  if (notes !== undefined) updates.notes = notes || null;
  if (terms !== undefined) updates.terms = terms || null;
  if (currency !== undefined) updates.currency = currency;
  if (reminderConfig !== undefined) updates.reminderConfig = reminderConfig;

  // Recalculate totals if line items or tax rate changed
  if (lineItems && Array.isArray(lineItems)) {
    const rate = taxRate !== undefined ? taxRate : (invoice.taxRate || 0);
    const processedItems = lineItems.map(
      (
        item: { description: string; quantity: number; unitPrice: number },
        i: number
      ) => {
        const qty = Math.round(item.quantity * 100);
        const price = dollarsToCents(item.unitPrice);
        const amount = calculateLineAmount(qty, price);
        return { description: item.description, quantity: qty, unitPrice: price, amount, order: i };
      }
    );

    const { subtotal, taxAmount, total } = calculateInvoiceTotals(
      processedItems,
      rate
    );
    updates.subtotal = subtotal;
    updates.taxRate = rate;
    updates.taxAmount = taxAmount;
    updates.total = total;

    // Replace line items
    await db
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));
    for (const item of processedItems) {
      await db.insert(invoiceLineItems).values({
        invoiceId,
        ...item,
      });
    }
  } else if (taxRate !== undefined) {
    // Tax rate changed but line items not — recalculate with existing items
    const existingItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));
    const { subtotal, taxAmount, total } = calculateInvoiceTotals(
      existingItems,
      taxRate
    );
    updates.subtotal = subtotal;
    updates.taxRate = taxRate;
    updates.taxAmount = taxAmount;
    updates.total = total;
  }

  const [updated] = await db
    .update(invoices)
    .set(updates)
    .where(eq(invoices.id, invoiceId))
    .returning();

  return NextResponse.json({ invoice: updated });
}

export async function DELETE(
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

  // Line items cascade-delete via FK
  await db.delete(invoices).where(eq(invoices.id, invoiceId));

  return NextResponse.json({ ok: true });
}
