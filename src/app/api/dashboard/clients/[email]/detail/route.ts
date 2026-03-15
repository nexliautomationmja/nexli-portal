import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  invoices,
  engagements,
  engagementSigners,
  portalMessages,
  portalMagicLinks,
  portalSessions,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email: rawEmail } = await params;
  const clientEmail = decodeURIComponent(rawEmail).toLowerCase().trim();
  const ownerId = session.user.id;

  // 1. Invoices for this client
  const clientInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      balanceDue: invoices.balanceDue,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      paymentMethod: invoices.paymentMethod,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(
      and(eq(invoices.ownerId, ownerId), eq(invoices.clientEmail, clientEmail))
    )
    .orderBy(desc(invoices.createdAt));

  // Get client name/phone/company from latest invoice
  const [clientInfo] = await db
    .select({
      name: invoices.clientName,
      phone: invoices.clientPhone,
      company: invoices.clientCompany,
    })
    .from(invoices)
    .where(
      and(eq(invoices.ownerId, ownerId), eq(invoices.clientEmail, clientEmail))
    )
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  // 2. Engagements where this email is a signer
  const clientEngagements = await db
    .select({
      id: engagements.id,
      subject: engagements.subject,
      status: engagements.status,
      sentAt: engagements.sentAt,
      signerStatus: engagementSigners.status,
      signedAt: engagementSigners.signedAt,
      createdAt: engagements.createdAt,
    })
    .from(engagementSigners)
    .innerJoin(engagements, eq(engagementSigners.engagementId, engagements.id))
    .where(
      and(
        eq(engagements.ownerId, ownerId),
        eq(engagementSigners.email, clientEmail),
        sql`${engagementSigners.order} > 0`
      )
    )
    .orderBy(desc(engagements.createdAt));

  // If no invoice info, try engagement signers for name
  let name = clientInfo?.name || null;
  if (!name && clientEngagements.length > 0) {
    const [signer] = await db
      .select({ name: engagementSigners.name })
      .from(engagementSigners)
      .where(eq(engagementSigners.email, clientEmail))
      .limit(1);
    name = signer?.name || null;
  }

  // 3. Messages summary
  const [msgStats] = await db
    .select({
      unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${portalMessages.senderType} = 'client' AND ${portalMessages.read} = false)::int`,
      totalCount: sql<number>`COUNT(*)::int`,
      lastMessageAt: sql<string | null>`MAX(${portalMessages.createdAt})`,
    })
    .from(portalMessages)
    .where(
      and(
        eq(portalMessages.ownerId, ownerId),
        eq(portalMessages.clientEmail, clientEmail)
      )
    );

  // 4. Payments from paid invoices
  const payments = clientInvoices
    .filter((inv) => inv.paidAt && inv.amountPaid > 0)
    .map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amountPaid,
      paidAt: inv.paidAt,
      paymentMethod: inv.paymentMethod,
    }))
    .sort((a, b) => {
      if (!a.paidAt || !b.paidAt) return 0;
      return new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime();
    });

  // 5. Portal access
  const [lastMagicLink] = await db
    .select({
      lastLogin: sql<string | null>`MAX(${portalMagicLinks.usedAt})`,
    })
    .from(portalMagicLinks)
    .where(eq(portalMagicLinks.email, clientEmail));

  const [activeSession] = await db
    .select({
      active: sql<boolean>`EXISTS(
        SELECT 1 FROM portal_sessions
        WHERE email = ${clientEmail}
          AND expires_at > NOW()
      )`,
    })
    .from(portalSessions)
    .limit(1);

  return NextResponse.json({
    client: {
      name: name || clientEmail.split("@")[0],
      email: clientEmail,
      phone: clientInfo?.phone || null,
      company: clientInfo?.company || null,
    },
    invoices: clientInvoices,
    engagements: clientEngagements,
    messages: {
      unreadCount: msgStats?.unreadCount || 0,
      totalCount: msgStats?.totalCount || 0,
      lastMessageAt: msgStats?.lastMessageAt || null,
    },
    payments,
    portalAccess: {
      lastLogin: lastMagicLink?.lastLogin || null,
      sessionActive: activeSession?.active || false,
    },
  });
}
