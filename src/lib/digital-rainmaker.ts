/**
 * Digital Rainmaker System — Auto-Invoicing Flow
 *
 * Billing for engagement letters built from the "Digital Rainmaker System"
 * template happens in three steps:
 *
 *   1. SIGNING (triggerDrsPostSign) — only the up-front invoice is sent:
 *        - Monthly plan → a one-time Setup Fee invoice at the letter's
 *                         own Setup Fee ($40,000, or the original $32,000 —
 *                         setupFeeOf) (drsRole "setup_fee", see SETUP_SCOPE)
 *        - Annual plan  → ONE one-time invoice (drsRole "setup_annual"):
 *                         Setup Fee + $42,000 prepaid platform year, two
 *                         line items ($82,000, or $74,000 original)
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
 *      AUTOPAY (lib/autopay.ts): the client pays that invoice once through a
 *      subscription-mode Stripe Checkout (bank or card, locked to that
 *      method, each at its own price — dual pricing). Stripe then charges the
 *      saved method every month; the webhook records each charge as a new,
 *      already-paid invoice (a receipt) and the recurring cron skips parents
 *      on autopay. State: invoices/engagements metadata.autopay.
 *
 *   4. END OF THE ANNUAL TERM (daily cron) — annual plan only.
 *      - Letters signed from Nov 9 2026 do NOT renew automatically (Sections
 *        2(b), 4(d)): runAnnualTermEndReminders tells Marcel thirty days
 *        before the term ends (metadata.termEndsAt, stamped at Build
 *        complete) to get the client's written agreement to continue, and
 *        the ad-budget billing stops at the term's end (recurringEndDate on
 *        the parent; cancel_at on its autopay subscription).
 *      - Older annual letters that DO renew automatically (they contain
 *        ANNUAL_AUTO_RENEW_MARKER) keep runAnnualRenewals: a one-time $42,000
 *        "platform_annual_renewal" invoice thirty days before each
 *        anniversary of the paid setup_annual invoice, due on the anniversary.
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
 * forward by its interval and copies the metadata — except parents on
 * autopay (metadata.autopay.subscriptionId), which Stripe bills directly. Legacy engagements may
 * still carry "platform_annual" invoices from the previous flow.
 *
 * Template detection is by name (case-insensitive contains "digital rainmaker").
 *
 * ── Nov 19 2026 pricing (Agency Fee + Performance Pay, no setup fee) ──
 * Letters built by lib/drs-performance-letter.ts follow a different sequence
 * (isPerformanceEngagement decides, from the SIGNED letter). Everything above
 * still describes the previous pricing, which keeps running unchanged.
 *
 *   1. SIGNING — the first Agency Fee is invoiced: drsRole "agency_monthly"
 *      ($10,000, recurring; paying it once starts autopay), or
 *      "agency_prepay" ($50,000 for the six months, one-time). No setup
 *      invoice. The Initial Term is stamped from the signing date
 *      (metadata.termStartsAt / termEndsAt), not from Launch.
 *   2. THAT INVOICE PAID — the Launch Pad opens, welcome emails go out and
 *      the pipeline lead turns Won.
 *   3. BUILD COMPLETE (same admin button) — nothing is invoiced: it records
 *      Launch (metadata.billingStartedAt). An AI avatar the client chose is
 *      sent as its own one-time "ai_avatar" invoice, since their first
 *      monthly invoice is already paid by then.
 *   4. EVERY MONTH — autopay charges the Agency Fee; Performance Pay is a
 *      separate "performance_pay" invoice Marcel sends from the month's
 *      statement (lib/performance). Nothing is invoiced for it by itself.
 *   5. PREPAID TERM ROLLS OVER (daily cron, runAgencyPrepaidRenewals) — the
 *      first monthly Agency Fee of the renewal term is invoiced, unless a
 *      non-renewal was recorded (metadata.cancellation).
 * The ad budget never appears on any of these invoices: the client pays the
 * platform directly.
 */

import { db } from "@/db";
import { usesBankTransfer } from "@/lib/bank-transfer";
import {
  engagements,
  engagementSigners,
  engagementTemplates,
  invoices,
  invoiceLineItems,
  users,
} from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
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
import { markLeadWonForPaidInvoice } from "@/lib/pipeline-won";
import {
  initOnboarding,
  getOnboardingState,
  appendActivity,
} from "@/lib/onboarding";

// Pricing lives in drs-pricing.ts (client-safe module); re-exported here so
// existing server-side imports keep working.
import {
  AGENCY,
  DRS_PRICING,
  DRS_SETUP_FEES,
  FIRST_MONTH_AD_BONUS_CENTS,
  SETUP_SCOPE,
  TOTAL_MONTHLY_CENTS,
  TERM_MONTHS,
  annualUpfrontCents,
  type BillingPlan,
} from "./drs-pricing";
import { drsAnnualAutoRenews, drsHasFirstMonthBonus, drsTermRunsFromLaunch, setupFeeOfLetter } from "./engagement-defaults";
import { isPerformanceLetter, performanceLetterTerms, type PerformanceLetterTerms } from "./drs-performance-letter";
import { NEXLI_LEGAL } from "./nexli-legal";
import { avatarPickOf, type AvatarStateLike } from "./ai-avatar-choice";
import { getNexliAdminId } from "./foundation-project";

export { DRS_PRICING } from "./drs-pricing";
export type { BillingPlan } from "./drs-pricing";

export type DrsRole =
  | "setup_fee"
  | "setup_annual"
  | "platform_monthly"
  | "platform_annual" // legacy (pre-Oct 18 2026 annual flow)
  | "ad_spend_monthly"
  | "platform_annual_renewal" // annual plan: $42,000 each anniversary (runAnnualRenewals)
  // Nov 19 2026 pricing:
  | "agency_monthly" // $10,000 monthly Agency Fee (recurring; autopay after the first payment)
  | "agency_prepay" // $50,000 six-month prepayment (one-time)
  | "performance_pay" // a month's Performance Pay, sent from its statement (lib/performance)
  | "ai_avatar"; // the $2,500 AI avatar pick, on its own invoice at Build complete

/** Up-front invoice roles (sent at signing; paying one opens onboarding). */
const SETUP_ROLES: DrsRole[] = ["setup_fee", "setup_annual"];
/** First-recurring invoice roles (sent when the build is complete). */
const LAUNCH_ROLES: DrsRole[] = ["platform_monthly", "ad_spend_monthly"];
/** Nov 19 2026 pricing: the Agency Fee invoices (the first one, sent at signing, opens onboarding when paid). */
export const AGENCY_ROLES: DrsRole[] = ["agency_monthly", "agency_prepay"];

interface DrsMetadata {
  engagementId: string;
  drsRole: DrsRole;
  /** Managed Advertising Budget (pass-through) included in this invoice's total, in cents. */
  adSpendCents: number;
  /** Initial contract term snapshotted from the engagement, when known. */
  termMonths?: number;
  /** platform_annual_renewal only: 1 = first renewal (year 2), 2 = year 3, … */
  renewalYear?: number;
  /** platform_annual_renewal only: ISO start (the anniversary) / exclusive end of the renewed year. */
  periodStart?: string;
  periodEnd?: string;
  /**
   * One-time charges on a RECURRING invoice (the client's chosen AI avatar on
   * the first monthly invoice): never copied to later months, never part of
   * autopay's monthly price or MRR (lib/recurring-copy.ts).
   */
  oneTimeCents?: number;
  /** The library avatar the client chose (slug), when oneTimeCents is its fee. */
  aiAvatar?: string;
  /** performance_pay only: the billing Month this invoice is for (1 = the Month that begins at signing). */
  monthIndex?: number;
  /** performance_pay only: the Month's statement totals, shown on the invoice page. */
  statement?: Record<string, unknown>;
}

interface EngagementMeta {
  billingPlan?: BillingPlan;
  termMonths?: number;
  /** The Setup Fee the letter states, snapshotted at send (Nov 16 2026 on). */
  setupFeeCents?: number;
  /** Which setup-fee version the letter was composed with ("current" $40,000 / "original" $32,000). */
  drsPricing?: string;
  /** ISO timestamp the first recurring invoice was sent (build complete). */
  billingStartedAt?: string;
  /** ISO timestamp the first recurring invoice was paid (idempotency marker). */
  firstMonthlyPaidAt?: string;
  /** Client firm name captured at compose time (fills the letter's parties block). */
  clientCompany?: string | null;
  /** ISO timestamp the engagement was terminated (stops annual renewals). */
  terminatedAt?: string;
  /** ISO end of the Initial Term (Section 4(d)), stamped at Build complete. */
  termEndsAt?: string;
  /** ISO timestamp Marcel was reminded that a non-renewing annual term is ending. */
  termEndReminderAt?: string;
  /** Nov 19 2026 pricing: how the Agency Fee is paid for the Initial Term. */
  agencyBilling?: string;
  /** Nov 19 2026 pricing: ISO signing date — the Initial Term and the first Month count from it. */
  termStartsAt?: string;
  /** Nov 19 2026 pricing: a recorded notice of non-renewal and the date the agreement then ends. */
  cancellation?: { noticeAt?: string; endsAt?: string };
}

/**
 * True for an engagement on the Nov 19 2026 pricing (Agency Fee +
 * Performance Pay, no setup fee). The signed letter decides: its Section 3
 * "PERFORMANCE PAY" makes it one, and a letter with a Setup Fee line never
 * is. Metadata is only the fallback for a letter whose text says neither.
 */
export function isPerformanceEngagement(engagement: { metadata: unknown; content?: string | null }): boolean {
  if (isPerformanceLetter(engagement.content)) return true;
  if (setupFeeOfLetter(engagement.content)) return false;
  return ((engagement.metadata ?? {}) as EngagementMeta).drsPricing === "performance";
}

/** The fee, percentage, billing choice and term a performance engagement's letter states. */
export function agencyTermsOf(engagement: { content?: string | null }): PerformanceLetterTerms {
  return performanceLetterTerms(engagement.content);
}

/**
 * The engagement's billing plan. Uses metadata.billingPlan; if it's missing
 * (letters saved before the Oct 18 2026 fix were mis-tagged as Enterprise
 * and lost it), falls back to the signed letter text, which only contains
 * "Annual Investment (Paid in Full)" on the annual plan.
 */
export function planOf(engagement: { metadata: unknown; content?: string | null }): BillingPlan {
  const meta = (engagement.metadata ?? {}) as EngagementMeta;
  if (meta.billingPlan === "annual" || meta.billingPlan === "monthly") return meta.billingPlan;
  return engagement.content?.includes("Annual Investment (Paid in Full)") ? "annual" : "monthly";
}

/**
 * The Setup Fee this engagement bills at signing, in cents. The signed
 * letter's own Section 2(a) line wins (billing charges what the client
 * signed), then the amount snapshotted at send, then the original $32,000
 * every letter carried before Nov 16 2026.
 */
export function setupFeeOf(engagement: { metadata: unknown; content?: string | null }): number {
  const fromLetter = setupFeeOfLetter(engagement.content);
  if (fromLetter) return fromLetter;
  const meta = (engagement.metadata ?? {}) as EngagementMeta;
  if (typeof meta.setupFeeCents === "number" && meta.setupFeeCents > 0) return meta.setupFeeCents;
  return DRS_SETUP_FEES.original;
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

/**
 * True if a DRS invoice with this role already exists for the engagement
 * (and, for renewals, for this renewal year).
 */
async function drsInvoiceExists(
  engagementId: string,
  drsRole: DrsRole,
  renewalYear?: number,
  unique?: Record<string, string | number>
): Promise<boolean> {
  const match: Record<string, unknown> = { engagementId, drsRole, ...(unique ?? {}) };
  if (renewalYear !== undefined) match.renewalYear = renewalYear;
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      sql`${invoices.metadata} @> ${JSON.stringify(match)}::jsonb`
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
      bankTransfer: await usesBankTransfer(invoice),
    });

    await sendEmailWithLog({
      to: invoice.clientEmail,
      subject,
      html,
      fromName: branding.fromName,
      ...(branding.isNexli ? { replyTo: NEXLI_LEGAL.email } : {}),
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
  /** Explicit due date (default: due now). */
  dueDate?: Date;
  /** Renewal tags written into the invoice metadata (and part of the idempotency key). */
  renewal?: { renewalYear: number; periodStart: string; periodEnd: string };
  /** Owner notification title (default "Invoice sent"). */
  notificationTitle?: string;
  /** One-time lines inside a recurring invoice (the AI avatar fee), in cents. */
  oneTimeCents?: number;
  /** The chosen AI avatar's slug, tagged on the invoice. */
  aiAvatar?: string;
  /** Extra tags that are also part of the idempotency key (Performance Pay: { monthIndex } — one invoice per Month). */
  unique?: Record<string, string | number>;
  /** Extra tags written to the invoice metadata (Performance Pay: the statement totals). */
  meta?: Record<string, unknown>;
}

function setupLine(setupCents: number) {
  return {
    description: "Digital Rainmaker System — Setup Fee (Phase 1 Implementation)",
    amountCents: setupCents,
    billingType: "one_time" as const,
  };
}

/**
 * The up-front invoice sent at signing (due immediately), at the letter's
 * Setup Fee (setupFeeOf). Monthly plan: the Setup Fee ($40,000, or the
 * original $32,000). Annual plan: ONE invoice for setup + the prepaid year
 * ($82,000, or $74,000).
 */
export function drsSigningInvoiceSpecs(plan: BillingPlan, setupCents: number = DRS_PRICING.SETUP_FEE_CENTS): DrsInvoiceSpec[] {
  const scope = SETUP_SCOPE.map((g) => g.title).join(", ");
  if (plan === "annual") {
    return [
      {
        role: "setup_annual",
        recurring: false,
        interval: "yearly",
        totalCents: annualUpfrontCents(setupCents),
        adSpendCents: 0,
        label: "Setup + annual platform",
        notes: `Setup Fee covering the Phase 1 Implementation of the Digital Rainmaker System — ${scope} — as itemized in Section 1 of your engagement letter, plus the annual platform investment for your first 12 months from launch, paid in full. Due at signing; onboarding opens once it is paid. Non-refundable. Paid by bank transfer (ACH or wire); cards are not accepted. The Managed Advertising Budget is billed monthly once your build is complete.`,
        lines: [
          setupLine(setupCents),
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
      totalCents: setupCents,
      adSpendCents: 0,
      label: "Setup Fee",
      notes: `One-time Setup Fee covering the Phase 1 Implementation of the Digital Rainmaker System — ${scope} — as itemized in Section 1 of your engagement letter. Due at signing; onboarding opens once it is paid. Non-refundable. Paid by bank transfer (ACH or wire); cards are not accepted.`,
      lines: [setupLine(setupCents)],
    },
  ];
}

/**
 * Nov 19 2026 pricing — the invoice sent at signing (due immediately), at
 * the letter's own amounts. Monthly: the first $10,000 Agency Fee, which is
 * also the recurring parent (paying it once starts autopay). Prepaid: ONE
 * $50,000 invoice for the six months. No setup fee, and no ad-budget line:
 * the client pays the ad platform directly.
 */
export function drsAgencySigningSpecs(terms: PerformanceLetterTerms): DrsInvoiceSpec[] {
  const fee = formatCurrency(terms.feeCents, "usd");
  const performance = `Performance Pay (${terms.percent}% of net attributed revenue, with each month's Agency Fee credited against it) is invoiced separately, from each month's statement.`;
  const adBudget = "Your advertising budget is not on this invoice: you pay the ad platform directly, on your own payment method.";
  if (terms.billing === "prepay") {
    const prepay = terms.prepayCents ?? terms.feeCents * terms.termMonths;
    return [
      {
        role: "agency_prepay",
        recurring: false,
        interval: "monthly",
        totalCents: prepay,
        adSpendCents: 0,
        label: "Six-month prepayment",
        notes: `Six-Month Prepayment for the Digital Rainmaker System: the build and running all of it for your first ${terms.termMonths} months, in place of ${terms.termMonths} monthly Agency Fees of ${fee}. There is no setup fee. Due at signing; your Launch Pad opens once it is paid. Non-refundable. ${performance} ${adBudget}`,
        lines: [
          {
            description: `Digital Rainmaker System — Six-Month Prepayment (months 1–${terms.termMonths})`,
            amountCents: prepay,
            billingType: "one_time",
          },
        ],
      },
    ];
  }
  return [agencyMonthlySpec(terms, `Your first monthly Agency Fee for the Digital Rainmaker System: the build and running all of it. There is no setup fee. Due at signing; your Launch Pad opens once it is paid. Pay once, by card or bank (ACH): your payment method is then charged automatically each month (autopay). ${performance} ${adBudget}`, "First month")];
}

/** The recurring $10,000 Agency Fee invoice (the first one of a monthly client, or of a prepaid client's renewal term). */
function agencyMonthlySpec(terms: PerformanceLetterTerms, notes: string, label: string, dueDate?: Date): DrsInvoiceSpec {
  return {
    role: "agency_monthly",
    recurring: true,
    interval: "monthly",
    totalCents: terms.feeCents,
    adSpendCents: 0,
    label,
    notes,
    lines: [
      {
        description: "Digital Rainmaker System — Monthly Agency Fee",
        amountCents: terms.feeCents,
        billingType: "monthly",
      },
    ],
    ...(dueDate ? { dueDate } : {}),
  };
}

/**
 * Nov 19 2026 pricing — a Month's Performance Pay, sent from its statement
 * (lib/performance). One per Month (monthIndex is part of the idempotency
 * key); due a week after it is sent (letter 3(h)). The invoice carries the
 * statement's totals, never the client list.
 */
export function drsPerformanceInvoiceSpec(args: {
  monthIndex: number;
  periodLabel: string;
  dueCents: number;
  dueDate: Date;
  /** The Month's totals (cents) — shown on the invoice page. */
  statement: Record<string, unknown>;
  /** One sentence spelling the calculation out, for the invoice notes. */
  summary: string;
}): DrsInvoiceSpec {
  return {
    role: "performance_pay",
    recurring: false,
    interval: "monthly",
    totalCents: args.dueCents,
    adSpendCents: 0,
    label: "Performance pay",
    notificationTitle: "Performance pay invoice sent",
    notes: `Performance Pay for ${args.periodLabel}, under Section 3 of your engagement letter. ${args.summary} The client-by-client statement is in your portal; tell us within ${AGENCY.DISPUTE_DAYS} days if any line looks wrong.`,
    dueDate: args.dueDate,
    unique: { monthIndex: args.monthIndex },
    meta: { statement: args.statement },
    lines: [
      {
        description: `Digital Rainmaker System — Performance Pay (${args.periodLabel})`,
        amountCents: args.dueCents,
        billingType: "one_time",
      },
    ],
  };
}

/** Nov 19 2026 pricing: the AI avatar a client chose, on its own one-time invoice (their first monthly is already paid). */
export function drsAvatarInvoiceSpec(avatar: { slug: string; name: string; feeCents: number }): DrsInvoiceSpec {
  return {
    role: "ai_avatar",
    recurring: false,
    interval: "monthly",
    totalCents: avatar.feeCents,
    adSpendCents: 0,
    aiAvatar: avatar.slug,
    label: "AI avatar",
    notes: `One-time ${formatCurrency(avatar.feeCents, "usd")} for ${avatar.name}, the AI avatar you chose on your Launch Pad — exclusive to your firm. It is not part of your monthly Agency Fee and is charged once.`,
    lines: [
      {
        description: `AI Avatar — ${avatar.name}, exclusive to your firm (one-time)`,
        amountCents: avatar.feeCents,
        billingType: "one_time",
      },
    ],
  };
}

/**
 * The first recurring invoice, sent when the admin marks the build complete
 * (due immediately; the cron bills it monthly from there). Monthly plan:
 * $9,997 (platform + ad budget). Annual plan: the $5,000 ad budget. Letters
 * with the first-month ad bonus (Section 3(e)) say so in the notes; the
 * bonus is Nexli's money and is never billed.
 */
export function drsLaunchInvoiceSpecs(
  plan: BillingPlan,
  opts: { bonus?: boolean; avatar?: { slug: string; name: string; feeCents: number } | null } = {}
): DrsInvoiceSpec[] {
  const platform = formatCurrency(DRS_PRICING.MONTHLY_CENTS, "usd");
  const adBudget = formatCurrency(DRS_PRICING.AD_SPEND_MONTHLY_CENTS, "usd");
  const bonusNote = opts.bonus
    ? ` Your first month of ads also gets Nexli's ${formatCurrency(FIRST_MONTH_AD_BONUS_CENTS[plan], "usd")} first-month bonus${plan === "annual" ? " in ad credits" : ", matching your budget"} — Nexli's own money, not billed.`
    : "";
  // The AI avatar the client chose on their Launch Pad: a one-time line on
  // this first invoice only (never in later months or autopay's monthly price).
  const avatar = opts.avatar && opts.avatar.feeCents > 0 ? opts.avatar : null;
  const avatarLine = avatar
    ? {
        description: `AI Avatar — ${avatar.name}, exclusive to your firm (one-time)`,
        amountCents: avatar.feeCents,
        billingType: "one_time" as const,
      }
    : null;
  const avatarNote = avatar
    ? ` This first invoice also includes the one-time ${formatCurrency(avatar.feeCents, "usd")} for ${avatar.name}, the AI avatar you chose — exclusive to your firm. Later months don't include it.`
    : "";
  const avatarTags = avatar ? { oneTimeCents: avatar.feeCents, aiAvatar: avatar.slug } : {};
  const extra = avatar ? avatar.feeCents : 0;
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
        totalCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS + extra,
        adSpendCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
        ...avatarTags,
        label: "Monthly ad budget",
        notes: `Managed Advertising Budget (${adBudget}/month) for the Digital Rainmaker System — deployed on your behalf on the advertising platforms at no markup. Your build is complete; ads launch once this invoice is paid. Pay once to start your monthly service — your payment method is then charged automatically each month (autopay).${bonusNote}${avatarNote}`,
        lines: avatarLine ? [adLine, avatarLine] : [adLine],
      },
    ];
  }
  return [
    {
      role: "platform_monthly",
      recurring: true,
      interval: "monthly",
      totalCents: TOTAL_MONTHLY_CENTS + extra,
      adSpendCents: DRS_PRICING.AD_SPEND_MONTHLY_CENTS,
      ...avatarTags,
      label: "Monthly",
      notes: `Monthly investment for the Digital Rainmaker System: ${platform} platform upkeep (maintenance and support, ad management, reporting, AI usage) + ${adBudget} Managed Advertising Budget deployed on your behalf at no markup. Your build is complete; services and ads start once this invoice is paid. Pay once to start your monthly service — your payment method is then charged automatically each month (autopay).${bonusNote}${avatarNote}`,
      lines: [
        {
          description: "Digital Rainmaker System — Monthly Platform",
          amountCents: DRS_PRICING.MONTHLY_CENTS,
          billingType: "monthly",
        },
        adLine,
        ...(avatarLine ? [avatarLine] : []),
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
    if (await drsInvoiceExists(engagement.id, spec.role, spec.renewal?.renewalYear, spec.unique)) continue;

    const dueDate = spec.dueDate ? new Date(spec.dueDate) : new Date();

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
      ...(spec.renewal ?? {}),
      ...(spec.oneTimeCents ? { oneTimeCents: spec.oneTimeCents } : {}),
      ...(spec.aiAvatar ? { aiAvatar: spec.aiAvatar } : {}),
      ...(spec.meta ?? {}),
      ...(spec.unique ?? {}),
    };

    const [invoice] = await db
      .insert(invoices)
      .values({
        ownerId: engagement.ownerId,
        clientName: signer.name,
        clientEmail: signer.email,
        clientCompany: engMeta.clientCompany || null,
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
        title: spec.notificationTitle ?? "Invoice sent",
        message: `${spec.label} invoice ${invoice.invoiceNumber} (${formatCurrency(spec.totalCents, "usd")}) sent to ${signer.name} — awaiting payment`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          engagementId: engagement.id,
          drsRole: spec.role,
          ...(spec.renewal ? { renewalYear: spec.renewal.renewalYear } : {}),
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

  // Nov 19 2026 pricing: the first Agency Fee (or the six-month prepayment),
  // never a setup invoice. The term counts from signing — stamp it now.
  if (isPerformanceEngagement(engagement)) {
    const terms = agencyTermsOf(engagement);
    await stampAgencyTerm(engagement.id, terms.termMonths);
    const created = await createDrsInvoices({
      engagement,
      signer: primarySigner,
      specs: drsAgencySigningSpecs(terms),
    });
    return created[0] ?? null;
  }

  const created = await createDrsInvoices({
    engagement,
    signer: primarySigner,
    specs: drsSigningInvoiceSpecs(planOf(engagement), setupFeeOf(engagement)),
  });
  return created[0] ?? null;
}

/**
 * Nov 19 2026 pricing: the Initial Term runs from the date of last signature
 * (letter Section 4(d)), so it is stamped when signing completes — once; a
 * replay keeps the first dates. Never throws.
 */
async function stampAgencyTerm(engagementId: string, termMonths: number): Promise<void> {
  try {
    const start = new Date();
    const end = addMonthsClampedUtc(start, termMonths);
    await db
      .update(engagements)
      .set({
        metadata: sql`COALESCE(${engagements.metadata}, '{}'::jsonb) || jsonb_build_object('termStartsAt', ${start.toISOString()}::text, 'termEndsAt', ${end.toISOString()}::text)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(engagements.id, engagementId),
          sql`(${engagements.metadata} IS NULL OR ${engagements.metadata}->'termStartsAt' IS NULL)`
        )
      );
  } catch (err) {
    console.error("DRS: agency term stamp failed:", err);
  }
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
    // Nexli's own DRS Launch Pads carry the AI avatar step (optional).
    let avatarStep = false;
    try {
      const state = await getOnboardingState(engagementId);
      clientDueAt = state?.clientDueAt ?? null;
      if (state?.tasks?.ai_avatar) {
        const [eng] = await db.select({ ownerId: engagements.ownerId }).from(engagements).where(eq(engagements.id, engagementId)).limit(1);
        const nexliAdminId = await getNexliAdminId();
        avatarStep = Boolean(eng && nexliAdminId && eng.ownerId === nexliAdminId);
      }
    } catch (err) {
      console.error("Onboarding state read failed:", err);
    }

    // Nov 19 2026 pricing: the client pays its ad budget straight to Meta, so
    // the email says its own card goes on the ad account.
    let adBudgetDirect = false;
    try {
      const [eng] = await db.select({ content: engagements.content }).from(engagements).where(eq(engagements.id, engagementId)).limit(1);
      adBudgetDirect = isPerformanceLetter(eng?.content);
    } catch (err) {
      console.error("Onboarding welcome: letter read failed:", err);
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
          avatarStep,
          adBudgetDirect,
        });
        await sendEmailWithLog({
          to: s.email,
          subject,
          html,
          replyTo: NEXLI_LEGAL.email,
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
  // invoiceId is null on the Nov 19 2026 pricing when nothing is invoiced at Build complete (no AI avatar pick).
  | { ok: true; invoiceId: string | null; billingStartedAt: string }
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

  // Nov 19 2026 pricing: the monthly fee has been running since signing, so
  // Build complete only records Launch (and bills an AI avatar pick).
  if (isPerformanceEngagement(engagement)) return markAgencyLaunched(engagement);

  const [setup] = await db
    .select({ status: invoices.status, paidAt: invoices.paidAt })
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
      specs: drsLaunchInvoiceSpecs(planOf(engagement), {
        bonus: drsHasFirstMonthBonus(engagement.content),
        // The AI avatar the client chose on their Launch Pad ($2,500 one-time).
        avatar: avatarPickOf((engagement.metadata as { onboarding?: AvatarStateLike } | null)?.onboarding),
      }),
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

  // When the Initial Term ends (Section 4(d)): the Client Tracker shows it,
  // and annual letters that don't renew automatically stop billing there.
  const plan = planOf(engagement);
  const termEnd = drsTermEnd({
    content: engagement.content,
    plan,
    termMonths: (engagement.metadata as EngagementMeta | null)?.termMonths ?? null,
    launchAt: billingStartedAt,
    effectiveAt: setup.paidAt,
  });
  if (termEnd) {
    try {
      await db
        .update(engagements)
        .set({
          metadata: sql`jsonb_set(COALESCE(${engagements.metadata}, '{}'::jsonb), '{termEndsAt}', to_jsonb(${termEnd.toISOString()}::text), true)`,
        })
        .where(eq(engagements.id, engagementId));
    } catch (err) {
      console.error("DRS: termEndsAt stamp failed:", err);
    }
    // Annual plan with no automatic renewal: the monthly ad budget is billed
    // from Launch through the end of the Initial Term only (Section 2(c)).
    // The cron stops rolling a parent forward once its next date passes
    // recurringEndDate; autopay subscriptions get cancel_at (lib/autopay.ts).
    if (plan === "annual" && !drsAnnualAutoRenews(engagement.content)) {
      try {
        await db
          .update(invoices)
          .set({ recurringEndDate: new Date(termEnd.getTime() - DAY_MS), updatedAt: new Date() })
          .where(inArray(invoices.id, created.map((c) => c.id)));
      } catch (err) {
        console.error("DRS: recurringEndDate cap failed:", err);
      }
    }
  }

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

/**
 * Nov 19 2026 pricing — admin "Build complete": records Launch
 * (metadata.billingStartedAt, claimed atomically; it also locks the client's
 * AI avatar choice, as on the previous pricing). No monthly invoice goes out
 * — the Agency Fee has been billed since signing. If the client chose a
 * library AI avatar, that $2,500 is sent now as its own one-time invoice.
 * Requires the first Agency Fee invoice (or the prepayment) to be paid.
 */
async function markAgencyLaunched(engagement: typeof engagements.$inferSelect): Promise<DrsLaunchBillingResult> {
  const engagementId = engagement.id;
  const [first] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(drsRoleCondition(engagementId, AGENCY_ROLES))
    .orderBy(asc(invoices.createdAt))
    .limit(1);
  if (!first || first.status !== "paid") return { ok: false, error: "setup_unpaid" };

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

  let invoiceId: string | null = null;
  const avatar = avatarPickOf((engagement.metadata as { onboarding?: AvatarStateLike } | null)?.onboarding);
  if (avatar && avatar.feeCents > 0) {
    const signer = await getPrimaryClientSigner(engagementId);
    try {
      if (!signer) throw new Error("no client signer for the AI avatar invoice");
      const created = await createDrsInvoices({ engagement, signer, specs: [drsAvatarInvoiceSpec(avatar)] });
      invoiceId = created[0]?.id ?? null;
    } catch (err) {
      // Release the claim so the admin can retry (nothing was invoiced).
      await db
        .update(engagements)
        .set({ metadata: sql`${engagements.metadata} - 'billingStartedAt'` })
        .where(eq(engagements.id, engagementId));
      throw err;
    }
  }

  try {
    await appendActivity(engagementId, {
      actor: "agency",
      type: "billing_started",
      message: "Build complete — your ads are cleared to launch 🚀",
    });
  } catch (err) {
    console.error("DRS: launch activity failed:", err);
  }

  return { ok: true, invoiceId, billingStartedAt };
}

// ── Nov 19 2026 pricing: term, renewal and cancellation ───

/** Where a performance engagement's term stands on a given day. */
export interface AgencyTermState {
  /** ISO start of the Initial Term (the signing date). */
  startsAt: string;
  /** ISO end of the term running on `now` (or of the last term, once the agreement has ended). */
  currentEndsAt: string;
  /** 1 = Initial Term, 2 = first renewal, … */
  termNumber: number;
  /** ISO date the agreement ends when a non-renewal is recorded; null while it keeps renewing. */
  endsAt: string | null;
  /** True once `now` is past endsAt. */
  ended: boolean;
  /** ISO last day a notice still stops the NEXT renewal (current term end − notice days). */
  noticeDeadline: string;
}

/**
 * The end of the term that contains `at`: terms run back to back from the
 * start, each `termMonths` long (letter Section 4(d)). Pure.
 */
export function agencyTermEndAt(startsAt: Date, termMonths: number, at: Date): { end: Date; termNumber: number } {
  let termNumber = 1;
  let end = addMonthsClampedUtc(startsAt, termMonths);
  // 200 terms of six months is a century: a guard, not a limit anyone reaches.
  while (end.getTime() <= at.getTime() && termNumber < 200) {
    termNumber += 1;
    end = addMonthsClampedUtc(startsAt, termMonths * termNumber);
  }
  return { end, termNumber };
}

/**
 * When the agreement ends for a notice of non-renewal received on
 * `noticeAt`: the end of the term then running if the notice comes at least
 * `noticeDays` before it, otherwise the end of the following term. Pure.
 */
export function agencyEndForNotice(startsAt: Date, termMonths: number, noticeAt: Date, noticeDays: number): Date {
  const { end, termNumber } = agencyTermEndAt(startsAt, termMonths, noticeAt);
  const deadline = new Date(end.getTime() - noticeDays * DAY_MS);
  return noticeAt.getTime() <= deadline.getTime() ? end : addMonthsClampedUtc(startsAt, termMonths * (termNumber + 1));
}

/** The term state of a performance engagement, or null when its term was never stamped (not fully signed). */
export function agencyTermState(
  engagement: { metadata: unknown; content?: string | null },
  now: Date = new Date()
): AgencyTermState | null {
  const meta = (engagement.metadata ?? {}) as EngagementMeta;
  const start = typeof meta.termStartsAt === "string" ? new Date(meta.termStartsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const termMonths = agencyTermsOf(engagement).termMonths;
  const endsAtRaw = meta.cancellation?.endsAt;
  const endsAt = typeof endsAtRaw === "string" && !Number.isNaN(new Date(endsAtRaw).getTime()) ? new Date(endsAtRaw) : null;
  const ended = Boolean(endsAt && now.getTime() >= endsAt.getTime());
  // After the end, "current term" stays the last one.
  const at = ended && endsAt ? new Date(endsAt.getTime() - 1) : now;
  const { end, termNumber } = agencyTermEndAt(start, termMonths, at);
  return {
    startsAt: start.toISOString(),
    currentEndsAt: end.toISOString(),
    termNumber,
    endsAt: endsAt ? endsAt.toISOString() : null,
    ended,
    noticeDeadline: new Date(end.getTime() - AGENCY.CANCEL_NOTICE_DAYS * DAY_MS).toISOString(),
  };
}

// ── Step 4: Annual renewals (daily cron) ──────────────────

/** Renewal invoices go out this many days before each anniversary. */
export const ANNUAL_RENEWAL_NOTICE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `anchor` + `months` calendar months in UTC, clamped to the last day of the
 * target month (a Feb 29 anchor lands on Feb 28 in non-leap years, Jan 31 + 1
 * month → Feb 28/29). Always computed from the original anchor, so the
 * anniversary never drifts year over year.
 */
export function addMonthsClampedUtc(anchor: Date, months: number): Date {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth() + months;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      targetY,
      targetM,
      Math.min(anchor.getUTCDate(), lastDay),
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds()
    )
  );
}

/**
 * When the Initial Term ends: Launch + termMonths for letters whose term runs
 * from Launch (Nov 9 2026 on), else the effective date (the up-front invoice
 * paid) + termMonths, as each signed letter states. Null when unknown.
 */
export function drsTermEnd(args: {
  content: string | null | undefined;
  plan: BillingPlan;
  termMonths?: number | null;
  launchAt?: Date | string | null;
  effectiveAt?: Date | string | null;
}): Date | null {
  const months = args.termMonths && args.termMonths > 0 ? args.termMonths : TERM_MONTHS[args.plan];
  const startRaw = drsTermRunsFromLaunch(args.content) ? args.launchAt : args.effectiveAt;
  if (!startRaw) return null;
  const start = new Date(startRaw);
  if (isNaN(start.getTime())) return null;
  return addMonthsClampedUtc(start, months);
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The renewal invoice spec for renewal year N (N = 1 → the second platform year). */
export function drsAnnualRenewalSpec(
  renewalYear: number,
  periodStart: Date,
  periodEnd: Date
): DrsInvoiceSpec {
  const adBudget = formatCurrency(DRS_PRICING.AD_SPEND_MONTHLY_CENTS, "usd");
  const lastDay = new Date(periodEnd.getTime() - DAY_MS);
  return {
    role: "platform_annual_renewal",
    recurring: false,
    interval: "yearly",
    totalCents: DRS_PRICING.ANNUAL_CENTS,
    adSpendCents: 0,
    label: `Annual renewal (Year ${renewalYear + 1})`,
    notes: `Annual renewal of your Digital Rainmaker platform for ${fmtDay(periodStart)} – ${fmtDay(lastDay)}, due ${fmtDay(periodStart)}. Your ${adBudget}/mo ad budget continues to bill monthly.`,
    lines: [
      {
        description: `Digital Rainmaker System — Annual Platform Renewal (Year ${renewalYear + 1})`,
        amountCents: DRS_PRICING.ANNUAL_CENTS,
        billingType: "yearly",
      },
    ],
    dueDate: periodStart,
    renewal: {
      renewalYear,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    },
    notificationTitle: "Annual renewal invoice sent",
  };
}

/**
 * Daily cron: sends the annual plan's renewal invoice ($42,000) thirty days
 * before each anniversary of the effective date (paidAt of the setup_annual
 * invoice), due on the anniversary — contract Section 2(b).
 *
 * For each paid setup_annual invoice, renewal year N (1, 2, …) is the first
 * year without a platform_annual_renewal invoice (any status — a voided one
 * still counts, so the admin can cancel a renewal by voiding it). Its due
 * date is anchor + 12·N months; it's created once now >= due − 30 days. At
 * most one renewal per engagement per run (a backlog catches up a year per
 * day). Skips engagements that aren't "signed" or carry metadata.terminatedAt.
 * Never throws per engagement.
 */
export async function runAnnualRenewals(
  now: Date = new Date()
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  const anchors = await db
    .select({ metadata: invoices.metadata, paidAt: invoices.paidAt })
    .from(invoices)
    .where(
      and(
        sql`${invoices.metadata}->>'drsRole' = 'setup_annual'`,
        eq(invoices.status, "paid"),
        sql`${invoices.paidAt} IS NOT NULL`
      )
    )
    .orderBy(asc(invoices.paidAt));

  const seen = new Set<string>();
  for (const row of anchors) {
    try {
      const meta = (row.metadata ?? {}) as Partial<DrsMetadata>;
      const engagementId = typeof meta.engagementId === "string" ? meta.engagementId : null;
      // One anchor per engagement (the earliest payment).
      if (!engagementId || !row.paidAt || seen.has(engagementId)) {
        skipped++;
        continue;
      }
      seen.add(engagementId);

      const [engagement] = await db
        .select()
        .from(engagements)
        .where(eq(engagements.id, engagementId))
        .limit(1);
      const engMeta = (engagement?.metadata ?? {}) as EngagementMeta;
      if (!engagement || engagement.status !== "signed" || engMeta.terminatedAt) {
        skipped++;
        continue;
      }
      // Only letters that say they renew automatically are invoiced. Annual
      // letters from Nov 9 2026 don't — runAnnualTermEndReminders covers them.
      if (!drsAnnualAutoRenews(engagement.content)) {
        skipped++;
        continue;
      }

      const existing = await db
        .select({ metadata: invoices.metadata })
        .from(invoices)
        .where(
          sql`${invoices.metadata} @> ${JSON.stringify({ engagementId, drsRole: "platform_annual_renewal" })}::jsonb`
        );
      const invoicedYears = new Set(
        existing
          .map((e) => (e.metadata as Partial<DrsMetadata> | null)?.renewalYear)
          .filter((y): y is number => typeof y === "number")
      );
      let year = 1;
      while (invoicedYears.has(year)) year++;

      const anchor = new Date(row.paidAt);
      const due = addMonthsClampedUtc(anchor, 12 * year);
      if (now.getTime() < due.getTime() - ANNUAL_RENEWAL_NOTICE_DAYS * DAY_MS) {
        skipped++;
        continue;
      }

      const signer = await getPrimaryClientSigner(engagementId);
      if (!signer) {
        skipped++;
        continue;
      }

      const periodEnd = addMonthsClampedUtc(anchor, 12 * (year + 1));
      const made = await createDrsInvoices({
        engagement,
        signer,
        specs: [drsAnnualRenewalSpec(year, due, periodEnd)],
      });
      if (made.length > 0) created++;
      else skipped++;
    } catch (err) {
      console.error("DRS: annual renewal failed:", err);
      skipped++;
    }
  }

  return { created, skipped };
}

/** Marcel hears this many days before a non-renewing annual term ends. */
export const ANNUAL_TERM_END_NOTICE_DAYS = 30;

/**
 * Daily cron: annual letters signed from Nov 9 2026 don't renew
 * automatically (Sections 2(b), 4(d)). Thirty days before the Initial Term
 * ends (metadata.termEndsAt), Marcel gets a bell + email reminder to get the
 * client's written agreement to continue — otherwise the engagement simply
 * ends, and its ad-budget billing is already capped at the term's end.
 * Claimed once per engagement (metadata.termEndReminderAt). Never throws per
 * engagement.
 */
export async function runAnnualTermEndReminders(now: Date = new Date()): Promise<{ sent: number }> {
  let sent = 0;
  const rows = await db
    .select({
      id: engagements.id,
      ownerId: engagements.ownerId,
      content: engagements.content,
      metadata: engagements.metadata,
    })
    .from(engagements)
    .where(
      and(
        eq(engagements.status, "signed"),
        sql`${engagements.metadata}->>'billingPlan' = 'annual'`,
        sql`${engagements.metadata}->>'termEndsAt' IS NOT NULL`,
        sql`${engagements.metadata}->'termEndReminderAt' IS NULL`,
        sql`${engagements.metadata}->'terminatedAt' IS NULL`
      )
    );

  for (const row of rows) {
    try {
      if (drsAnnualAutoRenews(row.content)) continue;
      const meta = (row.metadata ?? {}) as EngagementMeta;
      const end = new Date(meta.termEndsAt ?? "");
      if (isNaN(end.getTime())) continue;
      if (now.getTime() < end.getTime() - ANNUAL_TERM_END_NOTICE_DAYS * DAY_MS) continue;

      const stamp = now.toISOString();
      const claimed = await db
        .update(engagements)
        .set({
          metadata: sql`jsonb_set(COALESCE(${engagements.metadata}, '{}'::jsonb), '{termEndReminderAt}', to_jsonb(${stamp}::text), true)`,
        })
        .where(and(eq(engagements.id, row.id), sql`${engagements.metadata}->'termEndReminderAt' IS NULL`))
        .returning({ id: engagements.id });
      if (claimed.length === 0) continue;

      const signer = await getPrimaryClientSigner(row.id);
      const who = meta.clientCompany || signer?.name || "A client";
      const months = meta.termMonths && meta.termMonths > 0 ? meta.termMonths : TERM_MONTHS.annual;
      await createNotification({
        userId: row.ownerId,
        type: "annual_term_ending",
        title: "Annual term ending — no automatic renewal",
        message: `${who}'s ${months}-month annual term ends ${fmtDay(new Date(end.getTime() - DAY_MS))}. Their plan doesn't renew automatically: get their written agreement to continue (monthly, or another prepaid year) before then, or the engagement ends and nothing more is billed.`,
        metadata: { engagementId: row.id, termEndsAt: meta.termEndsAt },
      });
      sent++;
    } catch (err) {
      console.error("DRS: annual term-end reminder failed:", err);
    }
  }
  return { sent };
}

// ── Nov 19 2026 pricing: prepaid term rolls over (daily cron) ──

/** Marcel is told this many days before a prepaid Initial Term ends. */
export const AGENCY_PREPAID_NOTICE_DAYS = 30;

/**
 * A client who prepaid the six months has no monthly invoice yet. Their
 * letter renews automatically (Section 4(d)) and bills each renewal term at
 * the monthly Agency Fee (2(b)), so:
 *   - thirty days before the prepaid term ends, Marcel gets a bell + email
 *     (once, metadata.prepaidRenewalNoticeAt): the cancellation deadline is
 *     that day;
 *   - on the day the term rolls over, the first $10,000 Agency Fee of the
 *     renewal term is invoiced (recurring; paying it once starts autopay) —
 *     unless a non-renewal was recorded that ends the agreement by then.
 * Only when the prepayment itself was paid. Idempotent (one agency_monthly
 * invoice per engagement). Never throws per engagement.
 */
export async function runAgencyPrepaidRenewals(now: Date = new Date()): Promise<{ notified: number; invoiced: number }> {
  let notified = 0;
  let invoiced = 0;
  const rows = await db
    .select()
    .from(engagements)
    .where(
      and(
        eq(engagements.status, "signed"),
        sql`${engagements.metadata}->>'drsPricing' = 'performance'`,
        sql`${engagements.metadata}->>'termStartsAt' IS NOT NULL`
      )
    );

  for (const row of rows) {
    try {
      if (!isPerformanceEngagement(row)) continue;
      const terms = agencyTermsOf(row);
      if (terms.billing !== "prepay") continue;
      const meta = (row.metadata ?? {}) as EngagementMeta & { prepaidRenewalNoticeAt?: string };
      const start = new Date(meta.termStartsAt ?? "");
      if (isNaN(start.getTime())) continue;
      const initialEnd = addMonthsClampedUtc(start, terms.termMonths);
      const cancelEnd = meta.cancellation?.endsAt ? new Date(meta.cancellation.endsAt) : null;
      // A recorded non-renewal that ends the agreement at (or before) the prepaid term's end: nothing more is billed.
      if (cancelEnd && !isNaN(cancelEnd.getTime()) && cancelEnd.getTime() <= initialEnd.getTime()) continue;
      if (now.getTime() < initialEnd.getTime() - AGENCY_PREPAID_NOTICE_DAYS * DAY_MS) continue;

      const [prepay] = await db
        .select({ status: invoices.status })
        .from(invoices)
        .where(drsRoleCondition(row.id, ["agency_prepay"]))
        .orderBy(asc(invoices.createdAt))
        .limit(1);
      if (!prepay || prepay.status !== "paid") continue;

      const signer = await getPrimaryClientSigner(row.id);
      const who = meta.clientCompany || signer?.name || "A client";
      const fee = formatCurrency(terms.feeCents, "usd");

      if (now.getTime() < initialEnd.getTime()) {
        if (meta.prepaidRenewalNoticeAt) continue;
        const stamp = now.toISOString();
        const claimed = await db
          .update(engagements)
          .set({
            metadata: sql`jsonb_set(COALESCE(${engagements.metadata}, '{}'::jsonb), '{prepaidRenewalNoticeAt}', to_jsonb(${stamp}::text), true)`,
          })
          .where(and(eq(engagements.id, row.id), sql`${engagements.metadata}->'prepaidRenewalNoticeAt' IS NULL`))
          .returning({ id: engagements.id });
        if (claimed.length === 0) continue;
        await createNotification({
          userId: row.ownerId,
          type: "annual_term_ending",
          title: "Prepaid term ending — renews in 30 days",
          message: `${who}'s prepaid ${terms.termMonths} months end ${fmtDay(initialEnd)}. Their agreement renews for another ${terms.termMonths} months unless they give written notice by today, the ${AGENCY.CANCEL_NOTICE_DAYS}-day deadline. On ${fmtDay(initialEnd)} their first ${fee} monthly invoice goes out by itself. If they gave notice, record it on their Client Tracker page so nothing is sent.`,
          metadata: { engagementId: row.id, termEndsAt: initialEnd.toISOString() },
        });
        notified++;
        continue;
      }

      // The term has rolled over: the first monthly Agency Fee of the renewal term.
      if (!signer) continue;
      const created = await createDrsInvoices({
        engagement: row,
        signer,
        specs: [
          agencyMonthlySpec(
            terms,
            `Your six prepaid months have ended and your agreement has renewed for another ${terms.termMonths} months (Section 4(d) of your engagement letter). This is the first monthly Agency Fee of the renewal term. Pay once, by card or bank (ACH): your payment method is then charged automatically each month (autopay). Your advertising budget is not on this invoice: you pay the ad platform directly.`,
            "Monthly (renewal term)"
          ),
        ],
      });
      if (created.length) invoiced++;
    } catch (err) {
      console.error("DRS: prepaid renewal failed:", err);
    }
  }
  return { notified, invoiced };
}

// ── Status (admin onboarding view) ────────────────────────

export interface DrsBillingStatus {
  isDrs: boolean;
  plan: BillingPlan;
  /**
   * "performance" = the Nov 19 2026 pricing: `setup` is then the first
   * Agency Fee invoice (or the six-month prepayment), `firstMonthly` is null
   * (the monthly has been running since signing) and `billingStartedAt` is
   * the Launch the admin recorded at Build complete.
   */
  model: "setup" | "performance";
  /** Performance model only: how the Agency Fee is paid, and its amount (cents). */
  agency: { billing: "monthly" | "prepay"; feeCents: number } | null;
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
  /** Monthly autopay on the first monthly invoice (null = not set up). */
  autopay: { active: boolean; method: "ach" | "card" | null; status: string | null } | null;
}

const isoOrNull = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;

/** Where a DRS engagement is in the setup → build → first-monthly sequence. */
export async function getDrsBillingStatus(
  engagementId: string
): Promise<DrsBillingStatus> {
  const [engagement] = await db
    .select({ templateId: engagements.templateId, metadata: engagements.metadata, content: engagements.content })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);
  const plan = engagement ? planOf(engagement) : "monthly";
  const isDrs = engagement
    ? await isDigitalRainmakerEngagement(engagement.templateId)
    : false;
  if (!engagement || !isDrs) {
    return { isDrs: false, plan, model: "setup", agency: null, setup: null, firstMonthly: null, billingStartedAt: null, autopay: null };
  }
  const performance = isPerformanceEngagement(engagement);
  const agencyTerms = performance ? agencyTermsOf(engagement) : null;

  const cols = {
    invoiceId: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    status: invoices.status,
    total: invoices.total,
    paidAt: invoices.paidAt,
    createdAt: invoices.createdAt,
    metadata: invoices.metadata,
  };
  const [setup] = await db
    .select(cols)
    .from(invoices)
    .where(drsRoleCondition(engagementId, performance ? AGENCY_ROLES : SETUP_ROLES))
    .orderBy(asc(invoices.createdAt))
    .limit(1);
  // Performance model: there is no separate "first monthly at launch" invoice.
  const [first] = performance
    ? []
    : await db
        .select(cols)
        .from(invoices)
        .where(drsRoleCondition(engagementId, LAUNCH_ROLES))
        .orderBy(asc(invoices.createdAt))
        .limit(1);

  const meta = (engagement.metadata ?? {}) as EngagementMeta;
  return {
    isDrs: true,
    plan,
    model: performance ? "performance" : "setup",
    agency: agencyTerms ? { billing: agencyTerms.billing, feeCents: agencyTerms.feeCents } : null,
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
    // Performance model: autopay lives on the first Agency Fee invoice (a prepayment has none).
    autopay: autopayStatusOf(performance ? setup?.metadata : first?.metadata),
  };
}

function autopayStatusOf(metadata: unknown): DrsBillingStatus["autopay"] {
  const a = (metadata as { autopay?: Record<string, unknown> } | null)?.autopay;
  if (!a || typeof a !== "object" || typeof a.subscriptionId !== "string") return null;
  const status = typeof a.status === "string" ? a.status : null;
  return {
    active: status !== "canceled" && status !== "incomplete_expired",
    method: a.method === "card" || a.method === "ach" ? a.method : null,
    status,
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

    // Up-front invoice paid → the linked pipeline lead turns Won (DRS and Enterprise).
    try {
      await markLeadWonForPaidInvoice(invoiceId);
    } catch (err) {
      console.error("Pipeline Won update failed:", err);
    }

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

    // Nov 19 2026 pricing: the first Agency Fee (or the prepayment) opens
    // onboarding. Later months and renewal invoices carry the same role;
    // initOnboarding returns false for them, so nothing repeats.
    if (AGENCY_ROLES.includes(role)) {
      const opened = await initOnboarding(engagementId, "auto_sign", "drs");
      if (!opened) return;
      await sendOnboardingWelcomeEmails(engagementId);
      const what = role === "agency_prepay" ? "six-month prepayment" : "first month";
      try {
        await createNotification({
          userId: engagement.ownerId,
          type: "setup_paid",
          title: "First payment received — onboarding opened",
          message: `${invoice.clientName} paid the ${formatCurrency(invoice.total, invoice.currency)} ${what} invoice. Their Launch Pad is live.`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            engagementId,
            drsRole: role,
          },
        });
      } catch (err) {
        console.error("DRS: first-payment notification failed:", err);
      }
      return;
    }

    if (SETUP_ROLES.includes(role)) {
      const opened = await initOnboarding(engagementId, "auto_sign", "drs");
      if (!opened) return;
      await sendOnboardingWelcomeEmails(engagementId);
      const what = `${formatCurrency(invoice.total, invoice.currency)} ${role === "setup_annual" ? "annual" : "setup"}`;
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

      // Letters from Nov 16 2026 promise Nexli's first-month ad bonus (3(e)):
      // remind Marcel to fund it, since nothing bills it.
      const bonusCents = drsHasFirstMonthBonus(engagement.content) ? FIRST_MONTH_AD_BONUS_CENTS[planOf(engagement)] : 0;
      const bonus = bonusCents ? formatCurrency(bonusCents, "usd") : "";
      try {
        await createNotification({
          userId: engagement.ownerId,
          type: "monthly_paid",
          title: "First monthly paid — clear to launch ads",
          message: `${invoice.clientName} paid their first monthly invoice ${invoice.invoiceNumber} (${formatCurrency(invoice.total, invoice.currency)}). Clear to launch ads.${
            bonus ? ` Add Nexli's ${bonus} first-month ad bonus to their campaigns this month (Section 3(e) of their letter).` : ""
          }`,
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
          message: bonus
            ? `First monthly invoice paid — your ads are cleared to launch 🚀 Nexli adds your ${bonus} first-month ad bonus this month.`
            : "First monthly invoice paid — your ads are cleared to launch 🚀",
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
