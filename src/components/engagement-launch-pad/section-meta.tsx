// ─── Per-kind section presentation config ──────────────────
// Icon, accent, collapsed-by-default and the "In plain English" summary for
// each section heading. Summaries are convenience copy only — the verbatim
// clause text below each one is what the signer agrees to.

import { PATHS, type Accent } from "@/components/launch-pad";
import {
  DRS_PRICING,
  TOTAL_MONTHLY_CENTS,
  ANNUAL_UPFRONT_CENTS,
  TERM_MONTHS,
  LAUNCH_TARGET_DAYS,
  type BillingPlan,
} from "@/lib/drs-pricing";
import {
  ENTERPRISE,
  ENTERPRISE_TIERS,
  renewalCents,
  type EnterpriseTier,
} from "@/lib/enterprise-pricing";
import { LETTER_ICONS as X } from "./icons";
import { usd } from "./parse";

export type LetterKind = "drs" | "enterprise" | "foundation";

export interface SummaryContext {
  plan: BillingPlan;
  tier: EnterpriseTier;
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

const setup = usd(DRS_PRICING.SETUP_FEE_CENTS);
const upkeep = usd(DRS_PRICING.MONTHLY_CENTS);
const adBudget = usd(DRS_PRICING.AD_SPEND_MONTHLY_CENTS);
const totalMonthly = usd(TOTAL_MONTHLY_CENTS);
const annualPrepaid = usd(DRS_PRICING.ANNUAL_CENTS);
const annualUpfront = usd(ANNUAL_UPFRONT_CENTS);

/** Display figures shared with the DRS at-a-glance card. */
export const DRS_FIGURES = { setup, upkeep, adBudget, totalMonthly, annualPrepaid, annualUpfront };

export const DRS_SECTION_META: Record<string, SectionMeta> = {
  "SCOPE OF SERVICES": {
    icon: PATHS.rocket,
    accent: "blue",
    body: "scope",
    summary: () =>
      `Nexli builds your complete system once (Phase 1, covered by the Setup Fee) — website, funnel, client portal, CRM, automations, launch ad creative and ad engineering — and launches it within ${LAUNCH_TARGET_DAYS} days of receiving your materials. After launch, Nexli hosts, maintains and runs it all every month (Phase 2).`,
  },
  "FEE STRUCTURE": {
    icon: PATHS.circleDollar,
    accent: "emerald",
    body: "fee",
    summary: ({ plan }) =>
      plan === "annual"
        ? `${annualUpfront} is due at signing on one invoice (${setup} one-time Setup Fee + ${annualPrepaid} for a prepaid year of platform operation). Separately, the ${adBudget}/month ad budget is billed monthly starting at launch, when Nexli finishes the build; ads go live once that first invoice is paid. Initial term: ${TERM_MONTHS.annual} months; the platform then renews at ${annualPrepaid}/yr, invoiced 30 days before each anniversary.`
        : `A one-time ${setup} Setup Fee is due at signing. Then ${totalMonthly}/month (${upkeep} platform + ${adBudget} ad budget) on one invoice, starting at launch, when Nexli finishes the build; ads and ongoing services start once that first monthly invoice is paid. Initial term: ${TERM_MONTHS.monthly} months.`,
  },
  "AD MANAGEMENT": {
    icon: X.megaphone,
    accent: "violet",
    summary: () =>
      `Running your ads is included. Your ${adBudget}/month ad budget goes to Meta, Google, etc. at no markup; any unspent budget rolls forward to later months (it isn't refunded). Nexli takes no revenue share, bonus or performance fee — every dollar of revenue the ads produce is yours.`,
  },
  "PAYMENT TERMS": {
    icon: X.creditCard,
    accent: "cyan",
    summary: ({ plan }) =>
      `The ${plan === "annual" ? `${annualUpfront} up-front invoice` : `${setup} setup invoice`} can be paid by bank transfer (ACH) or credit/debit card, at the same price. It is non-refundable, and by signing you waive the right to dispute or charge back ${plan === "annual" ? `any of the ${annualUpfront}` : "the Setup Fee"} with your bank or card issuer. Monthly invoices after launch can be paid by ACH or card too and run on autopay. Fees are non-refundable. Work starts, and your Launch Pad opens, once ${plan === "annual" ? `the ${annualUpfront} invoice due at signing is` : `the ${setup} Setup Fee invoice is`} paid. The first monthly invoice goes out at launch, when the build is complete. You can give 30 days' notice any time, but it takes effect no earlier than the end of the ${TERM_MONTHS[plan]}-month initial term; after that the agreement ${plan === "annual" ? "renews annually" : "continues month-to-month"}.`,
  },
  "PROJECT TIMELINE & CLIENT COOPERATION": {
    icon: X.calendar,
    accent: "amber",
    summary: () =>
      `Submit your Launch Pad items within 5 days of getting the link. Launch is targeted ${LAUNCH_TARGET_DAYS} days after Nexli has everything, and setup wraps within 30 days of the agreement's effective date. If required access or materials aren't provided in that 30-day window, setup is treated as complete.`,
  },
  "INTELLECTUAL PROPERTY": {
    icon: X.shield,
    accent: "violet",
    summary: () =>
      "Your website content, brand assets and domain stay yours. Nexli's software, automations and dashboard stay Nexli's — you get a license to use them while your subscription is active, and may not copy or resell them.",
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
    collapsed: true,
    summary: () =>
      "Nexli's liability is capped at the fees you paid in the prior 12 months and excludes indirect losses. Results (leads, revenue, ROI) are not guaranteed, and outages at third parties like Stripe or DNS providers aren't Nexli's liability.",
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
    collapsed: true,
    summary: () =>
      "Both sides keep each other's proprietary information confidential — including after the agreement ends.",
  },
  TERMINATION: {
    icon: X.logOut,
    accent: "amber",
    summary: () =>
      "Either side can end the agreement with 30 days' written notice, effective no earlier than the end of the initial term. Nexli can suspend access for non-payment or misuse. You keep your website and content; access to Nexli's systems ends.",
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
