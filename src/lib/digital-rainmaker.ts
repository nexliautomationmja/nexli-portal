/**
 * Digital Rainmaker System — Auto-Invoicing Flow
 *
 * Billing for engagement letters built from the "Digital Rainmaker System"
 * template happens in three steps:
 *
 *   1. SIGNING (triggerDrsPostSign) — only the up-front invoice is sent:
 *        - Monthly plan → a one-time $32,000 Setup Fee invoice
 *                         (drsRole "setup_fee", Phase 1 — see SETUP_SCOPE)
 *        - Annual plan  → ONE one-time $74,000 invoice (drsRole
 *                         "setup_annual"): $32,000 Setup Fee + $42,000 prepaid
 *                         platform year, two line items
 *      Nothing else happens at signing — no onboarding, no welcome email.
 *
 *   2. UP-FRONT INVOICE PAID (onDrsInvoicePaid) — the onboarding Launch Pad
 *      opens and every client signer gets their welcome email.
 *
 *   3. BUILD COMPLETE (triggerDrsLaunchBilling, admin button) — the first
 *      recurring invoice is sent, due immediately:
 *        - Monthly plan → $9,997/month (drsRole "platform_monthly": $4,997
 *                         platform upkeep + $5,000 Managed Advertising Budget)
 *        - Annual plan  → $5,000/month ad budget (drsRole "ad_spend_monthly")
 *      metadata.billingStartedAt is stamped on the engagement. When that first
 *      recurring invoice is paid, the admin is told it's clear to launch ads.
 *
 * Ad management is included in the platform price; the ad budget is
 * pass-through (deployed on the client's ad accounts, no markup). There is no
 * performance fee, bonus, or revenue share. The billing plan and initial term
 * are snapshotted onto engagement.metadata at compose time so a signed client
 * keeps their terms even if pricing changes.
 *
 * Each generated invoice carries metadata { engagementId, drsRole,
 * adSpendCents, termMonths? } where adSpendCents is the pass-through portion
 * of that invoice's total (book-of-business.ts splits it out of revenue). The
 * recurring cron (api/cron/invoice-reminders) rolls each recurring parent
 * forward by its interval and copies the metadata. Legacy engagements may
 * still carry "platform_annual" invoices from the previous flow.
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
import { and, asc, eq, sql } from "drizzle-orm";
import {
  generateInvoiceNumber,
  generateInvoiceToken,
  formatCurrency,
} from "@/lib/invoice-utils";
import {
  sendEmailWithLog,
  buildInvoiceEmail,
  buildOnboardingWelcomeEmail,
} from "@/lib/email";
import { getOwnerBranding } from "@/lib/branding";
import { createNotification } from "@/lib/notifications";
import {
  initOnboarding,
  getOnboardingState,
  appendActivity,
} from "@/lib/onboarding";

// Pricing lives in drs-pricing.ts (client-safe module); re-exported here so
// existing server-side imports keep working.
import {
  DRS_PRICING,
  SETUP_SCOPE,
  TOTAL_MONTHLY_CENTS,
  ANNUAL_UPFRONT_CENTS,
  type BillingPlan,
} from "./drs-pricing";

export { DRS_PRICING } from "./drs-pricing";
export type { BillingPlan } from "./drs-pricing";

export type DrsRole =
  | "setup_fee"
  | "setup_annual"
  | "platform_monthly"
  | "platform_annual" // legacy (pre-Oct 18 2026 annual flow)
  | "ad_spend_monthly";

/** Up-front invoice roles (sent at signing; paying one opens onboarding). */
const SETUP_ROLES: DrsRole[] = ["setup_fee", "setup_annual"];
/** First-recurring invoice roles (sent when the build is complete). */
const LAUNCH_ROLES: DrsRole[] = ["platform_monthly", "ad_spend_monthly"];

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
  /** ISO timestamp the first recurring invoice was sent (build complete). */
  billingStartedAt?: string;
  /** ISO timestamp the first recurring invoice was paid (idempotency marker). */
  firstMonthlyPaidAt?: string;
}

function planOf(engagement: { metadata: unknown }): BillingPlan {
  const meta = (engagement.metadata ?? {}) as EngagementMeta;
  return meta.billingPlan === "annual" ? "annual" : "monthly";
}

const PORTAL_URL = () =>
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

/** SQL condition: invoice belongs to this engagement and has one of these DRS roles. */
function drsRoleCondition(engagementId: string, roles: DrsRole[]) {
  return and(
    sql`${invoices.metadata}->>'engagementId' = ${engagementId}`,
    sql`(${sql.join(
      roles.map((r) => sql`${invoices.metadata}->>'drsRole' = ${r}`),
      sql` OR `
    )})`
  );
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

// ── Invoice Specs ─────────────────────────────────────────

interface DrsInvoiceSpec {
  role: DrsRole;
  /** false = one-time invoice (the up-front Setup Fee / annual invoice). */
  recurring: boolean;
  interval: "monthly" | "yearly";
  totalCents: number;
  adSpendCents: number;
  label: string;
  notes: string;
  lines: { description: string; amountCents: number; billingType: "one_time" | "monthly" | "yearly" }[];
}

const SETUP_LINE = {
  description: "Digital Rainmaker System — Setup Fee (Phase 1 Implementation)",
  amountCents: DRS_PRICING.SETUP_FEE_CENTS,
  billingType: "one_time" as const,
};

/**
 * The up-front invoice sent at signing (due immediately). Monthly plan: the
 * $32,000 Setup Fee. Annual plan: ONE $74,000 invoice (setup + prepaid year).
 */
export function drsSigningInvoiceSpecs(plan: BillingPlan): DrsInvoiceSpec[] {
  const scope = SETUP_SCOPE.map((g) => g.title).join(", ");
  if (plan === "annual") {
    return [
      {
        role: "setup_annual",
        recurring: false,
        interval: "yearly",
        totalCents: ANNUAL_UPFRONT_CENTS,
        adSpendCents: 0,
        label: "Setup + annual platform",
        notes: `Setup Fee covering the Phase 1 Implementation of the Digital Rainmaker System — ${scope} — as itemized in Section 1 of your engagement letter, plus the annual platform investment for your first 12 months, paid in full. Due at signing; onboarding opens once it is paid. The Managed Advertising Budget is billed monthly once your build is complete.`,
        lines: [
          SETUP_LINE,
          {
            description: "Digital Rainmaker System — Annual Platform (12 months, paid in full)",
            amountCents: DRS_PRICING.ANNUAL_CENTS,
            billingType: "yearly",
          },
        ],
      },
    ];
  }
  return [
    {
      role: "setup_fee",
      recurring: false,
      interval: "monthly",
      totalCents: DRS_PRICING.SETUP_FEE_CENTS,
      adSpendCents: 0,
      label: "Setup Fee",
      notes: `One-time Setup Fee covering the Phase 1 Implementation of the Digital Rainmaker System — ${scope} — as itemized in Section 1 of your engagement letter. Due at signing; onboarding opens once it is paid. Non-refundable once work begins.`,
      lines: [SETUP_LINE],
    },
  ];
}

/**
 * The first recurring invoice, sent when the admin marks the build complete
 * (due immediately; the cron bills it monthly from there). Monthly plan:
 * $9,997 (platform + ad budget). Annual plan: the $5,000 ad budget.
 */
export function drsLaunchInvoiceSpecs(plan: BillingPlan): DrsInvoiceSpec[] {
  const platform = formatCurrency(DRS_PRICING.MONTHLY_CENTS, "usd");
  const adBudget = formatCurrency(DRS_PRICING.AD_SPEND_MONTHLY_CENTS, "usd");
  const adLine = {
    description: "Managed Advertising Budget — Monthly (deployed on your ad accounts, pass-through)",
    amountCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
    billingType: "monthly" as const,
  };
  if (plan === "annual") {
    return [
      {
        role: "ad_spend_monthly",
        recurring: true,
        interval: "monthly",
        totalCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
        adSpendCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
        label: "Monthly ad budget",
        notes: `Managed Advertising Budget (${adBudget}/month) for the Digital Rainmaker System — deployed on your behalf on the advertising platforms at no markup. Your build is complete; ads launch once this invoice is paid. Billed automatically each month.`,
        lines: [adLine],
      },
    ];
  }
  return [
    {
      role: "platform_monthly",
      recurring: true,
      interval: "monthly",
      totalCents: TOTAL_MONTHLY_CENTS,
      adSpendCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
      label: "Monthly",
      notes: `Monthly investment for the Digital Rainmaker System: ${platform} platform upkeep (hosting, maintenance, ad management, support, reporting, AI usage) + ${adBudget} Managed Advertising Budget deployed on your behalf at no markup. Your build is complete; services and ads start once this invoice is paid. Billed automatically each month.`,
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

// ── Invoice Creation ──────────────────────────────────────

/**
 * Inserts each spec's invoice + line items (due now), emails it to the client
 * and notifies the owner ("invoice_sent"). Idempotent per (engagement,
 * drsRole) — a spec whose role already exists is skipped. Returns the
 * invoices actually created.
 */
export async function createDrsInvoices(args: {
  engagement: typeof engagements.$inferSelect;
  signer: { name: string; email: string };
  specs: DrsInvoiceSpec[];
}): Promise<(typeof invoices.$inferSelect)[]> {
  const { engagement, signer, specs } = args;
  const engMeta = (engagement.metadata ?? {}) as EngagementMeta;
  const termMonths =
    typeof engMeta.termMonths === "number" && engMeta.termMonths > 0
      ? engMeta.termMonths
      : undefined;

  const created: (typeof invoices.$inferSelect)[] = [];

  for (const spec of specs) {
    if (await drsInvoiceExists(engagement.id, spec.role)) continue;

    const dueDate = new Date();

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
        clientName: signer.name,
        clientEmail: signer.email,
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
        type: "invoice_sent",
        title: "Invoice sent",
        message: `${spec.label} invoice ${invoice.invoiceNumber} (${formatCurrency(spec.totalCents, "usd")}) sent to ${signer.name} — awaiting payment`,
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

  return created;
}

// ── Step 1: Signing ───────────────────────────────────────

interface PostSignTriggerArgs {
  engagement: typeof engagements.$inferSelect;
  primarySigner: {
    name: string;
    email: string;
  };
}

/**
 * Called from the engage route after all signers have signed. For a Digital
 * Rainmaker engagement, sends ONLY the up-front invoice (see
 * drsSigningInvoiceSpecs), due at signing. No-op for other templates.
 *
 * Idempotent per (engagement, drsRole). Returns the invoice created (or null
 * when nothing was created).
 */
export async function triggerDrsPostSign(args: PostSignTriggerArgs) {
  const { engagement, primarySigner } = args;

  if (!(await isDigitalRainmakerEngagement(engagement.templateId))) {
    return null;
  }

  const created = await createDrsInvoices({
    engagement,
    signer: primarySigner,
    specs: drsSigningInvoiceSpecs(planOf(engagement)),
  });
  return created[0] ?? null;
}

// ── Step 2: Onboarding welcome ────────────────────────────

/**
 * Emails every client signer (order > 0, not declined) their Launch Pad link —
 * each uses their own token. The engage link goes dead after signing, so this
 * email is the durable way back in. Never throws.
 */
export async function sendOnboardingWelcomeEmails(engagementId: string): Promise<void> {
  try {
    const signers = await db
      .select()
      .from(engagementSigners)
      .where(eq(engagementSigners.engagementId, engagementId));

    // Read the deadline back from the freshly initialised state so the email
    // matches the Launch Pad exactly (null on legacy records).
    let clientDueAt: string | null = null;
    try {
      clientDueAt = (await getOnboardingState(engagementId))?.clientDueAt ?? null;
    } catch (err) {
      console.error("Onboarding state read failed:", err);
    }

    for (const s of signers) {
      if (s.order === 0) continue; // sender's own token isn't a client link
      if (s.status === "declined") continue;
      try {
        const { subject, html } = buildOnboardingWelcomeEmail({
          clientName: s.name,
          senderName: "The Nexli team",
          onboardingUrl: `${PORTAL_URL()}/onboarding/${s.token}`,
          clientDueAt,
        });
        await sendEmailWithLog({
          to: s.email,
          subject,
          html,
          recipientName: s.name,
          emailType: "onboarding_welcome",
          relatedId: engagementId,
        });
      } catch (err) {
        console.error("Onboarding welcome email failed:", err);
      }
    }
  } catch (err) {
    console.error("sendOnboardingWelcomeEmails failed:", err);
  }
}

// ── Step 3: Build complete → first recurring invoice ─────

export type DrsLaunchBillingResult =
  | { ok: true; invoiceId: string; billingStartedAt: string }
  | { ok: false; error: "not_drs" | "setup_unpaid" | "already_started" | "no_signer" };

/**
 * Admin "Build complete": sends the first recurring invoice (due now) — see
 * drsLaunchInvoiceSpecs — once the up-front invoice is paid. Stamps
 * engagement.metadata.billingStartedAt (claimed atomically, so a double click
 * can't send two invoices) and posts a Launch Pad activity entry.
 */
export async function triggerDrsLaunchBilling(
  engagementId: string
): Promise<DrsLaunchBillingResult> {
  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  if (!engagement || !(await isDigitalRainmakerEngagement(engagement.templateId))) {
    return { ok: false, error: "not_drs" };
  }

  const [setup] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(drsRoleCondition(engagementId, SETUP_ROLES))
    .orderBy(asc(invoices.createdAt))
    .limit(1);
  if (!setup || setup.status !== "paid") {
    return { ok: false, error: "setup_unpaid" };
  }

  const [existingLaunch] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(drsRoleCondition(engagementId, LAUNCH_ROLES))
    .limit(1);
  if (existingLaunch) return { ok: false, error: "already_started" };

  const signer = await getPrimaryClientSigner(engagementId);
  if (!signer) return { ok: false, error: "no_signer" };

  // Claim the launch atomically before creating anything.
  const billingStartedAt = new Date().toISOString();
  const claimed = await db
    .update(engagements)
    .set({
      metadata: sql`jsonb_set(COALESCE(${engagements.metadata}, '{}'::jsonb), '{billingStartedAt}', to_jsonb(${billingStartedAt}::text), true)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(engagements.id, engagementId),
        sql`(${engagements.metadata} IS NULL OR ${engagements.metadata}->'billingStartedAt' IS NULL)`
      )
    )
    .returning({ id: engagements.id });
  if (claimed.length === 0) return { ok: false, error: "already_started" };

  let created: (typeof invoices.$inferSelect)[];
  try {
    created = await createDrsInvoices({
      engagement,
      signer,
      specs: drsLaunchInvoiceSpecs(planOf(engagement)),
    });
  } catch (err) {
    // Release the claim so the admin can retry.
    await db
      .update(engagements)
      .set({ metadata: sql`${engagements.metadata} - 'billingStartedAt'` })
      .where(eq(engagements.id, engagementId));
    throw err;
  }
  if (created.length === 0) return { ok: false, error: "already_started" };

  try {
    await appendActivity(engagementId, {
      actor: "agency",
      type: "billing_started",
      message: "Build complete — your first monthly invoice is on its way.",
    });
  } catch (err) {
    console.error("DRS: billing_started activity failed:", err);
  }

  return { ok: true, invoiceId: created[0].id, billingStartedAt };
}

// ── Status (admin onboarding view) ────────────────────────

export interface DrsBillingStatus {
  isDrs: boolean;
  plan: BillingPlan;
  setup: {
    invoiceId: string;
    invoiceNumber: string;
    status: string;
    total: number;
    paidAt: string | null;
  } | null;
  firstMonthly: {
    invoiceId: string;
    invoiceNumber: string;
    status: string;
    total: number;
    paidAt: string | null;
    createdAt: string;
  } | null;
  billingStartedAt: string | null;
}

const isoOrNull = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;

/** Where a DRS engagement is in the setup → build → first-monthly sequence. */
export async function getDrsBillingStatus(
  engagementId: string
): Promise<DrsBillingStatus> {
  const [engagement] = await db
    .select({ templateId: engagements.templateId, metadata: engagements.metadata })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  const plan = engagement ? planOf(engagement) : "monthly";
  const isDrs = engagement
    ? await isDigitalRainmakerEngagement(engagement.templateId)
    : false;
  if (!engagement || !isDrs) {
    return { isDrs: false, plan, setup: null, firstMonthly: null, billingStartedAt: null };
  }

  const cols = {
    invoiceId: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    status: invoices.status,
    total: invoices.total,
    paidAt: invoices.paidAt,
    createdAt: invoices.createdAt,
  };
  const [setup] = await db
    .select(cols)
    .from(invoices)
    .where(drsRoleCondition(engagementId, SETUP_ROLES))
    .orderBy(asc(invoices.createdAt))
    .limit(1);
  const [first] = await db
    .select(cols)
    .from(invoices)
    .where(drsRoleCondition(engagementId, LAUNCH_ROLES))
    .orderBy(asc(invoices.createdAt))
    .limit(1);

  const meta = (engagement.metadata ?? {}) as EngagementMeta;
  return {
    isDrs: true,
    plan,
    setup: setup
      ? {
          invoiceId: setup.invoiceId,
          invoiceNumber: setup.invoiceNumber,
          status: setup.status,
          total: setup.total,
          paidAt: isoOrNull(setup.paidAt),
        }
      : null,
    firstMonthly: first
      ? {
          invoiceId: first.invoiceId,
          invoiceNumber: first.invoiceNumber,
          status: first.status,
          total: first.total,
          paidAt: isoOrNull(first.paidAt),
          createdAt: isoOrNull(first.createdAt) as string,
        }
      : null,
    billingStartedAt: typeof meta.billingStartedAt === "string" ? meta.billingStartedAt : null,
  };
}

// ── Payment hook ──────────────────────────────────────────

/**
 * Call after an invoice reaches status "paid" (Stripe card, settled ACH, or a
 * manually recorded payment). For DRS invoices:
 *   - up-front invoice (setup_fee / setup_annual) → opens onboarding, sends
 *     the welcome emails, notifies the owner ("setup_paid")
 *   - first paid recurring invoice (platform_monthly / ad_spend_monthly) →
 *     notifies the owner ("monthly_paid") + Launch Pad activity entry
 * Idempotent (initOnboarding / a metadata marker gate each side effect);
 * never throws.
 */
export async function onDrsInvoicePaid(invoiceId: string): Promise<void> {
  try {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (!invoice || invoice.status !== "paid") return;

    const meta = (invoice.metadata ?? {}) as Partial<DrsMetadata>;
    const engagementId = typeof meta.engagementId === "string" ? meta.engagementId : null;
    const role = meta.drsRole;
    if (!engagementId || !role) return;

    const [engagement] = await db
      .select()
      .from(engagements)
      .where(eq(engagements.id, engagementId))
      .limit(1);
    if (!engagement) return;

    if (SETUP_ROLES.includes(role)) {
      const opened = await initOnboarding(engagementId, "auto_sign", "drs");
      if (!opened) return;
      await sendOnboardingWelcomeEmails(engagementId);
      const what =
        role === "setup_annual"
          ? `${formatCurrency(ANNUAL_UPFRONT_CENTS, "usd")} annual`
          : `${formatCurrency(DRS_PRICING.SETUP_FEE_CENTS, "usd")} setup`;
      try {
        await createNotification({
          userId: engagement.ownerId,
          type: "setup_paid",
          title: "Setup paid — onboarding opened",
          message: `${invoice.clientName} paid the ${what} invoice. Their Launch Pad is live.`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            engagementId,
            drsRole: role,
          },
        });
      } catch (err) {
        console.error("DRS: setup_paid notification failed:", err);
      }
      return;
    }

    if (LAUNCH_ROLES.includes(role)) {
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(invoices)
        .where(and(drsRoleCondition(engagementId, LAUNCH_ROLES), eq(invoices.status, "paid")));
      if (Number(count) !== 1) return;

      // Gate on a one-time marker so a replayed webhook doesn't notify twice.
      const paidAt = new Date().toISOString();
      const marked = await db
        .update(engagements)
        .set({
          metadata: sql`jsonb_set(COALESCE(${engagements.metadata}, '{}'::jsonb), '{firstMonthlyPaidAt}', to_jsonb(${paidAt}::text), true)`,
        })
        .where(
          and(
            eq(engagements.id, engagementId),
            sql`(${engagements.metadata} IS NULL OR ${engagements.metadata}->'firstMonthlyPaidAt' IS NULL)`
          )
        )
        .returning({ id: engagements.id });
      if (marked.length === 0) return;

      try {
        await createNotification({
          userId: engagement.ownerId,
          type: "monthly_paid",
          title: "First monthly paid — clear to launch ads",
          message: `${invoice.clientName} paid their first monthly invoice ${invoice.invoiceNumber} (${formatCurrency(invoice.total, invoice.currency)}). Clear to launch ads.`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            engagementId,
            drsRole: role,
          },
        });
      } catch (err) {
        console.error("DRS: monthly_paid notification failed:", err);
      }
      try {
        await appendActivity(engagementId, {
          actor: "system",
          type: "monthly_paid",
          message: "First monthly invoice paid — your ads are cleared to launch 🚀",
        });
      } catch (err) {
        console.error("DRS: monthly_paid activity failed:", err);
      }
    }
  } catch (err) {
    console.error("onDrsInvoicePaid failed:", err);
  }
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
