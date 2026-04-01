import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentLinks, emailLog, users } from "@/db/schema";
import { eq, and, gt, like } from "drizzle-orm";
import {
  sendEmailWithLog,
  buildTaxOrganizerDocReminderEmail,
} from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let remindersSent = 0;
  let skipped = 0;

  try {
    // Find active document links created from tax organizer submissions
    // (identified by message starting with "tax-organizer:")
    // that haven't received uploads yet
    const pendingLinks = await db
      .select()
      .from(documentLinks)
      .where(
        and(
          like(documentLinks.message, "tax-organizer:%"),
          eq(documentLinks.status, "active"),
          gt(documentLinks.expiresAt, now),
          eq(documentLinks.uploadCount, 0)
        )
      );

    for (const link of pendingLinks) {
      try {
        // Check if we already sent a reminder today for this link
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [recentReminder] = await db
          .select({ id: emailLog.id })
          .from(emailLog)
          .where(
            and(
              eq(emailLog.emailType, "tax_organizer_doc_reminder"),
              eq(emailLog.relatedId, link.id),
              gt(emailLog.createdAt, today)
            )
          )
          .limit(1);

        if (recentReminder) {
          skipped++;
          continue;
        }

        // Don't send reminder on the same day the link was created
        const createdDate = new Date(link.createdAt);
        createdDate.setHours(0, 0, 0, 0);
        if (createdDate.getTime() === today.getTime()) {
          skipped++;
          continue;
        }

        if (!link.clientEmail) {
          skipped++;
          continue;
        }

        const requiredDocs = (link.requiredDocuments as string[]) || [];
        if (requiredDocs.length === 0) {
          skipped++;
          continue;
        }

        // Get CPA name
        const [owner] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, link.ownerId))
          .limit(1);

        const senderName =
          owner?.name || owner?.email || "Your Tax Professional";
        const portalUrl =
          process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
        const uploadUrl = `${portalUrl}/upload/${link.token}`;

        // Extract tax year from the submission if possible, otherwise use current year
        const taxYear = String(now.getFullYear() - 1);

        const { subject, html } = buildTaxOrganizerDocReminderEmail({
          clientName: link.clientName || "Client",
          senderName,
          taxYear,
          recommendedDocs: requiredDocs,
          uploadUrl,
          expiresAt: link.expiresAt,
        });

        await sendEmailWithLog({
          to: link.clientEmail,
          subject,
          html,
          recipientName: link.clientName || undefined,
          emailType: "tax_organizer_doc_reminder",
          relatedId: link.id,
          sentBy: link.ownerId,
        });

        remindersSent++;
      } catch (err) {
        console.error(
          `Failed to send tax organizer reminder for link ${link.id}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error("Failed to process tax organizer reminders:", err);
  }

  return NextResponse.json({
    ok: true,
    remindersSent,
    skipped,
  });
}
