import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceReminders, users } from "@/db/schema";
import { eq, and, lte, isNull, inArray } from "drizzle-orm";
import {
  sendEmail,
  buildInvoiceReminderEmail,
} from "@/lib/email";
import { formatCurrency } from "@/lib/invoice-utils";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let overdueCount = 0;
  let reminderCount = 0;

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

        const cpaName = owner?.name || owner?.email || "Your Service Provider";
        const portalUrl =
          process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
        const invoiceUrl = `${portalUrl}/invoice/${invoice.token}`;
        const isOverdue = invoice.dueDate <= now;

        const { subject, html } = buildInvoiceReminderEmail({
          clientName: invoice.clientName,
          cpaName,
          invoiceNumber: invoice.invoiceNumber,
          total: formatCurrency(invoice.total, invoice.currency),
          dueDate: invoice.dueDate,
          isOverdue,
          invoiceUrl,
        });

        await sendEmail({ to: invoice.clientEmail, subject, html });

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

  return NextResponse.json({
    ok: true,
    overdueMarked: overdueCount,
    remindersSent: reminderCount,
  });
}
