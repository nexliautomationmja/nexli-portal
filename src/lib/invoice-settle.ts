import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { sendPaymentNotifications } from "@/lib/payments-webhook-handlers";
import { onDrsInvoicePaid } from "@/lib/digital-rainmaker";

/**
 * Record a payment that arrived outside Stripe (a bank transfer seen in
 * Mercury, or Marcel's "Mark as paid") and run everything a Stripe payment
 * runs: owner email, client receipt, notification, accounting sync, and —
 * when the invoice is now fully paid — onDrsInvoicePaid (onboarding opens,
 * pipeline lead → Won, alerts).
 *
 * Compare-and-set on amount_paid, so two callers applying a payment at the
 * same moment can't both apply it (or send two receipts). Returns null when
 * the invoice can't take a payment (paid, void, canceled, draft) or changed
 * underneath us.
 */
export async function settleInvoicePayment({
  invoiceId,
  amountCents,
  method,
  noteLine,
  payment,
}: {
  invoiceId: string;
  amountCents: number;
  /** Stored in invoices.payment_method: bank_transfer | wire | ach | check | other. */
  method: string;
  /** Appended to the invoice notes (visible on the invoice). */
  noteLine: string;
  /** Kept in metadata.payments for the record (Mercury transaction, sender, memo…). */
  payment?: Record<string, unknown>;
}): Promise<{ invoice: typeof invoices.$inferSelect; fullyPaid: boolean; appliedCents: number } | null> {
  const [pre] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!pre || ["paid", "void", "canceled", "draft"].includes(pre.status)) return null;

  const { applied, amountPaid, balanceDue, fullyPaid } = paymentOutcome(pre.total, pre.amountPaid, amountCents);
  if (applied <= 0) return null;
  const now = new Date();
  const meta = (pre.metadata ?? {}) as Record<string, unknown>;
  const payments = Array.isArray(meta.payments) ? (meta.payments as unknown[]) : [];

  const [updated] = await db
    .update(invoices)
    .set({
      status: fullyPaid ? "paid" : "partial",
      amountPaid,
      balanceDue,
      ...(fullyPaid ? { paidAt: now } : {}),
      paymentMethod: method,
      achSettlementStatus: null,
      notes: pre.notes ? `${pre.notes}\n\n${noteLine}` : noteLine,
      metadata: {
        ...meta,
        payments: [...payments, { method, amountCents: applied, at: now.toISOString(), ...(payment ?? {}) }],
      },
      updatedAt: now,
    })
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.amountPaid, pre.amountPaid),
        notInArray(invoices.status, ["paid", "void", "canceled", "draft"])
      )
    )
    .returning();
  if (!updated) return null;

  // Same owner email / client receipt / notification as a Stripe payment (takes the pre-payment row).
  try {
    await sendPaymentNotifications(pre, applied, false);
  } catch (err) {
    console.error("[invoice-settle] payment notifications failed:", err);
  }
  if (fullyPaid) await onDrsInvoicePaid(invoiceId);

  return { invoice: updated, fullyPaid, appliedCents: applied };
}

/**
 * What a payment does to an invoice: never more than the balance is applied
 * (an overpayment stays visible on the Mercury transaction, not the invoice).
 */
export function paymentOutcome(totalCents: number, amountPaidCents: number, paymentCents: number) {
  const balance = Math.max(0, totalCents - amountPaidCents);
  const applied = Math.min(Math.max(0, Math.round(paymentCents)), balance);
  const amountPaid = amountPaidCents + applied;
  return { applied, amountPaid, balanceDue: Math.max(0, totalCents - amountPaid), fullyPaid: amountPaid >= totalCents };
}

/** "Nov 7, 2026" */
export function settleDateLabel(d = new Date()): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
