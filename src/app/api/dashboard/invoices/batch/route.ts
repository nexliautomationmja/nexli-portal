import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, invoiceLineItems } from "@/db/schema";
import {
  generateInvoiceNumber,
  generateInvoiceToken,
  dollarsToCents,
  calculateLineAmount,
  calculateInvoiceTotals,
} from "@/lib/invoice-utils";

interface BatchClient {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientCompany?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    clients,
    lineItems,
    taxRate = 0,
    dueDate,
    notes,
    terms,
    currency = "usd",
    reminderConfig,
    sendImmediately = false,
  } = body;

  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json(
      { error: "At least one client is required" },
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

  type BillingType = "one_time" | "monthly" | "quarterly" | "yearly";
  const validBillingTypes: BillingType[] = ["one_time", "monthly", "quarterly", "yearly"];

  // Process line items once
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

  const created: string[] = [];
  const errors: string[] = [];

  for (const client of clients as BatchClient[]) {
    if (!client.clientName || !client.clientEmail) {
      errors.push(`Skipped: missing name or email`);
      continue;
    }

    try {
      const invoiceNumber = await generateInvoiceNumber();
      const token = generateInvoiceToken();

      const [invoice] = await db
        .insert(invoices)
        .values({
          ownerId: session.user.id,
          clientName: client.clientName,
          clientEmail: client.clientEmail,
          clientPhone: client.clientPhone || null,
          clientCompany: client.clientCompany || null,
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
          dueDate: dueDateObj,
          notes: notes || null,
          terms: terms || null,
          reminderConfig: reminderConfig || null,
          status: "draft",
        })
        .returning();

      for (const item of processedItems) {
        await db.insert(invoiceLineItems).values({
          invoiceId: invoice.id,
          ...item,
        });
      }

      // If sendImmediately, trigger send
      if (sendImmediately) {
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net"}/api/dashboard/invoices/${invoice.id}/send`,
            {
              method: "POST",
              headers: {
                cookie: req.headers.get("cookie") || "",
              },
            }
          );
        } catch {
          // Invoice created as draft if send fails
        }
      }

      created.push(invoice.id);
    } catch (err) {
      errors.push(
        `Failed for ${client.clientEmail}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return NextResponse.json(
    {
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
      invoiceIds: created,
    },
    { status: 201 }
  );
}
