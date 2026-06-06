/**
 * Digital Rainmaker System — Auto-Invoicing Flow
 *
 * When an engagement letter built from the "Digital Rainmaker System" template
 * is fully signed by all parties, this module orchestrates a three-invoice
 * billing cadence that mirrors the contract's fee structure:
 *
 *   1. Initial Setup Fee — $10,000 USD, due immediately on signing
 *   2. Final Setup Fee   — $10,000 USD, due 30 days after the Initial is paid
 *   3. Monthly Subscription — $997 USD/month, recurring, first invoice due
 *      30 days after the Initial is paid
 *
 * The 30-day clock for invoices #2 and #3 starts when invoice #1 is paid in
 * full — NOT when the engagement is signed. This is enforced by triggering
 * createDrsFinalAndMonthlyInvoices() from the Stripe payments webhook after
 * the initial invoice flips to "paid".
 *
 * Each generated invoice carries metadata so we can identify it later:
 *   { engagementId, drsRole: "initial_setup" | "final_setup" | "monthly_subscription" }
 *
 * Template detection is by name (case-insensitive contains "digital rainmaker").
 * To opt an engagement letter into this flow, the user just creates an
 * engagement template named something like "Digital Rainmaker System" and
 * picks it when sending the letter — no other configuration required.
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

// ── Constants ─────────────────────────────────────────────

/** Pricing in cents — single source of truth for the DRS contract. */
export const DRS_PRICING = {
  INITIAL_SETUP_CENTS: 10_000_00, // $10,000.00
  FINAL_SETUP_CENTS: 10_000_00,   // $10,000.00
  MONTHLY_SUBSCRIPTION_CENTS: 997_00, // $997.00
} as const;

/** Starter DRS pricing — $15k total setup ($7.5k + $7.5k) + $997/mo. */
export const STARTER_DRS_PRICING = {
  INITIAL_SETUP_CENTS: 750_000,   // $7,500.00
  FINAL_SETUP_CENTS: 750_000,     // $7,500.00
  MONTHLY_RETAINER_CENTS: 99_700, // $997.00
} as const;

/** Ad management tier pricing — monthly management fees. */
export const ADS_TIERS = {
  foundation: { label: "Foundation Ads", cents: 150_000, spendRange: "$1,000–$3,000/mo" },
  growth:     { label: "Growth Ads",     cents: 250_000, spendRange: "$3,000–$8,000/mo" },
  scale:      { label: "Scale Ads",      cents: 450_000, spendRange: "$8,000–$20,000+/mo" },
} as const;

export type AdsTier = keyof typeof ADS_TIERS;

/** DRS variant detected from template name. */
export type DrsVariant = "original" | "starter";

/** Days between Initial Setup payment and the Final/Monthly due dates. */
export const DRS_CLOCK_DAYS = 30;

export type DrsRole =
  | "initial_setup"
  | "final_setup"
  | "monthly_subscription";

interface DrsMetadata {
  engagementId: string;
  drsRole: DrsRole;
  drsVariant?: DrsVariant;
}

interface EngagementMeta {
  adsTier?: AdsTier;
  adsManagementCents?: number;
}

// ── Template Detection ────────────────────────────────────

/**
 * Returns the DRS variant for a given template, or null if the template
 * is not a Digital Rainmaker template. Detection is by name:
 *   - "starter" + "digital rainmaker" → "starter"
 *   - "digital rainmaker" (without "starter") → "original"
 */
export async function getDrsVariant(
  templateId: string | null
): Promise<DrsVariant | null> {
  if (!templateId) return null;
  const [template] = await db
    .select({ name: engagementTemplates.name })
    .from(engagementTemplates)
    .where(eq(engagementTemplates.id, templateId))
    .limit(1);
  if (!template) return null;
  const name = template.name.toLowerCase();
  if (name.includes("starter") && name.includes("digital rainmaker")) return "starter";
  if (name.includes("digital rainmaker")) return "original";
  return null;
}

/** Backward-compatible wrapper. */
export async function isDigitalRainmakerEngagement(
  templateId: string | null
): Promise<boolean> {
  return (await getDrsVariant(templateId)) !== null;
}

// ── Idempotency Helper ────────────────────────────────────

/**
 * Returns true if an invoice already exists for this engagement with the
 * given DRS role. Used to prevent duplicate invoices on re-runs.
 */
async function drsInvoiceExists(
  engagementId: string,
  role: DrsRole
): Promise<boolean> {
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      sql`${invoices.metadata} @> ${JSON.stringify({
        engagementId,
        drsRole: role,
      })}::jsonb`
    )
    .limit(1);
  return rows.length > 0;
}

// ── Invoice Send Helper ───────────────────────────────────

/**
 * Sends the invoice notification email to the client. Mirrors the logic in
 * /api/dashboard/invoices/[invoiceId]/send but lives here so we can call it
 * directly from the auto-invoicing flow without going through the dashboard.
 */
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

// ── Invoice Creation Helpers ──────────────────────────────

interface CreateInvoiceArgs {
  ownerId: string;
  engagementId: string;
  clientName: string;
  clientEmail: string;
}

/**
 * Creates a single DRS invoice (one-time line item).
 * Used for both Initial Setup Fee and Final Setup Fee.
 */
async function createOneTimeDrsInvoice(args: {
  ownerId: string;
  engagementId: string;
  clientName: string;
  clientEmail: string;
  description: string;
  amountCents: number;
  dueDate: Date;
  role: "initial_setup" | "final_setup";
  notes?: string;
}) {
  const invoiceNumber = await generateInvoiceNumber();
  const token = generateInvoiceToken();

  const metadata: DrsMetadata = {
    engagementId: args.engagementId,
    drsRole: args.role,
  };

  const [invoice] = await db
    .insert(invoices)
    .values({
      ownerId: args.ownerId,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      invoiceNumber,
      token,
      currency: "usd",
      subtotal: args.amountCents,
      taxRate: 0,
      taxAmount: 0,
      total: args.amountCents,
      amountPaid: 0,
      balanceDue: args.amountCents,
      isRecurring: false,
      dueDate: args.dueDate,
      notes: args.notes || null,
      status: "sent",
      sentAt: new Date(),
      metadata,
    })
    .returning();

  await db.insert(invoiceLineItems).values({
    invoiceId: invoice.id,
    description: args.description,
    quantity: 100, // qty 1 (stored × 100)
    unitPrice: args.amountCents,
    amount: args.amountCents,
    billingType: "one_time",
    order: 0,
  });

  return invoice;
}

/**
 * Creates the recurring monthly subscription invoice. The first invoice is
 * due in `DRS_CLOCK_DAYS` days. The existing invoice-recurring cron job
 * (api/cron/invoice-reminders) handles generating subsequent monthly
 * invoices from the parent template via `nextRecurrenceDate`.
 */
async function createRecurringDrsMonthlyInvoice(args: CreateInvoiceArgs) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DRS_CLOCK_DAYS);

  // Next recurrence is 30 days after this first one (so the cron generates
  // the second monthly invoice ~60 days after Initial Setup is paid).
  const nextRecurrence = new Date(dueDate);
  nextRecurrence.setDate(nextRecurrence.getDate() + 30);

  const invoiceNumber = await generateInvoiceNumber();
  const token = generateInvoiceToken();
  const amountCents = DRS_PRICING.MONTHLY_SUBSCRIPTION_CENTS;

  const metadata: DrsMetadata = {
    engagementId: args.engagementId,
    drsRole: "monthly_subscription",
  };

  const [invoice] = await db
    .insert(invoices)
    .values({
      ownerId: args.ownerId,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
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
      recurringInterval: "monthly",
      nextRecurrenceDate: nextRecurrence,
      dueDate,
      notes:
        "Recurring monthly subscription for the Digital Rainmaker System. Billed automatically each month.",
      status: "sent",
      sentAt: new Date(),
      metadata,
    })
    .returning();

  await db.insert(invoiceLineItems).values({
    invoiceId: invoice.id,
    description: "Digital Rainmaker System — Monthly Subscription",
    quantity: 100,
    unitPrice: amountCents,
    amount: amountCents,
    billingType: "monthly",
    order: 0,
  });

  return invoice;
}

// ── Public Triggers ───────────────────────────────────────

interface PostSignTriggerArgs {
  engagement: typeof engagements.$inferSelect;
  primarySigner: {
    name: string;
    email: string;
  };
}

/**
 * Called from the engage route after all signers have signed. If the
 * engagement is for a Digital Rainmaker System template, generates and
 * sends the Initial Setup Fee invoice.
 *
 * Idempotent — safe to call repeatedly; will only create the invoice once
 * per engagement.
 */
export async function triggerDrsPostSign(args: PostSignTriggerArgs) {
  const { engagement, primarySigner } = args;

  if (!(await isDigitalRainmakerEngagement(engagement.templateId))) {
    return null;
  }

  if (await drsInvoiceExists(engagement.id, "initial_setup")) {
    return null;
  }

  const dueDate = new Date(); // due immediately

  const invoice = await createOneTimeDrsInvoice({
    ownerId: engagement.ownerId,
    engagementId: engagement.id,
    clientName: primarySigner.name,
    clientEmail: primarySigner.email,
    description: "Digital Rainmaker System — Initial Setup Fee",
    amountCents: DRS_PRICING.INITIAL_SETUP_CENTS,
    dueDate,
    role: "initial_setup",
    notes:
      "Initial Setup Fee for the Digital Rainmaker System. The Final Setup Fee and first Monthly Subscription invoice will be issued 30 days after this invoice is paid in full.",
  });

  await emailInvoiceToClient(invoice, engagement.ownerId);

  try {
    await createNotification({
      userId: engagement.ownerId,
      type: "invoice_paid", // closest existing type — TODO: add invoice_created
      title: "DRS Initial Setup Invoice Sent",
      message: `Initial Setup Fee invoice ${invoice.invoiceNumber} sent to ${primarySigner.name}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        engagementId: engagement.id,
        drsRole: "initial_setup",
      },
    });
  } catch (err) {
    console.error("DRS: notification failed:", err);
  }

  return invoice;
}

/**
 * Called from the Stripe payments webhook after an invoice flips to "paid".
 * If the paid invoice is the Initial Setup Fee for a DRS engagement, this
 * generates the Final Setup Fee invoice and the first Monthly Subscription
 * invoice — both with a due date 30 days from now.
 *
 * Idempotent — checks for existing Final/Monthly invoices before creating.
 */
export async function triggerDrsPostInitialPaid(
  paidInvoice: typeof invoices.$inferSelect
) {
  const meta = paidInvoice.metadata as DrsMetadata | null;
  if (!meta || meta.drsRole !== "initial_setup" || !meta.engagementId) {
    return null;
  }

  const engagementId = meta.engagementId;

  // Look up the engagement to make sure it still exists
  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) {
    console.warn(
      `DRS: paid invoice ${paidInvoice.id} references missing engagement ${engagementId}`
    );
    return null;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DRS_CLOCK_DAYS);

  const created: { final?: typeof invoices.$inferSelect; monthly?: typeof invoices.$inferSelect } = {};

  // Final Setup Fee invoice
  if (!(await drsInvoiceExists(engagementId, "final_setup"))) {
    const finalInvoice = await createOneTimeDrsInvoice({
      ownerId: paidInvoice.ownerId,
      engagementId,
      clientName: paidInvoice.clientName,
      clientEmail: paidInvoice.clientEmail,
      description: "Digital Rainmaker System — Final Setup Fee",
      amountCents: DRS_PRICING.FINAL_SETUP_CENTS,
      dueDate,
      role: "final_setup",
      notes:
        "Final Setup Fee for the Digital Rainmaker System. Due 30 days after the Initial Setup Fee was paid.",
    });
    await emailInvoiceToClient(finalInvoice, paidInvoice.ownerId);
    created.final = finalInvoice;
  }

  // Monthly Subscription invoice (recurring)
  if (!(await drsInvoiceExists(engagementId, "monthly_subscription"))) {
    const monthlyInvoice = await createRecurringDrsMonthlyInvoice({
      ownerId: paidInvoice.ownerId,
      engagementId,
      clientName: paidInvoice.clientName,
      clientEmail: paidInvoice.clientEmail,
    });
    await emailInvoiceToClient(monthlyInvoice, paidInvoice.ownerId);
    created.monthly = monthlyInvoice;
  }

  // Notify CPA in-app
  if (created.final || created.monthly) {
    try {
      await createNotification({
        userId: paidInvoice.ownerId,
        type: "invoice_paid",
        title: "DRS Follow-Up Invoices Sent",
        message: `Final Setup Fee and Monthly Subscription invoices issued to ${paidInvoice.clientName} (due in ${DRS_CLOCK_DAYS} days).`,
        metadata: {
          engagementId,
          finalInvoiceId: created.final?.id,
          monthlyInvoiceId: created.monthly?.id,
        },
      });
    } catch (err) {
      console.error("DRS follow-up notification failed:", err);
    }
  }

  return created;
}

// ══════════════════════════════════════════════════════════
// ══  STARTER DRS — Auto-Invoicing  ══════════════════════
// ══════════════════════════════════════════════════════════

/**
 * Called from the engage route after all signers have signed a Starter DRS
 * engagement. Generates Invoice 1:
 *   - Initial Setup Fee ($7,500)
 *   - Monthly Retainer ($997)
 *   - Ad Management fee (if ads tier selected)
 *
 * All line items are on a single invoice, due immediately.
 */
export async function triggerStarterDrsPostSign(args: PostSignTriggerArgs) {
  const { engagement, primarySigner } = args;

  if (await drsInvoiceExists(engagement.id, "initial_setup")) {
    return null;
  }

  const engMeta = (engagement.metadata ?? {}) as EngagementMeta;
  const adsTier = engMeta.adsTier;
  const adsCents = adsTier ? ADS_TIERS[adsTier].cents : 0;

  const setupCents = STARTER_DRS_PRICING.INITIAL_SETUP_CENTS;
  const retainerCents = STARTER_DRS_PRICING.MONTHLY_RETAINER_CENTS;
  const totalCents = setupCents + retainerCents + adsCents;

  const invoiceNumber = await generateInvoiceNumber();
  const token = generateInvoiceToken();
  const dueDate = new Date(); // due immediately

  const metadata: DrsMetadata = {
    engagementId: engagement.id,
    drsRole: "initial_setup",
    drsVariant: "starter",
  };

  const [invoice] = await db
    .insert(invoices)
    .values({
      ownerId: engagement.ownerId,
      clientName: primarySigner.name,
      clientEmail: primarySigner.email,
      invoiceNumber,
      token,
      currency: "usd",
      subtotal: totalCents,
      taxRate: 0,
      taxAmount: 0,
      total: totalCents,
      amountPaid: 0,
      balanceDue: totalCents,
      isRecurring: false,
      dueDate,
      notes: "Initial payment for the Starter Digital Rainmaker System. The Final Setup Fee will be issued 30 days after this invoice is paid in full.",
      status: "sent",
      sentAt: new Date(),
      metadata,
    })
    .returning();

  // Line items
  const lineItems: { invoiceId: string; description: string; quantity: number; unitPrice: number; amount: number; billingType: "one_time" | "monthly"; order: number }[] = [
    {
      invoiceId: invoice.id,
      description: "Starter Digital Rainmaker — Initial Setup Fee",
      quantity: 100,
      unitPrice: setupCents,
      amount: setupCents,
      billingType: "one_time",
      order: 0,
    },
    {
      invoiceId: invoice.id,
      description: "Digital Rainmaker — Monthly Retainer",
      quantity: 100,
      unitPrice: retainerCents,
      amount: retainerCents,
      billingType: "monthly",
      order: 1,
    },
  ];

  if (adsTier) {
    lineItems.push({
      invoiceId: invoice.id,
      description: `Ad Management — ${ADS_TIERS[adsTier].label} (Month 1)`,
      quantity: 100,
      unitPrice: adsCents,
      amount: adsCents,
      billingType: "monthly",
      order: 2,
    });
  }

  for (const item of lineItems) {
    await db.insert(invoiceLineItems).values(item);
  }

  await emailInvoiceToClient(invoice, engagement.ownerId);

  try {
    await createNotification({
      userId: engagement.ownerId,
      type: "invoice_paid",
      title: "Starter DRS Initial Invoice Sent",
      message: `Initial invoice ${invoice.invoiceNumber} ($${(totalCents / 100).toLocaleString()}) sent to ${primarySigner.name}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        engagementId: engagement.id,
        drsRole: "initial_setup",
        drsVariant: "starter",
      },
    });
  } catch (err) {
    console.error("Starter DRS: notification failed:", err);
  }

  return invoice;
}

/**
 * Called from the Stripe payments webhook after a Starter DRS initial setup
 * invoice is paid. Generates:
 *   - Invoice 2: Final Setup Fee ($7,500) — due in 30 days
 *   - Invoice 3: Monthly recurring ($997 retainer + ad management) — due in 30 days
 */
export async function triggerStarterDrsPostInitialPaid(
  paidInvoice: typeof invoices.$inferSelect
) {
  const meta = paidInvoice.metadata as (DrsMetadata & EngagementMeta) | null;
  if (!meta || meta.drsRole !== "initial_setup" || !meta.engagementId) {
    return null;
  }

  const engagementId = meta.engagementId;

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) {
    console.warn(`Starter DRS: paid invoice ${paidInvoice.id} references missing engagement ${engagementId}`);
    return null;
  }

  const engMeta = (engagement.metadata ?? {}) as EngagementMeta;
  const adsTier = engMeta.adsTier;
  const adsCents = adsTier ? ADS_TIERS[adsTier].cents : 0;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DRS_CLOCK_DAYS);

  const created: { final?: typeof invoices.$inferSelect; monthly?: typeof invoices.$inferSelect } = {};

  // Invoice 2: Final Setup Fee only
  if (!(await drsInvoiceExists(engagementId, "final_setup"))) {
    const finalInvoice = await createOneTimeDrsInvoice({
      ownerId: paidInvoice.ownerId,
      engagementId,
      clientName: paidInvoice.clientName,
      clientEmail: paidInvoice.clientEmail,
      description: "Starter Digital Rainmaker — Final Setup Fee",
      amountCents: STARTER_DRS_PRICING.FINAL_SETUP_CENTS,
      dueDate,
      role: "final_setup",
      notes: "Final Setup Fee for the Starter Digital Rainmaker System. Due 30 days after the Initial invoice was paid.",
    });
    await emailInvoiceToClient(finalInvoice, paidInvoice.ownerId);
    created.final = finalInvoice;
  }

  // Invoice 3: Monthly recurring ($997 retainer + ad management)
  if (!(await drsInvoiceExists(engagementId, "monthly_subscription"))) {
    const retainerCents = STARTER_DRS_PRICING.MONTHLY_RETAINER_CENTS;
    const totalMonthlyCents = retainerCents + adsCents;

    const nextRecurrence = new Date(dueDate);
    nextRecurrence.setDate(nextRecurrence.getDate() + 30);

    const invoiceNumber = await generateInvoiceNumber();
    const token = generateInvoiceToken();

    const monthlyMeta: DrsMetadata = {
      engagementId,
      drsRole: "monthly_subscription",
      drsVariant: "starter",
    };

    const [monthlyInvoice] = await db
      .insert(invoices)
      .values({
        ownerId: paidInvoice.ownerId,
        clientName: paidInvoice.clientName,
        clientEmail: paidInvoice.clientEmail,
        invoiceNumber,
        token,
        currency: "usd",
        subtotal: totalMonthlyCents,
        taxRate: 0,
        taxAmount: 0,
        total: totalMonthlyCents,
        amountPaid: 0,
        balanceDue: totalMonthlyCents,
        isRecurring: true,
        recurringInterval: "monthly",
        nextRecurrenceDate: nextRecurrence,
        dueDate,
        notes: "Recurring monthly retainer for the Digital Rainmaker System. Billed automatically each month.",
        status: "sent",
        sentAt: new Date(),
        metadata: monthlyMeta,
      })
      .returning();

    // Retainer line item
    await db.insert(invoiceLineItems).values({
      invoiceId: monthlyInvoice.id,
      description: "Digital Rainmaker — Monthly Retainer",
      quantity: 100,
      unitPrice: retainerCents,
      amount: retainerCents,
      billingType: "monthly",
      order: 0,
    });

    // Ad management line item (if ads)
    if (adsTier) {
      await db.insert(invoiceLineItems).values({
        invoiceId: monthlyInvoice.id,
        description: `Ad Management — ${ADS_TIERS[adsTier].label}`,
        quantity: 100,
        unitPrice: adsCents,
        amount: adsCents,
        billingType: "monthly",
        order: 1,
      });
    }

    await emailInvoiceToClient(monthlyInvoice, paidInvoice.ownerId);
    created.monthly = monthlyInvoice;
  }

  if (created.final || created.monthly) {
    try {
      await createNotification({
        userId: paidInvoice.ownerId,
        type: "invoice_paid",
        title: "Starter DRS Follow-Up Invoices Sent",
        message: `Final Setup Fee and Monthly Retainer invoices issued to ${paidInvoice.clientName} (due in ${DRS_CLOCK_DAYS} days).`,
        metadata: {
          engagementId,
          finalInvoiceId: created.final?.id,
          monthlyInvoiceId: created.monthly?.id,
          drsVariant: "starter",
        },
      });
    } catch (err) {
      console.error("Starter DRS follow-up notification failed:", err);
    }
  }

  return created;
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
