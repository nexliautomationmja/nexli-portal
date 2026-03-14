import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  invoices,
  documents,
  documentLinks,
  eSignatures,
  engagementSigners,
  engagements,
  taxReturns,
} from "@/db/schema";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.email;

  // Invoices
  const clientInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.clientEmail, email),
        // Exclude drafts — client shouldn't see unsent invoices
      )
    )
    .orderBy(desc(invoices.createdAt));

  const visibleInvoices = clientInvoices.filter((i) => i.status !== "draft");
  const unpaidInvoices = visibleInvoices.filter((i) =>
    ["sent", "viewed", "overdue", "partial"].includes(i.status)
  );
  const totalOwed = unpaidInvoices.reduce((sum, i) => sum + i.balanceDue, 0);

  // Documents
  const clientDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.clientEmail, email));

  // Active upload links
  const activeLinks = await db
    .select()
    .from(documentLinks)
    .where(
      and(eq(documentLinks.clientEmail, email), eq(documentLinks.status, "active"))
    );

  // E-signature requests
  const esignRequests = await db
    .select()
    .from(eSignatures)
    .where(eq(eSignatures.signerEmail, email));

  const pendingEsigns = esignRequests.filter((e) =>
    ["pending", "sent", "viewed"].includes(e.status)
  );

  // Engagement letters
  const signerRows = await db
    .select()
    .from(engagementSigners)
    .where(eq(engagementSigners.email, email));

  const pendingEngagements = signerRows.filter((s) =>
    ["sent", "viewed"].includes(s.status)
  );

  // Tax returns
  const clientReturns = await db
    .select()
    .from(taxReturns)
    .where(eq(taxReturns.clientEmail, email));

  const inProgressReturns = clientReturns.filter((r) =>
    ["not_started", "documents_received", "in_progress"].includes(r.status)
  );

  // Build action items
  type ActionItem = {
    type: string;
    title: string;
    description: string;
    href?: string;
    date: string;
  };

  const actionItems: ActionItem[] = [];

  for (const inv of unpaidInvoices.slice(0, 3)) {
    actionItems.push({
      type: "invoice",
      title: `Invoice ${inv.invoiceNumber}`,
      description: `$${(inv.balanceDue / 100).toFixed(2)} due`,
      href: `/invoice/${inv.token}`,
      date: (inv.createdAt ?? new Date()).toISOString(),
    });
  }

  for (const es of pendingEsigns.slice(0, 3)) {
    actionItems.push({
      type: "esign",
      title: "Document requires signature",
      description: "Review and sign",
      href: `/esign/${es.token}`,
      date: (es.createdAt ?? new Date()).toISOString(),
    });
  }

  for (const link of activeLinks.slice(0, 3)) {
    actionItems.push({
      type: "upload",
      title: "Document upload requested",
      description: `${Array.isArray(link.requiredDocuments) ? link.requiredDocuments.length : 0} documents needed`,
      href: `/upload/${link.token}`,
      date: (link.createdAt ?? new Date()).toISOString(),
    });
  }

  for (const s of pendingEngagements.slice(0, 3)) {
    actionItems.push({
      type: "engagement",
      title: "Engagement letter",
      description: "Review and sign",
      href: `/engage/${s.token}`,
      date: (s.createdAt ?? new Date()).toISOString(),
    });
  }

  // Sort action items by date (newest first)
  actionItems.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Build recent activity (last 10 items)
  type ActivityItem = {
    type: string;
    title: string;
    status: string;
    date: string;
  };

  const activity: ActivityItem[] = [];

  for (const inv of visibleInvoices.slice(0, 5)) {
    activity.push({
      type: "invoice",
      title: `Invoice ${inv.invoiceNumber} — $${(inv.total / 100).toFixed(2)}`,
      status: inv.status,
      date: (inv.createdAt ?? new Date()).toISOString(),
    });
  }

  for (const doc of clientDocs.slice(0, 5)) {
    activity.push({
      type: "document",
      title: doc.fileName,
      status: doc.status,
      date: (doc.createdAt ?? new Date()).toISOString(),
    });
  }

  for (const ret of clientReturns.slice(0, 5)) {
    activity.push({
      type: "tax_return",
      title: `${ret.returnType} — ${ret.taxYear}`,
      status: ret.status,
      date: (ret.createdAt ?? new Date()).toISOString(),
    });
  }

  activity.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return NextResponse.json({
    stats: {
      totalOwed,
      unpaidCount: unpaidInvoices.length,
      paidCount: visibleInvoices.filter((i) => i.status === "paid").length,
      documentCount: clientDocs.length,
      pendingSignatures: pendingEsigns.length + pendingEngagements.length,
      taxReturnsInProgress: inProgressReturns.length,
      taxReturnsTotal: clientReturns.length,
    },
    actionItems: actionItems.slice(0, 5),
    recentActivity: activity.slice(0, 10),
    clientName: session.clientName,
  });
}
