/**
 * Digital Rainmaker System — Auto-Invoicing Flow
 *
 * When an engagement letter built from the "Digital Rainmaker System" template
 * is fully signed by all parties, this module creates a single recurring
 * platform invoice that mirrors the flat all-in-one fee structure:
 *
 *   - Both plans  → a one-time $32,000 Setup Fee invoice (Phase 1
 *                   implementation, see SETUP_SCOPE), due at signing
 *   - Monthly plan → ONE $9,997/month invoice (two lines: $4,997 platform
 *                    upkeep + $5,000 Managed Advertising Budget), recurring,
 *                    first one due 30 days after signing
 *   - Annual plan  → $42,000/year platform due at signing ($74,000 total with
 *                    the setup fee), PLUS a separate $5,000/month Managed
 *                    Advertising Budget invoice starting 30 days after signing
 *
 * There are no setup fees. Ad management is included in the platform price;
 * the ad budget is pass-through (deployed on the client's ad accounts, no
 * markup). There is no performance fee, bonus, or revenue share. The billing
 * plan and initial term are snapshotted onto engagement.metadata at compose
 * time so a signed client keeps their terms even if pricing changes.
 *
 * Each generated invoice carries metadata { engagementId, drsRole,
 * adSpendCents, termMonths? } where drsRole is "platform_monthly",
 * "platform_annual" or "ad_spend_monthly" and adSpendCents is the
 * pass-through portion of that invoice's total (book-of-business.ts splits
 * it out of revenue). The recurring cron (api/cron/invoice-reminders) rolls
 * each parent forward by its interval and copies the metadata.
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
import { getOwnerBranding } from "@/lib/branding";
import { createNotification } from "@/lib/notifications";

// Pricing lives in drs-pricing.ts (client-safe module); re-exported here so
// existing server-side imports keep working.
import {
  DRS_PRICING,
  SETUP_SCOPE,
  RECURRING_START_DAYS,
  TOTAL_MONTHLY_CENTS,
  type BillingPlan,
} from "./drs-pricing";

export { DRS_PRICING } from "./drs-pricing";
export type { BillingPlan } from "./drs-pricing";

export type DrsRole = "setup_fee" | "platform_monthly" | "platform_annual" | "ad_spend_monthly";

interface DrsMetadata {
  engagementId: string;
  drsRole: DrsRole;
  /** Managed Advertising Budget (pass-through) included in this invoice's total, in cents. */
  adSpendCents: number;
  /** Initial contract term snapshotted from the engagement, when known. */
  termMonths?: number;
}

interface EngagementMeta {
  billingPlan?: BillingPlan;
  termMonths?: number;
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

/** True if a DRS invoice with this role already exists for the engagement. */
async function drsInvoiceExists(
  engagementId: string,
  drsRole: DrsRole
): Promise<boolean> {
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      sql`${invoices.metadata} @> ${JSON.stringify({ engagementId, drsRole })}::jsonb`
    )
    .limit(1);
  return rows.length > 0;
}

// ── Invoice Send Helper ───────────────────────────────────

export async function emailInvoiceToClient(
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
    const branding = await getOwnerBranding(ownerId);

    const { subject, html } = buildInvoiceEmail({
      clientName: invoice.clientName,
      senderName,
      invoiceNumber: invoice.invoiceNumber,
      total: formatCurrency(invoice.total, invoice.currency),
      dueDate: invoice.dueDate,
      invoiceUrl,
      branding,
    });

    await sendEmailWithLog({
      to: invoice.clientEmail,
      subject,
      html,
      fromName: branding.fromName,
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

interface DrsInvoiceSpec {
  role: DrsRole;
  /** false = one-time invoice (the Setup Fee). */
  recurring: boolean;
  /** Days after signing the first invoice is due (0 = at signing). */
  dueOffsetDays: number;
  interval: "monthly" | "yearly";
  totalCents: number;
  adSpendCents: number;
  label: string;
  notes: string;
  lines: { description: string; amountCents: number; billingType: "one_time" | "monthly" | "yearly" }[];
}

/** The invoices a freshly signed DRS engagement should produce for its plan. */
export function drsInvoiceSpecs(plan: BillingPlan): DrsInvoiceSpec[] {
  const platform = formatCurrency(DRS_PRICING.MONTHLY_CENTS, "usd");
  const adBudget = formatCurrency(DRS_PRICING.AD_SPEND_MONTHLY_CENTS, "usd");
  const adLine = {
    description: "Managed Advertising Budget — Monthly (deployed on your ad accounts, pass-through)",
    amountCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
    billingType: "monthly" as const,
  };
  const setup: DrsInvoiceSpec = {
    role: "setup_fee",
    recurring: false,
    dueOffsetDays: 0,
    interval: "monthly",
    totalCents: DRS_PRICING.SETUP_FEE_CENTS,
    adSpendCents: 0,
    label: "Setup Fee",
    notes: `One-time Setup Fee covering the Phase 1 Implementation of the Digital Rainmaker System — ${SETUP_SCOPE.map((g) => g.title).join(", ")} — as itemized in Section 1 of your engagement letter. Due at signing; non-refundable once work begins.`,
    lines: [
      {
        description: "Digital Rainmaker System — Setup Fee (Phase 1 Implementation)",
        amountCents: DRS_PRICING.SETUP_FEE_CENTS,
        billingType: "one_time",
      },
    ],
  };
  if (plan === "annual") {
    return [
      setup,
      {
        role: "platform_annual",
        recurring: true,
        dueOffsetDays: 0, // paid up front together with the Setup Fee
        interval: "yearly",
        totalCents: DRS_PRICING.ANNUAL_CENTS,
        adSpendCents: 0,
        label: "Annual platform",
        notes:
          "Annual all-in-one platform investment for the Digital Rainmaker System, paid in full. Renews yearly.",
        lines: [
          {
            description: "Digital Rainmaker System — Annual Platform (Paid in Full)",
            amountCents: DRS_PRICING.ANNUAL_CENTS,
            billingType: "yearly",
          },
        ],
      },
      {
        role: "ad_spend_monthly",
        recurring: true,
        dueOffsetDays: RECURRING_START_DAYS, // not front-loaded
        interval: "monthly",
        totalCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
        adSpendCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
        label: "Monthly ad budget",
        notes: `Managed Advertising Budget (${adBudget}/month) for the Digital Rainmaker System — deployed on your behalf on the advertising platforms at no markup. Billed automatically each month.`,
        lines: [adLine],
      },
    ];
  }
  return [
    setup,
    {
      role: "platform_monthly",
      recurring: true,
      dueOffsetDays: RECURRING_START_DAYS,
      interval: "monthly",
      totalCents: TOTAL_MONTHLY_CENTS,
      adSpendCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
      label: "Monthly",
      notes: `Monthly investment for the Digital Rainmaker System: ${platform} platform upkeep (hosting, maintenance, ad management, support, reporting, AI usage) + ${adBudget} Managed Advertising Budget deployed on your behalf at no markup. Billed automatically each month.`,
      lines: [
        {
          description: "Digital Rainmaker System — Monthly Platform",
          amountCents: DRS_PRICING.MONTHLY_CENTS,
          billingType: "monthly",
        },
        adLine,
      ],
    },
  ];
}

/**
 * Called from the engage route after all signers have signed. For a Digital
 * Rainmaker engagement, creates the recurring invoice(s) for the plan — see
 * drsInvoiceSpecs — all due at signing.
 *
 * Idempotent per (engagement, drsRole) — a retry only creates what's missing.
 * Returns the first invoice created (or null when nothing was created).
 */
export async function triggerDrsPostSign(args: PostSignTriggerArgs) {
  const { engagement, primarySigner } = args;

  if (!(await isDigitalRainmakerEngagement(engagement.templateId))) {
    return null;
  }

  const engMeta = (engagement.metadata ?? {}) as EngagementMeta;
  const plan: BillingPlan = engMeta.billingPlan === "annual" ? "annual" : "monthly";
  const termMonths =
    typeof engMeta.termMonths === "number" && engMeta.termMonths > 0
      ? engMeta.termMonths
      : undefined;

  const created: (typeof invoices.$inferSelect)[] = [];

  for (const spec of drsInvoiceSpecs(plan)) {
    if (await drsInvoiceExists(engagement.id, spec.role)) continue;

    // Setup Fee (and the Annual Investment) are due at signing; the monthly
    // platform / ad-budget invoices are due RECURRING_START_DAYS later.
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + spec.dueOffsetDays);

    // Next recurrence: one interval after the first due date, so the cron
    // generates the next invoice when this billing cycle ends.
    const nextRecurrence = new Date(dueDate);
    if (spec.interval === "yearly") {
      nextRecurrence.setFullYear(nextRecurrence.getFullYear() + 1);
    } else {
      nextRecurrence.setMonth(nextRecurrence.getMonth() + 1);
    }

    const invoiceNumber = await generateInvoiceNumber();
    const token = generateInvoiceToken();
    const metadata: DrsMetadata = {
      engagementId: engagement.id,
      drsRole: spec.role,
      adSpendCents: spec.adSpendCents,
      ...(termMonths ? { termMonths } : {}),
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
        subtotal: spec.totalCents,
        taxRate: 0,
        taxAmount: 0,
        total: spec.totalCents,
        amountPaid: 0,
        balanceDue: spec.totalCents,
        isRecurring: spec.recurring,
        recurringInterval: spec.recurring ? spec.interval : null,
        nextRecurrenceDate: spec.recurring ? nextRecurrence : null,
        dueDate,
        notes: spec.notes,
        status: "sent",
        sentAt: new Date(),
        metadata,
      })
      .returning();

    await db.insert(invoiceLineItems).values(
      spec.lines.map((line, i) => ({
        invoiceId: invoice.id,
        description: line.description,
        quantity: 100, // qty 1 (stored × 100)
        unitPrice: line.amountCents,
        amount: line.amountCents,
        billingType: line.billingType,
        order: i,
      }))
    );

    await emailInvoiceToClient(invoice, engagement.ownerId);

    try {
      await createNotification({
        userId: engagement.ownerId,
        type: "invoice_paid", // closest existing type
        title: "DRS Invoice Sent",
        message: `${spec.label} invoice ${invoice.invoiceNumber} (${formatCurrency(spec.totalCents, "usd")}) sent to ${primarySigner.name}`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          engagementId: engagement.id,
          drsRole: spec.role,
        },
      });
    } catch (err) {
      console.error("DRS: notification failed:", err);
    }

    created.push(invoice);
  }

  return created[0] ?? null;
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
