/**
 * Digital Rainmaker System — Auto-Invoicing Flow
 *
 * When an engagement letter built from the "Digital Rainmaker System" template
 * is fully signed by all parties, this module creates a single recurring
 * platform invoice that mirrors the flat all-in-one fee structure:
 *
 *   - Monthly plan → $4,997/month, recurring monthly, due at signing
 *   - Annual plan  → $39,997/year prepaid, recurring yearly, due at signing
 *
 * There are no setup fees and no separate ad-management invoices — ad
 * management is performance-based and billed manually as results come in
 * (see AD_PERFORMANCE in drs-pricing.ts). The billing plan is snapshotted
 * onto engagement.metadata at compose time so a signed client keeps their
 * plan even if pricing changes.
 *
 * Each generated invoice carries metadata { engagementId, drsRole } where
 * drsRole is "platform_monthly" or "platform_annual". The existing recurring
 * cron (api/cron/invoice-reminders) rolls the parent invoice forward by its
 * interval, so subsequent monthly/annual invoices are generated automatically.
 *
 * Template detection is by name (case-insensitive contains "digital rainmaker").
 */

import { db } from "@/db";
import {
  engagements,
  engagementSigners,
  engagementTemplates,
  invoices,
  invoiceLineItems,
  users,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  generateInvoiceNumber,
  generateInvoiceToken,
  formatCurrency,
} from "@/lib/invoice-utils";
import { sendEmailWithLog, buildInvoiceEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

// Pricing lives in drs-pricing.ts (client-safe module); re-exported here so
// existing server-side imports keep working.
import { DRS_PRICING, AD_PERFORMANCE, type BillingPlan } from "./drs-pricing";

export { DRS_PRICING, AD_PERFORMANCE } from "./drs-pricing";
export type { BillingPlan } from "./drs-pricing";

export type DrsRole = "platform_monthly" | "platform_annual";

interface DrsMetadata {
  engagementId: string;
  drsRole: DrsRole;
}

interface EngagementMeta {
  billingPlan?: BillingPlan;
}

// ── Template Detection ────────────────────────────────────

/**
 * Returns true if the given template is a Digital Rainmaker template
 * (detected by name, case-insensitive).
 */
export async function isDigitalRainmakerEngagement(
  templateId: string | null
): Promise<boolean> {
  if (!templateId) return false;
  const [template] = await db
    .select({ name: engagementTemplates.name })
    .from(engagementTemplates)
    .where(eq(engagementTemplates.id, templateId))
    .limit(1);
  if (!template) return false;
  return template.name.toLowerCase().includes("digital rainmaker");
}

// ── Idempotency Helper ────────────────────────────────────

/** True if a platform invoice already exists for this engagement. */
async function drsInvoiceExists(engagementId: string): Promise<boolean> {
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      sql`${invoices.metadata} @> ${JSON.stringify({ engagementId })}::jsonb`
    )
    .limit(1);
  return rows.length > 0;
}

// ── Invoice Send Helper ───────────────────────────────────

async function emailInvoiceToClient(
  invoice: typeof invoices.$inferSelect,
  ownerId: string
) {
  try {
    const [owner] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);

    const senderName = owner?.name || owner?.email || "Your Service Provider";
    const portalUrl =
      process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";
    const invoiceUrl = `${portalUrl}/invoice/${invoice.token}`;

    const { subject, html } = buildInvoiceEmail({
      clientName: invoice.clientName,
      senderName,
      invoiceNumber: invoice.invoiceNumber,
      total: formatCurrency(invoice.total, invoice.currency),
      dueDate: invoice.dueDate,
      invoiceUrl,
    });

    await sendEmailWithLog({
      to: invoice.clientEmail,
      subject,
      html,
      recipientName: invoice.clientName,
      emailType: "invoice",
      relatedId: invoice.id,
      sentBy: ownerId,
    });
  } catch (err) {
    console.error("DRS: failed to email invoice to client:", err);
  }
}

// ── Public Trigger ────────────────────────────────────────

interface PostSignTriggerArgs {
  engagement: typeof engagements.$inferSelect;
  primarySigner: {
    name: string;
    email: string;
  };
}

/**
 * Called from the engage route after all signers have signed. For a Digital
 * Rainmaker engagement, creates the single recurring platform invoice
 * (monthly or annual) due at signing.
 *
 * Idempotent — will only create the invoice once per engagement.
 */
export async function triggerDrsPostSign(args: PostSignTriggerArgs) {
  const { engagement, primarySigner } = args;

  if (!(await isDigitalRainmakerEngagement(engagement.templateId))) {
    return null;
  }
  if (await drsInvoiceExists(engagement.id)) {
    return null;
  }

  const engMeta = (engagement.metadata ?? {}) as EngagementMeta;
  const plan: BillingPlan = engMeta.billingPlan === "annual" ? "annual" : "monthly";

  const isAnnual = plan === "annual";
  const amountCents = isAnnual
    ? DRS_PRICING.ANNUAL_CENTS
    : DRS_PRICING.MONTHLY_CENTS;
  const role: DrsRole = isAnnual ? "platform_annual" : "platform_monthly";
  const description = isAnnual
    ? "Digital Rainmaker System — Annual (Paid in Full)"
    : "Digital Rainmaker System — Monthly";

  const dueDate = new Date(); // due immediately at signing

  // Next recurrence: one interval out, so the cron generates the next invoice
  // when this billing cycle ends.
  const nextRecurrence = new Date(dueDate);
  if (isAnnual) {
    nextRecurrence.setFullYear(nextRecurrence.getFullYear() + 1);
  } else {
    nextRecurrence.setMonth(nextRecurrence.getMonth() + 1);
  }

  const invoiceNumber = await generateInvoiceNumber();
  const token = generateInvoiceToken();
  const metadata: DrsMetadata = { engagementId: engagement.id, drsRole: role };

  const [invoice] = await db
    .insert(invoices)
    .values({
      ownerId: engagement.ownerId,
      clientName: primarySigner.name,
      clientEmail: primarySigner.email,
      invoiceNumber,
      token,
      currency: "usd",
      subtotal: amountCents,
      taxRate: 0,
      taxAmount: 0,
      total: amountCents,
      amountPaid: 0,
      balanceDue: amountCents,
      isRecurring: true,
      recurringInterval: isAnnual ? "yearly" : "monthly",
      nextRecurrenceDate: nextRecurrence,
      dueDate,
      notes: isAnnual
        ? "Annual all-in-one investment for the Digital Rainmaker System, paid in full. Renews yearly."
        : "Monthly all-in-one investment for the Digital Rainmaker System. Billed automatically each month.",
      status: "sent",
      sentAt: new Date(),
      metadata,
    })
    .returning();

  await db.insert(invoiceLineItems).values({
    invoiceId: invoice.id,
    description,
    quantity: 100, // qty 1 (stored × 100)
    unitPrice: amountCents,
    amount: amountCents,
    billingType: isAnnual ? "yearly" : "monthly",
    order: 0,
  });

  await emailInvoiceToClient(invoice, engagement.ownerId);

  try {
    await createNotification({
      userId: engagement.ownerId,
      type: "invoice_paid", // closest existing type
      title: "DRS Invoice Sent",
      message: `${isAnnual ? "Annual" : "Monthly"} invoice ${invoice.invoiceNumber} (${formatCurrency(amountCents, "usd")}) sent to ${primarySigner.name}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        engagementId: engagement.id,
        drsRole: role,
      },
    });
  } catch (err) {
    console.error("DRS: notification failed:", err);
  }

  return invoice;
}

// ── Helper for engage route ───────────────────────────────

/**
 * Returns the primary client signer for an engagement (lowest order >= 1).
 * Order 0 is reserved for the sender (CPA), so we want the first non-sender.
 */
export async function getPrimaryClientSigner(
  engagementId: string
): Promise<{ name: string; email: string } | null> {
  const signers = await db
    .select({
      name: engagementSigners.name,
      email: engagementSigners.email,
      order: engagementSigners.order,
    })
    .from(engagementSigners)
    .where(
      and(
        eq(engagementSigners.engagementId, engagementId),
        sql`${engagementSigners.order} >= 1`
      )
    )
    .orderBy(engagementSigners.order)
    .limit(1);

  return signers[0] || null;
}
