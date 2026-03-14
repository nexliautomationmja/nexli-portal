import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  documentAuditLog,
  documents,
  invoices,
  engagements,
  engagementSigners,
  portalSessions,
} from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";

interface ActivityItem {
  type: "document" | "payment" | "engagement" | "login";
  description: string;
  actorName: string | null;
  timestamp: string;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = session.user.id;
  const activities: ActivityItem[] = [];

  // 1. Recent document uploads/views
  try {
    const docAudit = await db
      .select({
        action: documentAuditLog.action,
        actorName: documentAuditLog.actorName,
        createdAt: documentAuditLog.createdAt,
        fileName: documents.fileName,
      })
      .from(documentAuditLog)
      .leftJoin(documents, eq(documentAuditLog.documentId, documents.id))
      .where(
        sql`(${documentAuditLog.documentId} IN (SELECT id FROM documents WHERE owner_id = ${ownerId})
        OR ${documentAuditLog.linkId} IN (SELECT id FROM document_links WHERE owner_id = ${ownerId}))`
      )
      .orderBy(desc(documentAuditLog.createdAt))
      .limit(10);

    for (const row of docAudit) {
      const actionLabel =
        row.action === "uploaded" ? "uploaded a document" :
        row.action === "viewed" ? "viewed a document" :
        row.action === "downloaded" ? "downloaded a document" :
        row.action === "reviewed" ? "marked a document as reviewed" :
        row.action === "link_accessed" ? "accessed an upload link" :
        `${row.action}`;
      activities.push({
        type: "document",
        description: row.fileName
          ? `${actionLabel}: ${row.fileName}`
          : actionLabel,
        actorName: row.actorName,
        timestamp: row.createdAt.toISOString(),
      });
    }
  } catch (err) {
    console.error("Portal activity: doc audit error", err);
  }

  // 2. Recent invoice payments
  try {
    const paidInvoices = await db
      .select({
        clientName: invoices.clientName,
        invoiceNumber: invoices.invoiceNumber,
        amountPaid: invoices.amountPaid,
        paidAt: invoices.paidAt,
        viewedAt: invoices.viewedAt,
        status: invoices.status,
      })
      .from(invoices)
      .where(eq(invoices.ownerId, ownerId))
      .orderBy(desc(invoices.updatedAt))
      .limit(10);

    for (const inv of paidInvoices) {
      if (inv.paidAt) {
        activities.push({
          type: "payment",
          description: `paid invoice ${inv.invoiceNumber}`,
          actorName: inv.clientName,
          timestamp: inv.paidAt.toISOString(),
        });
      } else if (inv.viewedAt && inv.status === "viewed") {
        activities.push({
          type: "payment",
          description: `viewed invoice ${inv.invoiceNumber}`,
          actorName: inv.clientName,
          timestamp: inv.viewedAt.toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("Portal activity: invoice error", err);
  }

  // 3. Recent engagement signatures
  try {
    const engagementIds = await db
      .select({ id: engagements.id })
      .from(engagements)
      .where(eq(engagements.ownerId, ownerId));

    if (engagementIds.length > 0) {
      const ids = engagementIds.map((e) => e.id);
      const signedSigners = await db
        .select({
          name: engagementSigners.name,
          signedAt: engagementSigners.signedAt,
          engagementId: engagementSigners.engagementId,
        })
        .from(engagementSigners)
        .where(inArray(engagementSigners.engagementId, ids))
        .orderBy(desc(engagementSigners.signedAt))
        .limit(10);

      for (const s of signedSigners) {
        if (s.signedAt) {
          activities.push({
            type: "engagement",
            description: "signed an engagement letter",
            actorName: s.name,
            timestamp: s.signedAt.toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.error("Portal activity: engagement error", err);
  }

  // 4. Recent portal logins (clients who have interacted with owner's data)
  try {
    const recentSessions = await db
      .select({
        email: portalSessions.email,
        clientName: portalSessions.clientName,
        createdAt: portalSessions.createdAt,
      })
      .from(portalSessions)
      .orderBy(desc(portalSessions.createdAt))
      .limit(10);

    for (const ps of recentSessions) {
      activities.push({
        type: "login",
        description: "signed in to the client portal",
        actorName: ps.clientName || ps.email,
        timestamp: ps.createdAt.toISOString(),
      });
    }
  } catch (err) {
    console.error("Portal activity: session error", err);
  }

  // Sort by timestamp descending and take top 20
  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json({ activities: activities.slice(0, 20) });
}
