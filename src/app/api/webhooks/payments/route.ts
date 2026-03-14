import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyHelcimWebhook, getHelcimTransaction } from "@/lib/helcim";
import {
  sendEmailWithLog,
  buildInvoicePaidEmail,
  buildPaymentReceiptEmail,
} from "@/lib/email";
import { formatCurrency } from "@/lib/invoice-utils";
import { syncPaymentToAccounting } from "@/lib/accounting-sync";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const webhookId = req.headers.get("webhook-id") || "";
  const webhookTimestamp = req.headers.get("webhook-timestamp") || "";
  const webhookSignature = req.headers.get("webhook-signature") || "";

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return NextResponse.json(
      { error: "Missing webhook headers" },
      { status: 400 }
    );
  }

  const isValid = verifyHelcimWebhook({
    webhookId,
    webhookTimestamp,
    webhookSignature,
    rawBody,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody) as { id: number; type: string };

  // Only process card/ACH transactions
  if (payload.type !== "cardTransaction") {
    return NextResponse.json({ received: true });
  }

  // Fetch full transaction details from Helcim
  const transaction = await getHelcimTransaction(payload.id);

  // Skip declined transactions
  if (transaction.statusAuth === 2) {
    return NextResponse.json({ received: true });
  }

  // Look up invoice by invoiceNumber (matches our invoiceNumber, has unique index)
  if (!transaction.invoiceNumber) {
    return NextResponse.json({ received: true });
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.invoiceNumber, transaction.invoiceNumber))
    .limit(1);

  if (!invoice) {
    console.error(
      `Helcim webhook: no invoice found for invoiceNumber ${transaction.invoiceNumber}`
    );
    return NextResponse.json({ received: true });
  }

  // Idempotency guard: skip if we already processed this transaction
  if (invoice.helcimTransactionId === String(transaction.transactionId)) {
    return NextResponse.json({ received: true });
  }

  // Convert Helcim dollars to cents for internal storage
  const paymentAmountCents = Math.round(transaction.amount * 100);
  const newAmountPaid = invoice.amountPaid + paymentAmountCents;
  const newBalanceDue = Math.max(0, invoice.total - newAmountPaid);
  const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

  const isACH = transaction.statusAuth === 5;

  const [updated] = await db
    .update(invoices)
    .set({
      status: newStatus,
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      paidAt: newStatus === "paid" ? new Date() : null,
      helcimTransactionId: String(transaction.transactionId),
      paymentMethod: isACH ? "ach" : "card",
      achSettlementStatus: isACH ? "pending" : null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ received: true });
  }

  // Send notification email to CPA
  try {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, updated.ownerId))
      .limit(1);

    if (owner?.email) {
      const paidLabel =
        newStatus === "paid"
          ? formatCurrency(updated.total, updated.currency)
          : `${formatCurrency(paymentAmountCents, updated.currency)} (partial — ${formatCurrency(newBalanceDue, updated.currency)} remaining)`;

      const achNote = isACH ? " (ACH — pending settlement)" : "";

      const { subject, html } = buildInvoicePaidEmail({
        senderName: owner.name || owner.email,
        clientName: updated.clientName,
        invoiceNumber: updated.invoiceNumber,
        total: paidLabel + achNote,
        paidAt: new Date(),
      });
      await sendEmailWithLog({
        to: owner.email,
        subject,
        html,
        recipientName: owner.name || undefined,
        emailType: "invoice_paid",
        relatedId: updated.id,
      });
    }
  } catch (err) {
    console.error("Failed to send invoice paid email:", err);
  }

  // Send payment receipt to client
  try {
    const portalUrl =
      process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

    const [owner] = await db
      .select({
        name: users.name,
        email: users.email,
        companyName: users.companyName,
      })
      .from(users)
      .where(eq(users.id, updated.ownerId))
      .limit(1);

    const senderLabel =
      owner?.companyName ||
      owner?.name ||
      owner?.email ||
      "Your Service Provider";

    const { subject: receiptSubject, html: receiptHtml } =
      buildPaymentReceiptEmail({
        clientName: updated.clientName,
        senderName: senderLabel,
        invoiceNumber: updated.invoiceNumber,
        amountPaid: formatCurrency(paymentAmountCents, updated.currency),
        totalInvoice: formatCurrency(updated.total, updated.currency),
        remainingBalance:
          newBalanceDue > 0
            ? formatCurrency(newBalanceDue, updated.currency)
            : null,
        paidAt: new Date(),
        portalUrl,
      });
    await sendEmailWithLog({
      to: updated.clientEmail,
      subject: receiptSubject,
      html: receiptHtml,
      recipientName: updated.clientName,
      emailType: "payment_receipt",
      relatedId: updated.id,
    });
  } catch (err) {
    console.error("Failed to send payment receipt:", err);
  }

  // In-app notification
  try {
    await createNotification({
      userId: updated.ownerId,
      type: "invoice_paid",
      title: "Invoice Paid",
      message: `${updated.clientName} paid invoice ${updated.invoiceNumber}${isACH ? " (ACH — pending settlement)" : ""}`,
      metadata: {
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        clientName: updated.clientName,
      },
    });
  } catch (err) {
    console.error("Invoice paid notification failed:", err);
  }

  // Sync payment to accounting software (non-blocking)
  syncPaymentToAccounting(invoice.id).catch((err) =>
    console.error("Accounting payment sync failed:", err)
  );

  return NextResponse.json({ received: true });
}
