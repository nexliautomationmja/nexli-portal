import { db } from "@/db";
import {
  invoices,
  invoiceLineItems,
  accountingConnections,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createQuickBooksInvoice, recordQuickBooksPayment } from "./quickbooks";
import { createXeroInvoice, recordXeroPayment } from "./xero";
import { createCustomBooksInvoice, recordCustomBooksPayment } from "./custombooks";

/**
 * Sync an invoice to connected accounting software.
 * Non-blocking: errors are logged but never throw.
 */
export async function syncInvoiceToAccounting(invoiceId: string) {
  try {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) return;

    // Check for accounting connections
    const connections = await db
      .select()
      .from(accountingConnections)
      .where(eq(accountingConnections.userId, invoice.ownerId));

    if (connections.length === 0) return;

    const items = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    const lineItemsFormatted = items
      .sort((a, b) => a.order - b.order)
      .map((li) => ({
        description: li.description,
        quantity: li.quantity / 100,
        unitPrice: li.unitPrice / 100,
        amount: li.amount / 100,
      }));

    const dueDateStr = invoice.dueDate.toISOString().split("T")[0];
    const taxRate = (invoice.taxRate || 0) / 100; // basis points → percentage

    for (const conn of connections) {
      try {
        if (conn.provider === "quickbooks") {
          const qbId = await createQuickBooksInvoice(invoice.ownerId, {
            clientName: invoice.clientName,
            clientEmail: invoice.clientEmail,
            invoiceNumber: invoice.invoiceNumber,
            lineItems: lineItemsFormatted,
            dueDate: dueDateStr,
            taxRate,
          });
          if (qbId) {
            await db
              .update(invoices)
              .set({ qbInvoiceId: qbId, updatedAt: new Date() })
              .where(eq(invoices.id, invoiceId));
          }
        } else if (conn.provider === "xero") {
          const xeroId = await createXeroInvoice(invoice.ownerId, {
            clientName: invoice.clientName,
            clientEmail: invoice.clientEmail,
            invoiceNumber: invoice.invoiceNumber,
            lineItems: lineItemsFormatted,
            dueDate: dueDateStr,
            taxRate,
          });
          if (xeroId) {
            await db
              .update(invoices)
              .set({ xeroInvoiceId: xeroId, updatedAt: new Date() })
              .where(eq(invoices.id, invoiceId));
          }
        } else if (conn.provider === "custombooks") {
          const cbId = await createCustomBooksInvoice(invoice.ownerId, {
            clientName: invoice.clientName,
            clientEmail: invoice.clientEmail,
            invoiceNumber: invoice.invoiceNumber,
            lineItems: lineItemsFormatted,
            dueDate: dueDateStr,
            taxRate,
          });
          if (cbId) {
            await db
              .update(invoices)
              .set({ customBooksInvoiceId: cbId, updatedAt: new Date() })
              .where(eq(invoices.id, invoiceId));
          }
        }

        // Update last sync timestamp
        await db
          .update(accountingConnections)
          .set({ lastSyncAt: new Date(), updatedAt: new Date() })
          .where(eq(accountingConnections.id, conn.id));
      } catch (err) {
        console.error(
          `Failed to sync invoice ${invoiceId} to ${conn.provider}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error(`syncInvoiceToAccounting error for ${invoiceId}:`, err);
  }
}

/**
 * Record a payment in connected accounting software.
 * Non-blocking: errors are logged but never throw.
 */
export async function syncPaymentToAccounting(invoiceId: string) {
  try {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) return;

    const connections = await db
      .select()
      .from(accountingConnections)
      .where(eq(accountingConnections.userId, invoice.ownerId));

    if (connections.length === 0) return;

    const amountDollars = invoice.total / 100;
    const paidDateStr = (invoice.paidAt || new Date())
      .toISOString()
      .split("T")[0];

    for (const conn of connections) {
      try {
        if (conn.provider === "quickbooks" && invoice.qbInvoiceId) {
          await recordQuickBooksPayment(
            invoice.ownerId,
            invoice.qbInvoiceId,
            amountDollars
          );
        } else if (conn.provider === "xero" && invoice.xeroInvoiceId) {
          await recordXeroPayment(
            invoice.ownerId,
            invoice.xeroInvoiceId,
            amountDollars,
            paidDateStr
          );
        } else if (conn.provider === "custombooks" && invoice.customBooksInvoiceId) {
          await recordCustomBooksPayment(
            invoice.ownerId,
            invoice.customBooksInvoiceId,
            amountDollars
          );
        }

        await db
          .update(accountingConnections)
          .set({ lastSyncAt: new Date(), updatedAt: new Date() })
          .where(eq(accountingConnections.id, conn.id));
      } catch (err) {
        console.error(
          `Failed to sync payment for invoice ${invoiceId} to ${conn.provider}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error(`syncPaymentToAccounting error for ${invoiceId}:`, err);
  }
}
