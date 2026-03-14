import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getHelcimTransaction } from "@/lib/helcim";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all invoices with pending ACH settlement
  const pendingInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.achSettlementStatus, "pending"),
        isNotNull(invoices.helcimTransactionId)
      )
    );

  let approved = 0;
  let declined = 0;
  let stillPending = 0;

  for (const invoice of pendingInvoices) {
    try {
      const transaction = await getHelcimTransaction(
        Number(invoice.helcimTransactionId)
      );

      if (transaction.statusAuth === 1) {
        // Approved — settlement confirmed
        await db
          .update(invoices)
          .set({
            achSettlementStatus: "approved",
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoice.id));
        approved++;
      } else if (transaction.statusAuth === 2) {
        // Declined — reverse the payment
        const paymentAmountCents = Math.round(transaction.amount * 100);
        const revertedAmountPaid = Math.max(
          0,
          invoice.amountPaid - paymentAmountCents
        );
        const revertedBalanceDue = invoice.total - revertedAmountPaid;
        const revertedStatus = revertedAmountPaid > 0 ? "partial" : "sent";

        await db
          .update(invoices)
          .set({
            achSettlementStatus: "declined",
            amountPaid: revertedAmountPaid,
            balanceDue: Math.max(0, revertedBalanceDue),
            status: revertedStatus,
            paidAt: null,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoice.id));
        declined++;
      } else {
        // Still pending
        stillPending++;
      }
    } catch (err) {
      console.error(
        `ACH settlement check failed for invoice ${invoice.id}:`,
        err
      );
    }
  }

  return NextResponse.json({
    checked: pendingInvoices.length,
    approved,
    declined,
    stillPending,
  });
}
