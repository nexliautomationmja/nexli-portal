/**
 * Digital Rainmaker System pricing — single source of truth.
 *
 * Client-safe: no server-only imports, so these constants can be used from
 * both API routes and client components (compose UI, invoice pay page).
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
 * Minimum term: 6 months on monthly, 12 on annual — ads need ~90 days to
 * mature; the goal is retention, not lock-in.
 */

export const DRS_PRICING = {
  SETUP_FEE_CENTS: 3_200_000, // $32,000.00 one-time — Phase 1 implementation (SETUP_SCOPE)
  MONTHLY_CENTS: 499_700, // $4,997.00 / month — platform upkeep of everything in Phase 1
  ANNUAL_CENTS: 4_200_000, // $42,000.00 / year prepaid platform upkeep (~30% off vs $59,964 at the monthly rate)
  AD_SPEND_MONTHLY_CENTS: 500_000, // $5,000.00 / month Managed Advertising Budget (pass-through)
} as const;

/** What an annual client pays at signing: Setup Fee + Annual Investment ($74,000). */
export const ANNUAL_UPFRONT_CENTS =
  DRS_PRICING.SETUP_FEE_CENTS + DRS_PRICING.ANNUAL_CENTS;

/** What a monthly-plan client pays each month: platform upkeep + ad budget. */
export const TOTAL_MONTHLY_CENTS =
  DRS_PRICING.MONTHLY_CENTS + DRS_PRICING.AD_SPEND_MONTHLY_CENTS; // $9,997

export type BillingPlan = "monthly" | "annual";

/** Initial contract term per plan, in months. */
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
 * months; $32,000 setup + 8 × $4,997 = $71,976 of Nexli revenue, so every
 * open lead ≈ $72K expected value (the ad budget is pass-through and
 * excluded). Editable per lead.
 */
export const PIPELINE = {
  EXPECTED_LIFETIME_MONTHS: 8,
  DEFAULT_DEAL_VALUE_CENTS: DRS_PRICING.SETUP_FEE_CENTS + 8 * DRS_PRICING.MONTHLY_CENTS, // $71,976
} as const;

/**
 * Dual pricing: amounts listed on invoices and in contracts are the
 * discounted bank transfer (ACH) price; credit/debit card payments are
 * charged at the card price. This is deliberately framed as two prices —
 * never as a fee added to a base price — which is the surcharge-law-safe
 * presentation in all US states. The card price is computed server-side;
 * the client only displays it.
 */
export const CARD_PRICE_PERCENT_ABOVE_ACH = 3;

export function cardPriceCents(achPriceCents: number): number {
  return Math.round(
    (achPriceCents * (100 + CARD_PRICE_PERCENT_ABOVE_ACH)) / 100
  );
}

/**
 * Invoices that must be paid by bank transfer (ACH) or wire — never card
 * (Marcel, Oct 20 2026): both up-front setup invoices. The $9,997 monthly,
 * the $5,000 monthly ad budget and annual renewals accept card too.
 */
export const ACH_ONLY_DRS_ROLES = ["setup_fee", "setup_annual"] as const;

/** True when an invoice's metadata marks it bank-transfer/wire only (Enterprise, DRS setup). */
export function isAchOnlyInvoiceMeta(metadata: unknown): boolean {
  const meta = (metadata ?? {}) as { achOnly?: unknown; drsRole?: unknown };
  if (meta.achOnly) return true;
  return (
    typeof meta.drsRole === "string" &&
    (ACH_ONLY_DRS_ROLES as readonly string[]).includes(meta.drsRole)
  );
}
