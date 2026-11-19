/**
 * Digital Rainmaker System pricing — single source of truth.
 *
 * Client-safe: no server-only imports, so these constants can be used from
 * both API routes and client components (compose UI, invoice pay page).
 *
 * Nov 19 2026 (Marcel; nexli.net commit d149283, "One monthly fee. No setup
 * fee."): the NEW pricing is AGENCY below — a $10,000 monthly agency fee
 * billed from signing (or $50,000 for the six months up front), 10%
 * performance pay on net attributed revenue with the month's fee credited
 * against it, and an ad budget the client pays straight to the platform.
 * Its letter is lib/drs-performance-letter.ts. Everything else in this file
 * down to PIPELINE is the PREVIOUS pricing (setup fee + $9,997/month), which
 * stays available on the composer's back tab and keeps billing the letters
 * already signed on it.
 *
 * Nov 16 2026: the Setup Fee is $40,000 ($82,000 at signing on annual); the
 * original $32,000 / $74,000 pricing stays available per letter
 * (DRS_SETUP_FEES), and every letter from then on carries the first-month ad
 * bonus (FIRST_MONTH_AD_BONUS_CENTS).
 *
 * Oct 18 2026: a one-time $32,000 SETUP FEE covers the Phase 1 implementation
 * (itemized in SETUP_SCOPE and Section 1 of the letter — Marcel: "no gray
 * area"), then $9,997/mo = $4,997 platform upkeep + $5,000 Managed
 * Advertising Budget that Nexli collects and deploys on the ad platforms on
 * the client's behalf (pass-through, no markup — see AD_SPEND_MONTHLY_CENTS
 * and Section 3(b)). Annual option: setup fee + $42,000 prepaid platform +
 * the $5,000/mo ad budget. No ad-management tiers, no revenue share, no
 * performance fee, no bonus, no guarantees.
 *
 * Billing sequence (lib/digital-rainmaker.ts):
 *   1. Signing → the Setup Fee is invoiced ($32,000; annual clients get ONE
 *      $74,000 setup + annual platform invoice).
 *   2. That invoice is paid → onboarding (the Launch Pad) opens.
 *   3. Build complete → the first monthly invoice is sent ($9,997 = platform
 *      + ad budget on one invoice; annual clients: the $5,000 ad budget).
 *   4. That invoice is paid → services and ads start.
 *
 * Marcel's stance: clients keep all of the upside ("the cherry on top");
 * Nexli's upside is graduating them to the Enterprise tier
 * (enterprise-pricing.ts), not backend bonuses.
 *
 * Minimum term: 6 months on monthly, 12 on annual, counted from Launch —
 * ads need ~90 days to mature; the goal is retention, not lock-in. Since
 * Nov 9 2026 the annual plan does NOT renew automatically (letter 2(b),
 * 4(d)); the monthly plan continues month to month on autopay.
 */

export const DRS_PRICING = {
  SETUP_FEE_CENTS: 4_000_000, // $40,000.00 one-time (Nov 16 2026; was $32,000) — Phase 1 implementation (SETUP_SCOPE)
  MONTHLY_CENTS: 499_700, // $4,997.00 / month — platform upkeep of everything in Phase 1
  ANNUAL_CENTS: 4_200_000, // $42,000.00 / year prepaid platform upkeep (~30% off vs $59,964 at the monthly rate)
  AD_SPEND_MONTHLY_CENTS: 500_000, // $5,000.00 / month Managed Advertising Budget (pass-through)
} as const;

/**
 * Two setup-fee versions live side by side (Nov 16 2026, Marcel: "this will
 * be the new pricing and don't retire the old pricing"). "current" is the
 * $40,000 setup nexli.net now shows; "original" is the $32,000 setup every
 * letter before Nov 16 2026 carried. Everything else — upkeep, ad budget,
 * the $42,000 annual year, terms, the first-month bonus — is identical.
 * A letter's own Setup Fee line is what billing charges (setupFeeOfLetter).
 */
/** The two setup-fee versions of the previous pricing. */
export type DrsSetupPricing = "current" | "original";

/**
 * Which pricing a letter was composed with: "performance" is the Nov 19 2026
 * pricing (AGENCY: no setup fee, $10,000/month + 10% performance pay);
 * "current" / "original" are the previous pricing's two setup fees.
 */
export type DrsPricing = "performance" | DrsSetupPricing;

export const DRS_SETUP_FEES: Record<DrsSetupPricing, number> = {
  current: DRS_PRICING.SETUP_FEE_CENTS, // $40,000
  original: 3_200_000, // $32,000
};

// Shown beside each setup fee on the composer's "Previous pricing" tab.
export const DRS_PRICING_LABEL: Record<DrsSetupPricing, string> = {
  current: "Latest",
  original: "Original",
};

export function isDrsSetupPricing(v: unknown): v is DrsSetupPricing {
  return v === "current" || v === "original";
}

export function isDrsPricing(v: unknown): v is DrsPricing {
  return v === "performance" || isDrsSetupPricing(v);
}

// ── Nov 19 2026 pricing: agency fee + performance pay ────

/**
 * The pricing nexli.net shows from Nov 19 2026 ("One monthly fee. No setup
 * fee."). Decided by Marcel that day:
 *   - $10,000/month Agency Fee, the first one invoiced at signing; paying it
 *     opens the Launch Pad. Then monthly on autopay. Or the six months up
 *     front for $50,000 (each prepaid month still counts as $10,000 paid).
 *   - Performance Pay: 10% of Net Attributed Revenue for each billing month
 *     (what the firm collected from clients the ads brought in, minus that
 *     month's ad spend), with the month's Agency Fee credited against it —
 *     only the difference is invoiced. Each month stands alone.
 *   - The ad budget (at least $5,000/month) is paid by the client straight
 *     to the platform; Nexli never collects, holds or invoices it.
 *   - Initial Term six months FROM SIGNING, renewing six months at a time.
 *     Notice at least 30 days before a term ends stops the renewal; the last
 *     month still gets its Performance Pay; nothing accrues after the end.
 */
export const AGENCY = {
  FEE_MONTHLY_CENTS: 1_000_000, // $10,000.00 / month — the build and running all of it
  TERM_MONTHS: 6, // initial term and every renewal term
  PREPAY_CENTS: 5_000_000, // $50,000.00 for a six-month term paid up front
  PERFORMANCE_PERCENT: 10, // of Net Attributed Revenue
  MIN_AD_BUDGET_CENTS: 500_000, // $5,000.00 / month, paid by the client to the platform
  CANCEL_NOTICE_DAYS: 30, // notice this long before a term ends stops the renewal
  STATEMENT_DAYS: 10, // statement + invoice within this many days after each month
  PERFORMANCE_DUE_DAYS: 7, // a Performance Pay invoice is due this many days after its date
  DISPUTE_DAYS: 10, // a statement line can be disputed for this long
  RECORD_DAYS: 5, // business days to record an outside payment in the portal
} as const;

/** What six monthly fees cost less the prepayment: $10,000. */
export const AGENCY_PREPAY_SAVING_CENTS =
  AGENCY.FEE_MONTHLY_CENTS * AGENCY.TERM_MONTHS - AGENCY.PREPAY_CENTS;

/** How a new-pricing client pays the Agency Fee: month by month, or the term up front. */
export type AgencyBilling = "monthly" | "prepay";

export function isAgencyBilling(v: unknown): v is AgencyBilling {
  return v === "monthly" || v === "prepay";
}

/**
 * Performance Pay for one month, in cents: the percentage of Net Attributed
 * Revenue less the Agency Fee already paid for that month, never below zero.
 * Net itself is never below zero (a month where the ads cost more than they
 * brought in owes nothing and carries nothing forward).
 * $250,000 net → $25,000 → less $10,000 → $15,000. $120,000 → $2,000.
 */
export function performancePayCents(
  netCents: number,
  creditCents: number = AGENCY.FEE_MONTHLY_CENTS,
  percent: number = AGENCY.PERFORMANCE_PERCENT
): number {
  const net = Math.max(0, Math.round(netCents));
  return Math.max(0, Math.round((net * percent) / 100) - Math.max(0, Math.round(creditCents)));
}

/** Net Attributed Revenue for a month: collected from ad-sourced clients less ad spend, never below zero. */
export function netAttributedCents(collectedCents: number, adSpendCents: number): number {
  return Math.max(0, Math.round(collectedCents) - Math.max(0, Math.round(adSpendCents)));
}

/** What an annual client pays at signing for a given Setup Fee ($82,000 now, $74,000 original). */
export function annualUpfrontCents(setupCents: number = DRS_PRICING.SETUP_FEE_CENTS): number {
  return setupCents + DRS_PRICING.ANNUAL_CENTS;
}

/** What an annual client pays at signing at the current price: Setup Fee + Annual Investment ($82,000). */
export const ANNUAL_UPFRONT_CENTS = annualUpfrontCents(DRS_PRICING.SETUP_FEE_CENTS);

/**
 * A specific AI avatar from the library, chosen by the client on their Launch
 * Pad (Nov 16 2026, Marcel): $2,500 one-time, exclusive to their firm, added
 * as a one-time line to their first monthly invoice (the ad-budget invoice on
 * annual). Otherwise Nexli picks one for them at no charge.
 */
export const AI_AVATAR_PICK_CENTS = 250_000;

/**
 * The first-month ad bonus (Nov 16 2026, letters from then on, both pricing
 * versions): Nexli's own money placed in the client's campaigns in the first
 * month of ads from Launch, on top of the client's budget. Monthly plan:
 * Nexli matches that month's $5,000 ad budget. Annual plan: $10,000 in ad
 * credits. No cash value, not refundable, not credited against any fee, does
 * not carry into later months (letter Section 3(e)). Not billed anywhere.
 */
export const FIRST_MONTH_AD_BONUS_CENTS: Record<"monthly" | "annual", number> = {
  monthly: DRS_PRICING.AD_SPEND_MONTHLY_CENTS, // $5,000 — the first month matched
  annual: 1_000_000, // $10,000 in ad credits
};

/** What a monthly-plan client pays each month: platform upkeep + ad budget. */
export const TOTAL_MONTHLY_CENTS =
  DRS_PRICING.MONTHLY_CENTS + DRS_PRICING.AD_SPEND_MONTHLY_CENTS; // $9,997

export type BillingPlan = "monthly" | "annual";

/** Initial contract term per plan, in months, counted from Launch (letters from Nov 9 2026). */
export const TERM_MONTHS: Record<BillingPlan, number> = {
  monthly: 6,
  annual: 12,
};

export interface SetupScopeItem {
  name: string;
  detail: string;
}
export interface SetupScopeGroup {
  title: string;
  items: SetupScopeItem[];
}

/**
 * Everything the one-time Setup Fee delivers (Phase 1 — Implementation).
 * Single source of truth for Section 1 of the engagement letter, the compose
 * UI, and the setup invoice. Grouped the way Marcel described it.
 */
export const SETUP_SCOPE: readonly SetupScopeGroup[] = [
  {
    title: "Platform Build",
    items: [
      {
        name: "Website Build",
        detail:
          "A professional website designed, built and deployed under Client's domain, with SEO and AEO (AI engine optimization) so the firm is found by both search engines and AI assistants. Client provides DNS editor access with its hosting provider for deployment.",
      },
      {
        name: "Funnel Build for the Portal",
        detail:
          "The lead-capture funnel that moves a prospect from ad click to booked consultation and into Client's portal.",
      },
      {
        name: "Client Portal Buildout",
        detail:
          "Client's branded client portal: secure document exchange, messaging, invoicing and tax-organizer intake for Client's own clients.",
      },
      {
        name: "CRM Dashboard",
        detail:
          "Client's Nexli whitelabel dashboard with contacts, pipeline, calendar, messaging, client management and analytics.",
      },
      {
        name: "Engagement Letter Setup",
        detail: "E-signature engagement letter templates configured for Client's services.",
      },
      {
        name: "Onboarding Setup",
        detail:
          "Client-facing onboarding (Launch Pad) and intake workflows configured for Client's new advisory clients.",
      },
      {
        name: "Contract Analyzer",
        detail: "AI contract-analysis tooling configured for Client's firm.",
      },
      {
        name: "Invoice Setup",
        detail:
          "Invoicing and payment collection through the dashboard, including creating a Stripe account for Client or connecting Client's existing payment processor via API.",
      },
    ],
  },
  {
    title: "Automations",
    items: [
      {
        name: "Funnel Sequencing",
        detail:
          "AI-powered lead capture, follow-up sequences, appointment scheduling and client-communication workflows, including A2P 10DLC registration for compliant SMS/text messaging.",
      },
      {
        name: "Google Review Automation",
        detail: "Automated review requests to grow Client's Google review count.",
      },
      {
        name: "Reputation Management",
        detail: "Monitoring and response workflows for Client's online reviews and reputation.",
      },
    ],
  },
  {
    title: "Content Front-Load",
    items: [
      {
        name: "AI Ad Creative Front-Load",
        detail:
          "A large launch batch of AI-generated video and photo ad creatives produced up front, so Client's campaigns can test creative from day one.",
      },
    ],
  },
  {
    title: "Advertising Engineering",
    items: [
      {
        name: "AI Ads Management Engineering",
        detail:
          "Campaign architecture, audience targeting, tracking and attribution built for Client's advertising accounts.",
      },
      {
        name: "Ads Support & Reporting",
        detail: "Campaign support and performance reporting, including Client's weekly update.",
      },
      {
        name: "AI Usage",
        detail: "The AI tooling and usage required to build and operate the above.",
      },
    ],
  },
];

/** The service the Provider-managed ads promote (used in attribution wording). */
export const ADVERTISED_SERVICE = "tax planning";

/**
 * What one tax advisory engagement is worth to the CLIENT's firm (industry
 * range, midpoint $15,000). Used only to size the pipeline on the Campaign
 * progress tile ("N leads ≈ $X of pipeline") — illustrative, never a
 * revenue claim or a guarantee. Distinct from PIPELINE (Nexli's own LTV per
 * DRS client).
 */
export const ADVISORY_ENGAGEMENT = {
  LOW_USD: 5_000,
  HIGH_USD: 25_000,
  AVG_USD: 15_000,
} as const;

/**
 * Launch timeline written into the engagement letter (Sections 1 and 5):
 * the acquisition system launches within this many days of receiving all
 * client materials. A timeline commitment, not a guarantee — there is no
 * credit if it slips.
 */
export const LAUNCH_TARGET_DAYS = 21;

/**
 * Pipeline economics: expected lifetime value of one DRS client, used as
 * the default deal value for each open pipeline lead. Industry benchmarks
 * (Focus Digital 2026 churn report; Agiled/Promethean): retainer agencies
 * average ~18–20% annual churn (top shops 8–10%), typical client lifespan
 * 2–5 years — but ~25% of agencies see tenures under a year, and a new
 * agency should assume the conservative end. Marcel's own estimate is 6–8
 * months; on the Nov 19 2026 pricing that is 8 × $10,000 = $80,000 of
 * agency fees per client (performance pay is not counted — it can't be
 * known ahead; the ad budget never passes through Nexli). Editable per lead.
 */
export const PIPELINE = {
  EXPECTED_LIFETIME_MONTHS: 8,
  DEFAULT_DEAL_VALUE_CENTS: 8 * AGENCY.FEE_MONTHLY_CENTS, // $80,000
} as const;

/**
 * Card vs bank transfer pricing. Since Oct 26 2026 (Marcel) card payments
 * cost the SAME as ACH: 0% difference. The dual-pricing plumbing stays (the
 * card price is still computed server-side via cardPriceCents) so a gap can
 * be reintroduced by changing this one number — if it ever is, keep framing
 * it as two prices, never as a fee added to a base price.
 */
export const CARD_PRICE_PERCENT_ABOVE_ACH = 0;

export function cardPriceCents(achPriceCents: number): number {
  return Math.round(
    (achPriceCents * (100 + CARD_PRICE_PERCENT_ABOVE_ACH)) / 100
  );
}

/**
 * DRS invoices that must be paid by bank transfer (ACH) or wire — never card
 * (Nov 9 2026, Marcel; letter Sections 2(a), 2(b), 4(a) and nexli.net's
 * policy pages). Normally the Mercury bank-transfer page handles them
 * (BANK_TRANSFER_DRS_ROLES); listing them here makes every other path —
 * Mercury off, a failed admin lookup, the classic invoice page — refuse card
 * too (Stripe ACH only). Enterprise invoices carry metadata.achOnly.
 */
export const ACH_ONLY_DRS_ROLES: readonly string[] = ["setup_fee", "setup_annual", "platform_annual_renewal"];

/** DRS invoices covered by the letter's chargeback waiver (paid at signing). */
export const CHARGEBACK_WAIVED_DRS_ROLES = ["setup_fee", "setup_annual"] as const;

export function isChargebackWaivedInvoiceMeta(metadata: unknown): boolean {
  const role = ((metadata ?? {}) as { drsRole?: unknown }).drsRole;
  return typeof role === "string" && (CHARGEBACK_WAIVED_DRS_ROLES as readonly string[]).includes(role);
}

/**
 * Invoices paid by bank transfer (ACH or wire) straight into Nexli's Mercury
 * account instead of through Stripe (Nov 7 2026, Marcel): processors balk at
 * $32K–$500K charges. The setup fee, the annual up-front invoice and annual
 * renewals by role, plus every Enterprise invoice. Monthly invoices stay on
 * Stripe autopay. Only applies once Mercury is connected (lib/mercury.ts).
 */
export const BANK_TRANSFER_DRS_ROLES = ["setup_fee", "setup_annual", "platform_annual_renewal"] as const;

export function isBankTransferInvoiceMeta(metadata: unknown): boolean {
  const meta = (metadata ?? {}) as { drsRole?: unknown; offer?: unknown };
  if (meta.offer === "enterprise") return true;
  return typeof meta.drsRole === "string" && (BANK_TRANSFER_DRS_ROLES as readonly string[]).includes(meta.drsRole);
}

/** True when an invoice's metadata marks it bank-transfer/wire only (Enterprise, DRS setup). */
export function isAchOnlyInvoiceMeta(metadata: unknown): boolean {
  const meta = (metadata ?? {}) as { achOnly?: unknown; drsRole?: unknown };
  if (meta.achOnly) return true;
  return (
    typeof meta.drsRole === "string" &&
    ACH_ONLY_DRS_ROLES.includes(meta.drsRole)
  );
}

/**
 * New-pricing invoices that can ALSO be paid by wire (Nov 19 2026;
 * nexli.net: "every charge can be paid by card, ACH or wire"): the six-month
 * prepayment and Performance Pay invoices. They stay on Stripe (card or ACH)
 * and, once Mercury is connected, the pay page also shows the bank details;
 * a wire that arrives is matched like any other transfer (lib/mercury.ts).
 * The monthly Agency Fee is on autopay (card or ACH), so it isn't here.
 */
export const WIRE_OPTION_DRS_ROLES = ["agency_prepay", "performance_pay"] as const;

export function isWireOptionInvoiceMeta(metadata: unknown): boolean {
  const role = ((metadata ?? {}) as { drsRole?: unknown }).drsRole;
  return typeof role === "string" && (WIRE_OPTION_DRS_ROLES as readonly string[]).includes(role);
}
