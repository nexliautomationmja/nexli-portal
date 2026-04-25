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

/** Days between Initial Setup payment and the Final/Monthly due dates. */
export const DRS_CLOCK_DAYS = 30;

export type DrsRole =
  | "initial_setup"
  | "final_setup"
  | "monthly_subscription";

interface DrsMetadata {
  engagementId: string;
  drsRole: DrsRole;
}

// ── Template Detection ────────────────────────────────────

/**
 * Returns true if the engagement's template is a Digital Rainmaker System
 * template. Match is case-insensitive contains "digital rainmaker", so
 * variants like "DRS - Digital Rainmaker System Agreement" still trigger.
 *
 * Returns false if the engagement has no templateId (custom letter).
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
