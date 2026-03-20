import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentLinks, documents, emailLog, users } from "@/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { sendEmailWithLog, buildDocumentReminderEmail } from "@/lib/email";

const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let remindersSent = 0;
  let skipped = 0;

  try {
    // 1. Find all active document links that:
    //    - Are still active (not expired/revoked)
    //    - Have required documents defined
    //    - Have a client email to send to
    //    - Haven't expired yet
    const activeLinks = await db
      .select({
        link: documentLinks,
        ownerName: users.companyName,
        ownerEmail: users.email,
      })
      .from(documentLinks)
      .innerJoin(users, eq(documentLinks.ownerId, users.id))
      .where(
        and(
          eq(documentLinks.status, "active"),
          gt(documentLinks.expiresAt, now)
        )
      );

    for (const row of activeLinks) {
      const link = row.link;

      // Skip if no client email or no required documents
      if (!link.clientEmail || !link.requiredDocuments) {
        skipped++;
        continue;
      }

      const requiredDocs = link.requiredDocuments as string[];
      if (requiredDocs.length === 0) {
        skipped++;
        continue;
      }

      // 2. Count how many documents have been uploaded for this link
      const uploaded = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(documents)
        .where(eq(documents.linkId, link.id));

      const uploadedCount = uploaded[0]?.count || 0;

      // Skip if all documents are uploaded
      if (uploadedCount >= requiredDocs.length) {
        skipped++;
        continue;
      }

      // 3. Check if we already sent a reminder in the last 24 hours
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentReminder = await db
        .select({ id: emailLog.id })
        .from(emailLog)
        .where(
          and(
            eq(emailLog.recipientEmail, link.clientEmail),
            eq(emailLog.emailType, "document_reminder"),
            eq(emailLog.relatedId, link.id),
            eq(emailLog.status, "sent"),
            gt(emailLog.createdAt, twentyFourHoursAgo)
          )
        )
        .limit(1);

      if (recentReminder.length > 0) {
        skipped++;
        continue;
      }

      // 4. Determine which specific documents are missing
      //    Get categories of uploaded documents to compare
      const uploadedDocs = await db
        .select({ category: documents.category, fileName: documents.fileName })
        .from(documents)
        .where(eq(documents.linkId, link.id));

      const uploadedCategories = new Set(
        uploadedDocs.map((d) => (d.category || d.fileName).toLowerCase())
      );

      // Filter required docs to find ones not yet uploaded
      const missingDocs = requiredDocs.filter(
        (doc) => !uploadedCategories.has(doc.toLowerCase())
      );

      // If matching by category didn't find missing docs, just use count-based approach
      const finalMissing =
        missingDocs.length > 0
          ? missingDocs
          : requiredDocs.slice(uploadedCount);

      if (finalMissing.length === 0) {
        skipped++;
        continue;
      }

      // 5. Build and send reminder email
      const uploadUrl = `${PORTAL_URL}/upload/${link.token}`;
      const senderName =
        row.ownerName || row.ownerEmail.split("@")[0] || "Your CPA";

      try {
        const { subject, html } = buildDocumentReminderEmail({
          clientName: link.clientName || "there",
          senderName,
          uploadUrl,
          missingDocs: finalMissing,
          totalRequired: requiredDocs.length,
          uploadedCount,
        });

        await sendEmailWithLog({
          to: link.clientEmail,
          subject,
          html,
          recipientName: link.clientName || undefined,
          emailType: "document_reminder",
          relatedId: link.id,
          sentBy: link.ownerId,
        });

        remindersSent++;
      } catch (err) {
        console.error(
          `Failed to send document reminder for link ${link.id}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error("Document reminder cron failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    remindersSent,
    skipped,
  });
}
