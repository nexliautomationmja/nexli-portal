import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagements, engagementSigners, invoices, invoiceLineItems } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { generateInvoiceNumber, generateInvoiceToken } from "@/lib/invoice-utils";
import { generateSenderSignatureSvgDataUrl } from "@/lib/signature";
import { generateDrsContent, fillClientPlaceholder } from "@/lib/engagement-defaults";
import { drsSigningInvoiceSpecs } from "@/lib/digital-rainmaker";

/**
 * Test client at "signed the $74,000 annual letter, up-front invoice sent,
 * not paid": a signed DRS annual engagement plus the exact invoice the real
 * signing flow creates (drsSigningInvoiceSpecs), status "sent". No emails or
 * notifications. Tagged { demo: true } so "Remove demo data" deletes it.
 * Onboarding is not opened, matching the real flow (it opens on payment).
 */

const CLIENT = {
  name: "Jordan Test",
  email: "jordan@example.com", // reserved domain: nothing can be delivered
  company: "Harborview Test CPA",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ownerId = session.user.id;
  const origin = req.nextUrl.origin;

  // Reuse an existing unpaid test invoice instead of piling up duplicates.
  const [existing] = await db
    .select({ token: invoices.token })
    .from(invoices)
    .where(
      and(
        eq(invoices.ownerId, ownerId),
        eq(invoices.status, "sent"),
        sql`${invoices.metadata} @> '{"demo":true,"testClient":"annual-unpaid"}'::jsonb`
      )
    )
    .limit(1);
  if (existing) {
    return NextResponse.json({ ok: true, reused: true, invoiceUrl: `${origin}/invoice/${existing.token}` });
  }

  const now = new Date();
  const senderName = session.user.name || session.user.email || "Nexli";
  const senderEmail = session.user.email || "mail@nexli.net";

  try {
    const [engagement] = await db
      .insert(engagements)
      .values({
        ownerId,
        templateId: null,
        subject: `Digital Rainmaker System — ${CLIENT.company}`,
        content: fillClientPlaceholder(generateDrsContent("annual"), CLIENT.company),
        status: "signed",
        sentAt: now,
        expiresAt: new Date(now.getTime() + 365 * 86400000),
        metadata: {
          billingPlan: "annual",
          termMonths: 12,
          clientCompany: CLIENT.company,
          demo: true,
          testClient: "annual-unpaid",
        },
      })
      .returning();

    await db.insert(engagementSigners).values([
      {
        engagementId: engagement.id,
        name: senderName,
        email: senderEmail,
        token: crypto.randomBytes(32).toString("base64url"),
        order: 0,
        status: "signed",
        sentAt: now,
        signedAt: now,
        signatureData: generateSenderSignatureSvgDataUrl(senderName),
        signatureIp: "test",
        signatureUserAgent: "Test client",
        role: "Authorized Representative",
      },
      {
        engagementId: engagement.id,
        name: CLIENT.name,
        email: CLIENT.email,
        token: crypto.randomBytes(32).toString("base64url"),
        order: 1,
        status: "signed",
        sentAt: now,
        signedAt: now,
        signatureData: generateSenderSignatureSvgDataUrl(CLIENT.name),
        signatureIp: "test",
        signatureUserAgent: "Test client",
      },
    ]);

    const [spec] = drsSigningInvoiceSpecs("annual");
    const token = generateInvoiceToken();
    const [invoice] = await db
      .insert(invoices)
      .values({
        ownerId,
        clientName: CLIENT.name,
        clientEmail: CLIENT.email,
        clientCompany: CLIENT.company,
        invoiceNumber: await generateInvoiceNumber(),
        token,
        currency: "usd",
        subtotal: spec.totalCents,
        taxRate: 0,
        taxAmount: 0,
        total: spec.totalCents,
        amountPaid: 0,
        balanceDue: spec.totalCents,
        isRecurring: false,
        dueDate: now,
        notes: spec.notes,
        status: "sent",
        sentAt: now,
        metadata: {
          engagementId: engagement.id,
          drsRole: spec.role,
          adSpendCents: spec.adSpendCents,
          termMonths: 12,
          demo: true,
          testClient: "annual-unpaid",
        },
      })
      .returning();
    await db.insert(invoiceLineItems).values(
      spec.lines.map((line, i) => ({
        invoiceId: invoice.id,
        description: line.description,
        quantity: 100,
        unitPrice: line.amountCents,
        amount: line.amountCents,
        billingType: line.billingType,
        order: i,
      }))
    );

    return NextResponse.json({ ok: true, invoiceUrl: `${origin}/invoice/${token}` });
  } catch (err) {
    console.error("[test-client] annual-unpaid seeding failed:", err);
    // No transactions on neon-http: remove whatever this attempt created.
    await db
      .delete(invoices)
      .where(and(eq(invoices.ownerId, ownerId), sql`${invoices.metadata} @> '{"testClient":"annual-unpaid"}'::jsonb`))
      .catch(() => {});
    await db
      .delete(engagements)
      .where(and(eq(engagements.ownerId, ownerId), sql`${engagements.metadata} @> '{"testClient":"annual-unpaid"}'::jsonb`))
      .catch(() => {});
    return NextResponse.json({ error: "Couldn't create the test client. Please try again." }, { status: 500 });
  }
}
