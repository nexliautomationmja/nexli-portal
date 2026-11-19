// ─── Per-kind section presentation config ──────────────────
// Icon, accent, collapsed-by-default and the "In plain English" summary for
// each section heading. Summaries are convenience copy only — the verbatim
// clause text below each one is what the signer agrees to.

import { PATHS, type Accent } from "@/components/launch-pad";
import {
  AGENCY,
  DRS_PRICING,
  FIRST_MONTH_AD_BONUS_CENTS,
  TOTAL_MONTHLY_CENTS,
  TERM_MONTHS,
  LAUNCH_TARGET_DAYS,
  annualUpfrontCents,
  type BillingPlan,
} from "@/lib/drs-pricing";
import {
  ENTERPRISE,
  ENTERPRISE_TIERS,
  renewalCents,
  type EnterpriseTier,
} from "@/lib/enterprise-pricing";
import { performanceLetterTerms, type PerformanceLetterTerms } from "@/lib/drs-performance-letter";
import { LETTER_ICONS as X } from "./icons";
import { usd } from "./parse";

export type LetterKind = "drs" | "enterprise" | "foundation";

export interface SummaryContext {
  plan: BillingPlan;
  tier: EnterpriseTier;
  /** DRS: the letter's own Setup Fee in cents ($40,000 now, $32,000 original). */
  setupCents: number;
  /** DRS: the letter promises the first-month ad bonus (Section 3(e), Nov 16 2026 on). */
  bonus: boolean;
  /** DRS on the Nov 19 2026 pricing: the letter's own fee, percentage and billing. */
  agency?: PerformanceLetterTerms;
}

export interface SectionMeta {
  icon: React.ReactNode;
  accent: Accent;
  collapsed?: boolean;
  /** Special body layout; default is the generic clause list. */
  body?: "scope" | "fee";
  summary?: (ctx: SummaryContext) => string;
}

// ─── Digital Rainmaker System ──────────────────────────────

const upkeep = usd(DRS_PRICING.MONTHLY_CENTS);
const adBudget = usd(DRS_PRICING.AD_SPEND_MONTHLY_CENTS);
const totalMonthly = usd(TOTAL_MONTHLY_CENTS);
const annualPrepaid = usd(DRS_PRICING.ANNUAL_CENTS);

/**
 * Display figures for one letter (its Setup Fee decides the up-front
 * amounts), shared with the DRS at-a-glance card and the preview.
 */
export function drsFigures(setupCents: number = DRS_PRICING.SETUP_FEE_CENTS) {
  return {
    setup: usd(setupCents),
    upkeep,
    adBudget,
    totalMonthly,
    annualPrepaid,
    annualUpfront: usd(annualUpfrontCents(setupCents)),
    bonus: { monthly: usd(FIRST_MONTH_AD_BONUS_CENTS.monthly), annual: usd(FIRST_MONTH_AD_BONUS_CENTS.annual) },
  };
}

export const DRS_SECTION_META: Record<string, SectionMeta> = {
  "SCOPE OF SERVICES": {
    icon: PATHS.rocket,
    accent: "blue",
    body: "scope",
    summary: () =>
      `Nexli builds your complete system once (Phase 1, covered by the Setup Fee) — website, funnel, client portal, CRM, automations, launch ad creative and ad engineering — and launches it within ${LAUNCH_TARGET_DAYS} days of receiving your materials. After launch, Nexli maintains, supports and runs it all every month (Phase 2). Launch is the day the build is done and your first monthly invoice goes out; ads go live once it's paid. Hosting isn't part of Nexli's fees: you keep your own hosting provider.`,
  },
  "FEE STRUCTURE": {
    icon: PATHS.circleDollar,
    accent: "emerald",
    body: "fee",
    summary: ({ plan, setupCents }) => {
      const { setup, annualUpfront } = drsFigures(setupCents);
      return plan === "annual"
        ? `${annualUpfront} is due at signing on one invoice (${setup} one-time Setup Fee + ${annualPrepaid} for twelve months of platform operation from launch). Separately, the ${adBudget}/month ad budget is billed monthly from launch, when Nexli finishes the build, through the end of those 12 months; ads go live once the first invoice is paid, and later months are charged automatically. Initial term: ${TERM_MONTHS.annual} months from launch. The annual plan does not renew automatically: nothing more is charged after the 12 months unless you agree in writing to continue.`
        : `A one-time ${setup} Setup Fee is due at signing. Then ${totalMonthly}/month (${upkeep} platform + ${adBudget} ad budget) on one invoice, starting at launch, when Nexli finishes the build; ads and ongoing services start once that first monthly invoice is paid, and each month after is charged automatically. Initial term: ${TERM_MONTHS.monthly} months from launch, then month-to-month.`;
    },
  },
  "AD MANAGEMENT": {
    icon: X.megaphone,
    accent: "violet",
    summary: ({ plan, bonus }) =>
      bonus
        ? `Running your ads is included. Your ${adBudget}/month ad budget is held in a separate ad-funds account and goes into your own campaigns on Meta, Google, etc. at no markup; unspent budget rolls forward while you're a client. In your first month of ads, Nexli ${
            plan === "annual"
              ? `adds ${usd(FIRST_MONTH_AD_BONUS_CENTS.annual)} in ad credits`
              : `matches your budget with ${usd(FIRST_MONTH_AD_BONUS_CENTS.monthly)} of its own`
          } on top of yours — a bonus with no cash value that can't be withdrawn, refunded or credited against fees, and doesn't carry into later months. When your service ends, any budget still unspent (bonus included) is forfeited, not refunded. Nexli takes no revenue share, bonus or performance fee — every dollar of revenue the ads produce is yours.`
        : `Running your ads is included. Your ${adBudget}/month ad budget goes to Meta, Google, etc. at no markup; any unspent budget rolls forward to later months (it isn't refunded). Nexli takes no revenue share, bonus or performance fee — every dollar of revenue the ads produce is yours.`,
  },
  "PAYMENT TERMS": {
    icon: X.creditCard,
    accent: "cyan",
    summary: ({ plan, setupCents }) => {
      const { setup, annualUpfront } = drsFigures(setupCents);
      return `The ${plan === "annual" ? `${annualUpfront} up-front invoice` : `${setup} setup invoice`} is paid by bank transfer (ACH or wire) straight to Nexli's bank account, using the details on the invoice; cards aren't accepted for it.${plan === "annual" ? " Any further prepaid year you agree to is paid the same way." : ""} It is non-refundable, and by signing you waive the right to dispute or reverse ${plan === "annual" ? `any of the ${annualUpfront}` : "the Setup Fee"} with your bank. Monthly invoices after launch can be paid by ACH or card at the same price: you pay the first one once and later months are charged automatically. Fees are non-refundable, except that a duplicate or mistaken charge is refunded in full. The agreement takes effect, work starts and your Launch Pad opens once ${plan === "annual" ? `the ${annualUpfront} invoice due at signing is` : `the ${setup} Setup Fee invoice is`} paid. Your ${TERM_MONTHS[plan]}-month initial term runs from launch. You can give 30 days' written notice any time, but it takes effect no earlier than the end of the initial term; ${plan === "annual" ? "the annual plan then ends — it does not renew automatically unless you agree in writing to continue" : "after that the agreement continues month-to-month until either side gives 30 days' notice"}.`;
    },
  },
  "PROJECT TIMELINE & CLIENT COOPERATION": {
    icon: X.calendar,
    accent: "amber",
    summary: () =>
      `Submit your Launch Pad items within 5 days of getting the link. Launch is targeted ${LAUNCH_TARGET_DAYS} days after Nexli has everything, and setup wraps within 30 days of the agreement's effective date (the day your up-front payment arrives). Third-party reviews — the carriers' review of your texting registration, the ad platforms' review of your ad accounts — move these dates by however long they take. If required access or materials aren't provided in the 30-day window, setup is treated as complete and launch can go ahead.`,
  },
  "INTELLECTUAL PROPERTY": {
    icon: X.shield,
    accent: "violet",
    summary: () =>
      "Your website, domain, content, brand, ad accounts, the ad creatives made for you and all your data are yours. Nexli builds your own portal, dashboard and automations on its platform, and your monthly upkeep keeps them running; Nexli's underlying software and templates stay Nexli's. When the agreement ends, the upkeep stops after your last paid month, and your portal, dashboard and automations stop with it. Within 30 days you can get an export of your data and a full copy of your website to host anywhere. Nexli may show your website in its portfolio unless you opt out.",
  },
  "ADDITIONAL SERVICES": {
    icon: X.plusCircle,
    accent: "blue",
    summary: () =>
      "Anything beyond the Section 1 scope — major redesigns, new features, custom development — is quoted separately under its own written agreement.",
  },
  "LIMITATION OF LIABILITY": {
    icon: X.scale,
    accent: "amber",
    summary: () =>
      "Nexli's liability is capped at the fees you paid in the prior 12 months and excludes indirect losses. Results (leads, revenue, ROI) are not guaranteed, and outages at third parties like Stripe, your hosting provider or DNS providers aren't Nexli's liability.",
  },
  INDEMNIFICATION: {
    icon: X.shield,
    accent: "cyan",
    collapsed: true,
    summary: () =>
      "If a claim arises from your use of the system, a legal violation on your side, or materials you provided, you cover Nexli's resulting costs.",
  },
  CONFIDENTIALITY: {
    icon: PATHS.lock,
    accent: "emerald",
    summary: () =>
      "Both sides keep each other's proprietary information confidential, including after the agreement ends. Your data, including your clients' documents and tax information, belongs to you: Nexli uses it only to run your system, never sells it or uses it for its own marketing, protects it with reasonable safeguards, tells you within 72 hours of confirming any unauthorized access, and deletes it after the 30-day export window (unless the law requires keeping it).",
  },
  TERMINATION: {
    icon: X.logOut,
    accent: "amber",
    summary: () =>
      "Either side can end the agreement with 30 days' written notice (email to mail@nexli.net works), effective no earlier than the end of the initial term. Nexli can suspend or end access for non-payment, breach or misuse. Access runs through your last paid billing cycle; then the end-of-agreement terms in Section 6 apply — your data export and website copy within 30 days.",
  },
  "DISPUTE RESOLUTION": {
    icon: X.gavel,
    accent: "violet",
    summary: () =>
      "Disputes go to binding arbitration in Florida under the American Arbitration Association's Commercial Arbitration Rules, and the award can be enforced in court. Each side pays its own costs and attorneys' fees, except that a client who wrongly disputes the non-refundable up-front payment also owes the collection costs (Section 2(a)). Either side may still go to court to protect its intellectual property or confidential information.",
  },
  "GOVERNING LAW": {
    icon: X.landmark,
    accent: "blue",
    collapsed: true,
    summary: () => "Florida law governs this agreement.",
  },
  "ENTIRE AGREEMENT": {
    icon: X.fileText,
    accent: "cyan",
    collapsed: true,
    summary: () =>
      "This document is the whole deal: it replaces anything discussed before, and changes must be in writing signed by both sides.",
  },
  "ELECTRONIC SIGNATURES": {
    icon: X.penLine,
    accent: "emerald",
    collapsed: true,
    summary: () =>
      "Signing electronically is legally binding, under the federal ESIGN Act and UETA.",
  },
};

// ─── Digital Rainmaker System, Nov 19 2026 pricing ─────────
// Agency Fee + Performance Pay, no setup fee (lib/drs-performance-letter.ts).
// Same section headings as the previous letter except Section 3; every
// figure comes from the letter itself (ctx.agency).

const agencyOf = (ctx: SummaryContext): PerformanceLetterTerms => ctx.agency ?? performanceLetterTerms(null);

/** Display figures for one performance letter, shared with its at-a-glance card. */
export function agencyFigures(t: PerformanceLetterTerms) {
  const breakEvenCents = Math.round((t.feeCents * 100) / t.percent);
  return {
    fee: usd(t.feeCents),
    prepay: t.prepayCents ? usd(t.prepayCents) : null,
    saving: t.prepayCents ? usd(Math.max(0, t.feeCents * t.termMonths - t.prepayCents)) : null,
    percent: `${t.percent}%`,
    term: t.termMonths,
    minBudget: usd(AGENCY.MIN_AD_BUDGET_CENTS),
    /** Net attributed revenue up to which no performance pay is owed. */
    breakEven: usd(breakEvenCents),
    notice: AGENCY.CANCEL_NOTICE_DAYS,
  };
}

export const DRS_PERFORMANCE_SECTION_META: Record<string, SectionMeta> = {
  "SCOPE OF SERVICES": {
    icon: PATHS.rocket,
    accent: "blue",
    body: "scope",
    summary: (ctx) => {
      const f = agencyFigures(agencyOf(ctx));
      return `Nexli builds your complete system — website, funnel, client portal, CRM, automations, launch ad creative and ad engineering — and then maintains, supports and runs it all every month. Both are covered by ${f.prepay ? `your ${f.prepay} six-month prepayment` : `the ${f.fee} monthly agency fee`}: there is no setup fee. The build takes about ${LAUNCH_TARGET_DAYS} days from kickoff, and launch is the day it's done and your ads go live. Billing and your ${f.term}-month term start at signing, so the build runs inside your first month. Hosting isn't part of Nexli's fees: you keep your own hosting provider.`;
    },
  },
  "FEE STRUCTURE": {
    icon: PATHS.circleDollar,
    accent: "emerald",
    body: "fee",
    summary: (ctx) => {
      const f = agencyFigures(agencyOf(ctx));
      const fee = f.prepay
        ? `${f.prepay} is due at signing and covers your first ${f.term} months, in place of ${f.term} monthly fees of ${f.fee} (you save ${f.saving}). Later terms are billed ${f.fee} a month on autopay unless you prepay again.`
        : `${f.fee} a month. The first ${f.fee} is due at signing, and each month after is charged automatically.`;
      return `${fee} On top of that comes ${f.percent} performance pay (Section 3): ${f.prepay ? `each prepaid month counts as ${f.fee} toward it` : `your ${f.fee} for the month counts toward it`}, so you're only invoiced the difference. Your ad budget, at least ${f.minBudget} a month, isn't paid to Nexli: you pay the ad platform directly on your own card, within the budget you approve. Initial term: ${f.term} months from signing, renewing ${f.term} months at a time.`;
    },
  },
  "PERFORMANCE PAY": {
    icon: X.megaphone,
    accent: "violet",
    summary: (ctx) => {
      const t = agencyOf(ctx);
      const f = agencyFigures(t);
      const exampleNet = 12_000_000;
      const total = Math.round((exampleNet * t.percent) / 100);
      const extra = Math.max(0, total - t.feeCents);
      return `Each month, Nexli's pay is the greater of your ${f.fee} agency fee or ${f.percent} of your net attributed revenue. Net attributed revenue is the money you actually collected that month from clients who first came to you through the ads and funnel Nexli runs, minus that month's ad spend. It is never a share of your firm's total revenue. Your ${f.fee} for the month is credited, so only the difference is invoiced: at ${usd(exampleNet)} net the total is ${usd(total)} and the extra invoice is ${usd(extra)}; at ${f.breakEven} or less there is nothing extra. Each month stands on its own. You bill those clients through your portal so the numbers are on record, and each month you get a statement listing them, with ${AGENCY.DISPUTE_DAYS} days to question a line. Your last month still gets its statement after the agreement ends; nothing is owed on money you collect after that.`;
    },
  },
  "PAYMENT TERMS": {
    icon: X.creditCard,
    accent: "cyan",
    summary: (ctx) => {
      const f = agencyFigures(agencyOf(ctx));
      return `Every charge can be paid by card, ACH or wire at the same price; the monthly fee runs on autopay after the first payment. Fees are non-refundable, except that a duplicate or mistaken charge is refunded in full, and by signing you agree not to dispute a properly charged fee with your bank or card issuer. The agreement takes effect, work starts and your Launch Pad opens once ${f.prepay ? `the ${f.prepay} prepayment` : `the first ${f.fee}`} is paid. Your ${f.term}-month term counts from the day you sign and renews ${f.term} months at a time. To stop a renewal, give written notice at least ${f.notice} days before the term ends; later notice ends the agreement a term later. The fees and performance pay for a term stay payable through its end.`;
    },
  },
  "PROJECT TIMELINE & CLIENT COOPERATION": {
    icon: X.calendar,
    accent: "amber",
    summary: () =>
      `Work starts with a kickoff call once your first payment arrives. Submit your Launch Pad items within 5 days of getting the link, including access to your ad account with a card on it. Launch is targeted ${LAUNCH_TARGET_DAYS} days after Nexli has everything, and the build wraps within 30 days. Third-party reviews — the carriers' review of your texting registration, the ad platforms' review of your ad accounts — move these dates by however long they take. Billing and your term don't wait for launch. If required access or materials aren't provided in the 30-day window, the build is treated as complete.`,
  },
  "INTELLECTUAL PROPERTY": {
    icon: X.shield,
    accent: "violet",
    summary: () =>
      "What Nexli builds for you is yours: your website, client portal and dashboard, funnel and automations, plus your domain, content, brand, ad accounts and all your data. The ad videos and images Nexli makes stay Nexli's; you can run them in your campaigns while you're a client. Your portal and automations run on Nexli's platform, and Nexli's underlying software and templates stay Nexli's. When the agreement ends, Nexli's upkeep stops and your portal, dashboard and automations stop with it. Within 30 days you can get an export of your data and a full copy of your website to host anywhere. Nexli may show your website in its portfolio unless you opt out.",
  },
  "ADDITIONAL SERVICES": DRS_SECTION_META["ADDITIONAL SERVICES"],
  "LIMITATION OF LIABILITY": {
    icon: X.scale,
    accent: "amber",
    summary: () =>
      "Nexli's liability is capped at the fees you paid in the prior 12 months and excludes indirect losses. Results (leads, revenue, ROI) are not guaranteed: performance pay is how Nexli's fee is worked out, not a promise of results. Outages at third parties like Stripe, the ad platforms, your hosting provider or DNS providers aren't Nexli's liability.",
  },
  INDEMNIFICATION: DRS_SECTION_META.INDEMNIFICATION,
  CONFIDENTIALITY: {
    icon: PATHS.lock,
    accent: "emerald",
    summary: () =>
      "Both sides keep each other's proprietary information confidential, including after the agreement ends. Your data, including your clients' documents and tax information, belongs to you: Nexli uses it only to run your system and prepare your monthly statements, never sells it or uses it for its own marketing, protects it with reasonable safeguards, tells you within 72 hours of confirming any unauthorized access, and deletes it after the 30-day export window (unless the law requires keeping it).",
  },
  TERMINATION: {
    icon: X.logOut,
    accent: "amber",
    summary: (ctx) => {
      const f = agencyFigures(agencyOf(ctx));
      return `Either side can end the agreement by written notice of non-renewal (email to mail@nexli.net works). It ends at the end of the current ${f.term}-month term if the notice comes at least ${f.notice} days before that, otherwise at the end of the next term. Nexli can suspend or end access for non-payment, breach or misuse. When it ends, the end-of-agreement terms in Section 6 apply (your data export and website copy within 30 days), and your last month's performance pay is still invoiced.`;
    },
  },
  "DISPUTE RESOLUTION": {
    icon: X.gavel,
    accent: "violet",
    summary: () =>
      "Disputes go to binding arbitration in Florida under the American Arbitration Association's Commercial Arbitration Rules, and the award can be enforced in court. Each side pays its own costs and attorneys' fees, except that a client who wrongly disputes a properly charged fee also owes the collection costs (Section 4(b)). Either side may still go to court to protect its intellectual property or confidential information.",
  },
  "GOVERNING LAW": DRS_SECTION_META["GOVERNING LAW"],
  "ENTIRE AGREEMENT": DRS_SECTION_META["ENTIRE AGREEMENT"],
  "ELECTRONIC SIGNATURES": DRS_SECTION_META["ELECTRONIC SIGNATURES"],
};

// ─── Nexli Enterprise License ──────────────────────────────

const E = ENTERPRISE;

function tierFee(tier: EnterpriseTier): string {
  return usd(ENTERPRISE_TIERS[tier].priceCents);
}

export const ENTERPRISE_SECTION_META: Record<string, SectionMeta> = {
  "THE LICENSED SYSTEM": {
    icon: PATHS.rocket,
    accent: "blue",
    summary: () =>
      "Nexli licenses and installs its own internal operating system in your firm: talent acquisition, the Facebook ad acquisition model, AI creative generation (ChatGPT) and editing (Kling AI), AI for profitability, and its scaling SOPs. Exactly which materials are included is listed in Schedule A, delivered at kickoff.",
  },
  "IMPLEMENTATION PROGRAM": {
    icon: X.calendar,
    accent: "violet",
    summary: () =>
      `${E.IMPLEMENTATION_MONTHS} months of hands-on implementation: a ${E.INTENSIVE_DAYS}-day intensive (a ${E.KICKOFF_ONSITE_DAYS}-day on-site kickoff week, then a ${E.MONTHLY_VISIT_DAYS}-day on-site visit in each of the next two months), weekly remote handoff sessions through month ${E.IMPLEMENTATION_MONTHS}, then license support through month ${E.LICENSE_MONTHS}. Kickoff is scheduled within ${E.KICKOFF_SCHEDULING_BUSINESS_DAYS} business days after your fee clears; travel for the Phase 1 visits is included.`,
  },
  FEES: {
    icon: PATHS.circleDollar,
    accent: "emerald",
    body: "fee",
    summary: ({ tier }) =>
      `The ${ENTERPRISE_TIERS[tier].label} license is ${tierFee(tier)}, covering the ${E.IMPLEMENTATION_MONTHS}-month implementation and the first ${E.LICENSE_MONTHS}-month license term. After that you can renew for ${usd(renewalCents(tier))}/year (${E.RENEWAL_PERCENT}% of the fee). There are no setup fees; ad spend, payroll for new hires and your own software stay your costs.${
        ENTERPRISE_TIERS[tier].includesAds
          ? " At this tier Nexli also runs your advertising for the license year (ad spend is paid directly to the ad platforms)."
          : ""
      }`,
  },
  PAYMENT: {
    icon: X.creditCard,
    accent: "cyan",
    summary: ({ tier }) =>
      `The full ${tierFee(tier)} is due at signing, by ACH or wire only — no cards (a business check counts once it clears). The agreement doesn't take effect and nothing is scheduled until the funds clear, and once cleared the fee is non-refundable.`,
  },
  "LICENSE GRANT AND RESTRICTIONS": {
    icon: X.shield,
    accent: "violet",
    summary: () =>
      `You may use the Licensed Materials inside your own firm for ${E.LICENSE_MONTHS} months from kickoff (longer if you renew). You may not resell, share, teach or consult on them, or build a competing product. Nexli owns the system; your client data, hires, ad accounts and campaigns are yours. If you don't renew, you keep internal use of what was delivered, without updates or support.`,
  },
  "CLIENT OBLIGATIONS": {
    icon: PATHS.idCard,
    accent: "amber",
    summary: () =>
      "Name an executive sponsor who can make hiring, ad and operating decisions; make your team available for the on-site visits and weekly sessions; fund the hires, ad spend and software the system calls for; and provide access, brand assets and on-site workspace. Delays on your side extend the schedule day-for-day.",
  },
  "CONFIDENTIALITY AND NON-SOLICITATION": {
    icon: PATHS.lock,
    accent: "emerald",
    summary: () =>
      `Both sides keep each other's proprietary information confidential, and the Licensed Materials are Nexli's confidential information. During the license and for ${E.NON_SOLICIT_MONTHS} months after, you won't recruit Nexli employees or contractors you met through this engagement.`,
  },
  "NO GUARANTEE OF RESULTS": {
    icon: X.scale,
    accent: "amber",
    summary: () =>
      "Nexli implements the system with professional care and trains your team to run it, but doesn't guarantee revenue, hiring outcomes, ad performance or ROI — results depend on your market, your team and your execution.",
  },
  "LIMITATION OF LIABILITY": {
    icon: X.scale,
    accent: "amber",
    collapsed: true,
    summary: () =>
      "Nexli's liability is capped at the fees you paid in the prior 12 months and excludes indirect losses. Third-party platforms such as Meta, Google, OpenAI, Kling AI and Stripe aren't Nexli's liability.",
  },
  INDEMNIFICATION: {
    icon: X.shield,
    accent: "cyan",
    collapsed: true,
    summary: () =>
      "If a claim arises from your use of the system, your hiring, advertising or business decisions, a legal violation on your side, or materials you provided, you cover Nexli's resulting costs.",
  },
  TERMINATION: {
    icon: X.logOut,
    accent: "amber",
    summary: () =>
      "Nexli can end the license immediately if you breach the license restrictions or confidentiality terms, or don't pay. You can end it if Nexli materially breaches and doesn't fix it within 30 days of your written notice. If it ends for your breach, you must stop using the materials. The fee stays non-refundable either way.",
  },
  "DISPUTE RESOLUTION": {
    icon: X.gavel,
    accent: "violet",
    collapsed: true,
    summary: () =>
      "Disputes go to binding arbitration in Florida under American Arbitration Association rules; each side pays its own costs and attorneys' fees.",
  },
  "GOVERNING LAW": {
    icon: X.landmark,
    accent: "blue",
    collapsed: true,
    summary: () => "Florida law governs this agreement.",
  },
  "ENTIRE AGREEMENT": {
    icon: X.fileText,
    accent: "cyan",
    collapsed: true,
    summary: () =>
      "This document and Schedule A are the whole deal: they replace anything discussed before, and changes must be in writing signed by both sides.",
  },
  "ELECTRONIC SIGNATURES": {
    icon: X.penLine,
    accent: "emerald",
    collapsed: true,
    summary: () =>
      "Signing electronically is legally binding, under the federal ESIGN Act and UETA.",
  },
};

// ─── Firm Foundation (icons only — no summaries) ───────────
// Without a summary a section is never collapsed (see EngagementLetterView).

export const FOUNDATION_SECTION_META: Record<string, SectionMeta> = {
  "SCOPE OF SERVICES": { icon: PATHS.rocket, accent: "blue" },
  "FEE STRUCTURE": { icon: PATHS.circleDollar, accent: "emerald", body: "fee" },
  "PAYMENT TERMS": { icon: X.creditCard, accent: "cyan" },
  "TIMELINE & CLIENT COOPERATION": { icon: X.calendar, accent: "amber" },
  "INTELLECTUAL PROPERTY": { icon: X.shield, accent: "violet" },
  "UPGRADE CREDIT": { icon: X.plusCircle, accent: "blue" },
  "LIMITATION OF LIABILITY": { icon: X.scale, accent: "amber" },
  INDEMNIFICATION: { icon: X.shield, accent: "cyan" },
  CONFIDENTIALITY: { icon: PATHS.lock, accent: "emerald" },
  TERMINATION: { icon: X.logOut, accent: "amber" },
  "DISPUTE RESOLUTION": { icon: X.gavel, accent: "violet" },
  "GOVERNING LAW": { icon: X.landmark, accent: "blue" },
  "ENTIRE AGREEMENT": { icon: X.fileText, accent: "cyan" },
  "ELECTRONIC SIGNATURES": { icon: X.penLine, accent: "emerald" },
};

export const SECTION_META_BY_KIND: Record<LetterKind, Record<string, SectionMeta>> = {
  drs: DRS_SECTION_META,
  enterprise: ENTERPRISE_SECTION_META,
  foundation: FOUNDATION_SECTION_META,
};

export const FALLBACK_META: SectionMeta = {
  icon: X.fileText,
  accent: "blue",
};
