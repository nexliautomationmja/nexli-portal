import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceReminders, invoiceLineItems, users } from "@/db/schema";
import { eq, and, lte, isNull, inArray, not } from "drizzle-orm";
import {
  sendEmailWithLog,
  buildInvoiceReminderEmail,
} from "@/lib/email";
import {
  formatCurrency,
  generateInvoiceNumber,
  generateInvoiceToken,
} from "@/lib/invoice-utils";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let overdueCount = 0;
  let reminderCount = 0;
  let recurredCount = 0;

  // 1. Mark overdue invoices
  try {
    const result = await db
      .update(invoices)
      .set({ status: "overdue", updatedAt: now })
      .where(
        and(
          lte(invoices.dueDate, now),
          inArray(invoices.status, ["sent", "viewed"])
        )
      )
      .returning({ id: invoices.id });

    overdueCount = result.length;
  } catch (err) {
    console.error("Failed to mark overdue invoices:", err);
  }

  // 2. Send pending reminders
  try {
    const pendingReminders = await db
      .select({
        reminder: invoiceReminders,
        invoice: invoices,
      })
      .from(invoiceReminders)
      .innerJoin(invoices, eq(invoiceReminders.invoiceId, invoices.id))
      .where(
        and(
          lte(invoiceReminders.scheduledFor, now),
          isNull(invoiceReminders.sentAt)
        )
      );

    for (const { reminder, invoice } of pendingReminders) {
      // Skip if invoice is no longer actionable
      if (["paid", "canceled", "void"].includes(invoice.status)) {
        // Mark as sent so we don't re-process
        await db
          .update(invoiceReminders)
          .set({ sentAt: now })
          .where(eq(invoiceReminders.id, reminder.id));
        continue;
      }

      try {
        // Get the CPA name
        const [owner] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, invoice.ownerId))
          .limit(1);

        const senderName = owner?.name || owner?.email || "Your Service Provider";
        const portalUrl =
          process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
        const invoiceUrl = `${portalUrl}/invoice/${invoice.token}`;
        const isOverdue = invoice.dueDate <= now;

        const { subject, html } = buildInvoiceReminderEmail({
          clientName: invoice.clientName,
          senderName,
          invoiceNumber: invoice.invoiceNumber,
          total: formatCurrency(invoice.total, invoice.currency),
          dueDate: invoice.dueDate,
          isOverdue,
          invoiceUrl,
        });

        await sendEmailWithLog({ to: invoice.clientEmail, subject, html, recipientName: invoice.clientName, emailType: "invoice_reminder", relatedId: invoice.id });

        await db
          .update(invoiceReminders)
          .set({ sentAt: now })
          .where(eq(invoiceReminders.id, reminder.id));

        reminderCount++;
      } catch (err) {
        console.error(
          `Failed to send reminder ${reminder.id} for invoice ${invoice.id}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error("Failed to process invoice reminders:", err);
  }

  // 3. Generate invoices from recurring templates
  try {
    const recurringTemplates = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.isRecurring, true),
          lte(invoices.nextRecurrenceDate, now),
          not(inArray(invoices.status, ["canceled", "void"]))
        )
      );

    for (const template of recurringTemplates) {
      try {
        const newInvoiceNumber = await generateInvoiceNumber();
        const newToken = generateInvoiceToken();

        // Calculate due date based on recurring interval
        const dueDate = new Date(now);
        switch (template.recurringInterval) {
          case "weekly":
            dueDate.setDate(dueDate.getDate() + 7);
            break;
          case "biweekly":
            dueDate.setDate(dueDate.getDate() + 14);
            break;
          case "monthly":
            dueDate.setMonth(dueDate.getMonth() + 1);
            break;
          case "quarterly":
            dueDate.setMonth(dueDate.getMonth() + 3);
            break;
          case "yearly":
            dueDate.setFullYear(dueDate.getFullYear() + 1);
            break;
        }

        // Create the new invoice
        const [newInvoice] = await db
          .insert(invoices)
          .values({
            ownerId: template.ownerId,
            clientName: template.clientName,
            clientEmail: template.clientEmail,
            clientPhone: template.clientPhone,
            clientCompany: template.clientCompany,
            invoiceNumber: newInvoiceNumber,
            token: newToken,
            status: "draft",
            currency: template.currency,
            subtotal: template.subtotal,
            taxRate: template.taxRate,
            taxAmount: template.taxAmount,
            total: template.total,
            issueDate: now,
            dueDate,
            notes: template.notes,
            terms: template.terms,
            reminderConfig: template.reminderConfig,
            amountPaid: 0,
            balanceDue: template.total,
            recurringParentId: template.id,
          })
          .returning({ id: invoices.id });

        // Copy line items from the parent invoice
        const parentLineItems = await db
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, template.id));

        if (parentLineItems.length > 0) {
          await db.insert(invoiceLineItems).values(
            parentLineItems.map((item) => ({
              invoiceId: newInvoice.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
              order: item.order,
            }))
          );
        }

        // Calculate the next recurrence date for the parent template
        const nextDate = new Date(template.nextRecurrenceDate!);
        switch (template.recurringInterval) {
          case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case "biweekly":
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case "quarterly":
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case "yearly":
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }

        // If next recurrence exceeds end date, stop recurring
        const shouldStopRecurring =
          template.recurringEndDate && nextDate > template.recurringEndDate;

        await db
          .update(invoices)
          .set({
            nextRecurrenceDate: shouldStopRecurring ? null : nextDate,
            isRecurring: !shouldStopRecurring,
            updatedAt: now,
          })
          .where(eq(invoices.id, template.id));

        recurredCount++;
      } catch (err) {
        console.error(
          `Failed to generate recurring invoice from template ${template.id}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error("Failed to process recurring invoices:", err);
  }

  return NextResponse.json({
    ok: true,
    overdueMarked: overdueCount,
    remindersSent: reminderCount,
    recurringGenerated: recurredCount,
  });
}
