import { db } from "@/db";
import { invoices } from "@/db/schema";
import { like, desc } from "drizzle-orm";
import crypto from "crypto";

export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [latest] = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(like(invoices.invoiceNumber, `${prefix}-%`))
    .orderBy(desc(invoices.invoiceNumber))
    .limit(1);

  let seq = 1;
  if (latest?.invoiceNumber) {
    const parts = latest.invoiceNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export function generateInvoiceToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function calculateLineAmount(
  quantity: number,
  unitPrice: number
): number {
  return Math.round((quantity / 100) * unitPrice);
}

export function calculateInvoiceTotals(
  lineItems: { amount: number }[],
  taxRate: number
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = Math.round((subtotal * taxRate) / 10000);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export function formatCurrency(cents: number, currency: string = "usd"): string {
  const dollars = cents / 100;
  const symbols: Record<string, string> = {
    usd: "$",
    cad: "CA$",
    gbp: "£",
    eur: "€",
    aud: "A$",
  };
  const symbol = symbols[currency] || "$";
  return `${symbol}${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
