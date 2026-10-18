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
import { sendPaymentNotifications } from "@/lib/payments-webhook-handlers";
import { onDrsInvoicePaid } from "@/lib/digital-rainmaker";

const MANUAL_METHODS = {
  wire: "Wire transfer",
  ach: "ACH",
  check: "Check",
  other: "Other",
} as const;
type ManualMethod = keyof typeof MANUAL_METHODS;

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

/**
 * PATCH — { action, ... } on an owned invoice.
 *   - { action: "void" }   sent/viewed/overdue → void
 *   - { action: "cancel" } draft → canceled
 *   - { action: "mark_paid", method: "wire"|"ach"|"check"|"other", note?: string (≤500) }
 *       Records a payment received outside Stripe (wire/ACH/check). Allowed
 *       for sent/viewed/overdue/partial. Sets status "paid", amountPaid =
 *       total, balanceDue 0, paidAt now, paymentMethod = method, appends a
 *       line to notes, sends the same owner email / client receipt /
 *       notification as a Stripe payment, then runs the Digital Rainmaker
 *       paid hook (setup paid → onboarding opens; first monthly → ads).
 *       → 200 { invoice } | 400 { error } | 404 { error }
 *   - otherwise: content update (drafts only) → 200 { invoice }
 */
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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { action } = body;

  if (action === "mark_paid") {
    if (!["sent", "viewed", "overdue", "partial"].includes(invoice.status)) {
      return NextResponse.json(
        { error: "Only sent/viewed/overdue/partial invoices can be marked paid" },
        { status: 400 }
      );
    }
    const method = body.method;
    if (typeof method !== "string" || !(method in MANUAL_METHODS)) {
      return NextResponse.json(
        { error: "method must be one of wire, ach, check, other" },
        { status: 400 }
      );
    }
    if (body.note !== undefined && typeof body.note !== "string") {
      return NextResponse.json({ error: "note must be a string" }, { status: 400 });
    }
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 500) {
      return NextResponse.json({ error: "Note too long (max 500)" }, { status: 400 });
    }

    const now = new Date();
    const dateLabel = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const line = `Payment recorded manually: ${MANUAL_METHODS[method as ManualMethod]} on ${dateLabel}${note ? ` — ${note}` : ""}`;
    const notes = invoice.notes ? `${invoice.notes}\n\n${line}` : line;
    const paymentCents = Math.max(0, invoice.total - invoice.amountPaid);

    const [updated] = await db
      .update(invoices)
      .set({
        status: "paid",
        amountPaid: invoice.total,
        balanceDue: 0,
        paidAt: now,
        paymentMethod: method,
        achSettlementStatus: null,
        notes,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    // Same owner email / client receipt / notification as a Stripe payment
    // (takes the pre-payment row).
    try {
      await sendPaymentNotifications(invoice, paymentCents, false);
    } catch (err) {
      console.error("Manual payment notifications failed:", err);
    }
    await onDrsInvoicePaid(invoiceId);

    return NextResponse.json({ invoice: updated });
  }

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
