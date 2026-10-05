/**
 * Nexli Enterprise License — post-signature invoicing.
 *
 * When an engagement built from the "Nexli Enterprise License" template is
 * fully signed, create ONE invoice for the tier's Enterprise License Fee,
 * due immediately, payable by ACH/wire only (metadata.achOnly hides the
 * card option on the pay page and the checkout route refuses card). Nothing
 * recurs: the annual renewal (25% of the fee) is invoiced manually 30 days
 * before the anniversary of the Kickoff Date (contract Section 3(b)).
 *
 * Idempotent per engagement — keyed on metadata { engagementId, offer }.
 */

import { db } from "@/db";
import {
  engagements,
  engagementTemplates,
  invoices,
  invoiceLineItems,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  generateInvoiceNumber,
  generateInvoiceToken,
  formatCurrency,
} from "@/lib/invoice-utils";
import { createNotification } from "@/lib/notifications";
import { emailInvoiceToClient } from "@/lib/digital-rainmaker";
import {
  ENTERPRISE,
  ENTERPRISE_TIERS,
  isEnterpriseTemplateName,
  isEnterpriseTier,
  type EnterpriseTier,
} from "@/lib/enterprise-pricing";

export const ENTERPRISE_OFFER = "enterprise";

export interface EnterpriseInvoiceMetadata {
  engagementId: string;
  offer: typeof ENTERPRISE_OFFER;
  enterpriseTier: EnterpriseTier;
  /** Pay page hides card; checkout refuses card. */
  achOnly: true;
  /** No pass-through ad budget on this invoice (book-of-business reads this). */
  adSpendCents: 0;
  termMonths: number;
}

interface EnterpriseEngagementMeta {
  offer?: string;
  enterpriseTier?: string;
}

/** True if the engagement's template is the Enterprise License letter (by name). */
export async function isEnterpriseEngagement(
  templateId: string | null
): Promise<boolean> {
  if (!templateId) return false;
  const [template] = await db
    .select({ name: engagementTemplates.name })
    .from(engagementTemplates)
    .where(eq(engagementTemplates.id, templateId))
    .limit(1);
  return isEnterpriseTemplateName(template?.name);
}

async function enterpriseInvoiceExists(engagementId: string): Promise<boolean> {
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      sql`${invoices.metadata} @> ${JSON.stringify({ engagementId, offer: ENTERPRISE_OFFER })}::jsonb`
    )
    .limit(1);
  return rows.length > 0;
}

interface PostSignArgs {
  engagement: typeof engagements.$inferSelect;
  primarySigner: { name: string; email: string };
}

/**
 * Called from the engage route after all signers have signed. Creates the
 * single up-front Enterprise License Fee invoice. Returns it, or null when
 * the engagement isn't Enterprise or the invoice already exists.
 */
export async function triggerEnterprisePostSign(args: PostSignArgs) {
  const { engagement, primarySigner } = args;

  if (!(await isEnterpriseEngagement(engagement.templateId))) return null;
  if (await enterpriseInvoiceExists(engagement.id)) return null;

  const meta = (engagement.metadata ?? {}) as EnterpriseEngagementMeta;
  const tier: EnterpriseTier = isEnterpriseTier(meta.enterpriseTier)
    ? meta.enterpriseTier
    : "core";
  const info = ENTERPRISE_TIERS[tier];
  const amountCents = info.priceCents;

  const invoiceNumber = await generateInvoiceNumber();
  const token = generateInvoiceToken();
  const metadata: EnterpriseInvoiceMetadata = {
    engagementId: engagement.id,
    offer: ENTERPRISE_OFFER,
    enterpriseTier: tier,
    achOnly: true,
    adSpendCents: 0,
    termMonths: ENTERPRISE.LICENSE_MONTHS,
  };

  const dueDate = new Date(); // due in full at signing

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
      isRecurring: false,
      dueDate,
      notes: `Enterprise License Fee (${info.label} tier) — covers the ${ENTERPRISE.IMPLEMENTATION_MONTHS}-month Implementation Program and the first ${ENTERPRISE.LICENSE_MONTHS}-month License Term. Payable by ACH bank transfer or wire (a business check is accepted once cleared). Card payments are not accepted. Your kickoff week is scheduled once funds have cleared.`,
      status: "sent",
      sentAt: new Date(),
      metadata,
    })
    .returning();

  await db.insert(invoiceLineItems).values({
    invoiceId: invoice.id,
    description: `Nexli Enterprise License — ${info.label} (${ENTERPRISE.IMPLEMENTATION_MONTHS}-month implementation + ${ENTERPRISE.LICENSE_MONTHS}-month license)`,
    quantity: 100, // qty 1 (stored × 100)
    unitPrice: amountCents,
    amount: amountCents,
    billingType: "one_time",
    order: 0,
  });

  await emailInvoiceToClient(invoice, engagement.ownerId);

  try {
    await createNotification({
      userId: engagement.ownerId,
      type: "invoice_paid", // closest existing type (same convention as DRS)
      title: "Enterprise License Invoice Sent",
      message: `${info.label} tier invoice ${invoice.invoiceNumber} (${formatCurrency(amountCents, "usd")}, ACH/wire only) sent to ${primarySigner.name}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        engagementId: engagement.id,
        offer: ENTERPRISE_OFFER,
        enterpriseTier: tier,
      },
    });
  } catch (err) {
    console.error("Enterprise: notification failed:", err);
  }

  return invoice;
}
