import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { createNotification } from "@/lib/notifications";
import { recentlySynced, syncMercury, usesBankTransfer } from "@/lib/mercury";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "I've sent the transfer" on a bank-transfer invoice: remember it (the page
 * shows "on its way", reminders pause), tell Marcel, and look in Mercury
 * right away in case the money is already there (a wire often is).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invoice] = await db.select().from(invoices).where(eq(invoices.token, token)).limit(1);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (!["sent", "viewed", "overdue", "partial"].includes(invoice.status) || invoice.balanceDue <= 0) {
    return NextResponse.json({ error: "There's nothing to pay on this invoice" }, { status: 400 });
  }
  if (!(await usesBankTransfer(invoice))) return NextResponse.json({ error: "This invoice isn't paid by bank transfer" }, { status: 400 });

  const meta = (invoice.metadata ?? {}) as Record<string, unknown>;
  const previous = typeof meta.transferSentAt === "string" ? Date.parse(meta.transferSentAt) : NaN;
  const now = new Date();
  // A second tap within 10 minutes is the same transfer: don't alert Marcel twice.
  const fresh = !Number.isFinite(previous) || now.getTime() - previous > 10 * 60_000;
  await db
    .update(invoices)
    .set({ metadata: { ...meta, transferSentAt: now.toISOString() }, updatedAt: now })
    .where(eq(invoices.id, invoice.id));

  if (fresh) {
    const amount = (invoice.balanceDue / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    await createNotification({
      userId: invoice.ownerId,
      type: "bank_transfer_sent",
      title: "Bank transfer on the way",
      message: `${invoice.clientCompany || invoice.clientName} says they sent ${amount} for ${invoice.invoiceNumber}. It's marked paid automatically when it lands in Mercury.`,
      metadata: { invoiceId: invoice.id },
    }).catch((err) => console.error("[transfer-sent] notification failed:", err));
  }

  let status = invoice.status as string;
  if (!(await recentlySynced(60_000))) {
    try {
      await syncMercury();
      const [after] = await db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, invoice.id)).limit(1);
      status = after?.status ?? status;
    } catch (err) {
      console.error("[transfer-sent] Mercury sync failed:", err instanceof Error ? err.message : err);
    }
  }
  return NextResponse.json({ transferSentAt: now.toISOString(), status });
}
