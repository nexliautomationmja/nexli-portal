/**
 * Digital Rainmaker System pricing — single source of truth.
 *
 * Client-safe: no server-only imports, so these constants can be used from
 * both API routes and client components (compose UI, invoice pay page).
 *
 * One flat all-in-one platform price — $5,000/mo or $42,000/yr prepaid — with
 * no setup fees, no ad-management tiers, no revenue share. Ad management is
 * included. On top of the platform price every client funds a Managed
 * Advertising Budget of $5,000/mo that Nexli collects and deploys on the ad
 * platforms on the client's behalf (pass-through, no markup — see
 * AD_SPEND_MONTHLY_CENTS and engagement letter Section 3(b)). Monthly plan
 * = one $10,000 invoice (two line items); annual = $42,000 yearly + a
 * $5,000 monthly ad-budget invoice. The only performance-based compensation
 * is the milestone SUCCESS_BONUS below.
 *
 * Minimum term (Oct 2026): 6 months on monthly, 12 on annual — ads need
 * ~90 days to mature; the goal is retention, not lock-in.
 */

export const DRS_PRICING = {
  MONTHLY_CENTS: 500_000, // $5,000.00 / month — platform (all-in-one)
  ANNUAL_CENTS: 4_200_000, // $42,000.00 / year prepaid (~30% off vs $60,000 at the monthly rate; covers processing fees)
  AD_SPEND_MONTHLY_CENTS: 500_000, // $5,000.00 / month Managed Advertising Budget (pass-through)
} as const;

/** What a monthly-plan client pays each month: platform + ad budget. */
export const TOTAL_MONTHLY_CENTS =
  DRS_PRICING.MONTHLY_CENTS + DRS_PRICING.AD_SPEND_MONTHLY_CENTS; // $10,000

export type BillingPlan = "monthly" | "annual";

/** Initial contract term per plan, in months. */
export const TERM_MONTHS: Record<BillingPlan, number> = {
  monthly: 6,
  annual: 12,
};

/** The service the Provider-managed ads promote (used in attribution wording). */
export const ADVERTISED_SERVICE = "tax planning";

/**
 * Success bonus — the ONLY performance-based compensation. Nexli never takes
 * a percentage of the client's revenue (Marcel, Sep 2026: "not price
 * gouging"). Instead, for each contract year the client owes ONE bonus:
 * BONUS_PERCENT_OF_MILESTONE of the HIGHEST milestone that the cumulative
 * revenue the client actually collects from advisory clients attributable
 * to Nexli's campaigns ("Attributed Revenue") reached in that year.
 * Milestones do not stack ($1.2M generated → the $1M bonus only). Nothing
 * is owed below the first milestone ($250K). The counter resets every
 * contract year (12 months from the engagement's effective date).
 *
 * Billed manually, never auto-invoiced, at the EARLIER of: the end of the
 * contract year, or the client leaving / the service ending for any reason
 * (a client who hit $1M and cancels in month 8 still owes the $1M bonus on
 * the way out — Section 12(d)). The Client Tracker shows each client's
 * start date and next contract-year end for this reason.
 *
 * At 2%: $250K→$5,000, $500K→$10,000, $1M→$20,000, $2M→$40,000 …
 * $10M→$200,000. Max exposure is therefore 2% of the milestone reached.
 *
 * PLACEHOLDER: the 2% rate has not been confirmed by Marcel — the milestones
 * are his, the amounts are a starting point.
 */
export const SUCCESS_BONUS = {
  MILESTONES_USD: [
    250_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000,
    6_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000,
  ],
  BONUS_PERCENT_OF_MILESTONE: 2,
} as const;

export type SuccessBonusTier = { milestoneCents: number; bonusCents: number };

/** The bonus schedule as (milestone, bonus) pairs in cents, ascending. */
export function successBonusSchedule(): SuccessBonusTier[] {
  return SUCCESS_BONUS.MILESTONES_USD.map((usd) => ({
    milestoneCents: usd * 100,
    bonusCents: Math.round(
      (usd * 100 * SUCCESS_BONUS.BONUS_PERCENT_OF_MILESTONE) / 100
    ),
  }));
}

/**
 * The Nexli Guarantee — written into the engagement letter (Section 4 of
 * engagement-defaults.ts) so firm owners have less fear of starting:
 *
 *   a) 50 Qualified Leads within 90 days of campaign launch, else Nexli works
 *      free until hit; if STILL unmet 120 days after launch the client may
 *      terminate early with no further platform obligation (Oct 2026 —
 *      Marcel: "work for free until we hit it, and if not hit by month 4
 *      they can terminate early").
 *   b) Launch within 21 days of receiving all client materials, else a
 *      $1,000 credit.
 *   c) Flat rate, no revenue share.
 *
 * Mirrors the marketing site's lib/agency-offer.ts (AGENCY_LEADS = 50,
 * AGENCY_DAYS = 90). NOTE: the site still says a 14-day launch — the
 * contract's 21 days is the binding figure; fix the site, not this.
 */
export const NEXLI_GUARANTEE = {
  QUALIFIED_LEADS: 50, // qualified leads…
  LEAD_WINDOW_DAYS: 90, // …within 90 days of campaign launch, else work free
  EXIT_OPTION_DAYS: 120, // still unmet this many days after launch → client may terminate early
  LAUNCH_DAYS: 21, // launch within 21 days of receiving all client materials
  LAUNCH_CREDIT_CENTS: 100_000, // $1,000 credit toward next payment if Provider misses it
} as const;

/**
 * What one tax advisory engagement is worth to the CLIENT's firm (industry
 * range, midpoint $15,000). Used only to size the guaranteed pipeline in
 * the contract and the progress tile — it is illustrative, never a revenue
 * guarantee. Distinct from PIPELINE (Nexli's own LTV per DRS client).
 */
export const ADVISORY_ENGAGEMENT = {
  LOW_USD: 5_000,
  HIGH_USD: 25_000,
  AVG_USD: 15_000,
} as const;

/** 50 leads × $15,000 = $750,000 of pipeline opportunity if every lead closed. */
export const GUARANTEED_PIPELINE_VALUE_USD =
  NEXLI_GUARANTEE.QUALIFIED_LEADS * ADVISORY_ENGAGEMENT.AVG_USD;

/**
 * Pipeline economics: expected lifetime value of one DRS client, used as
 * the default deal value for each open pipeline lead. Industry benchmarks
 * (Focus Digital 2026 churn report; Agiled/Promethean): retainer agencies
 * average ~18–20% annual churn (top shops 8–10%), typical client lifespan
 * 2–5 years — but ~25% of agencies see tenures under a year, and a new
 * agency should assume the conservative end. Marcel's own estimate is 6–8
 * months; 8 × $5,000 = $40,000 platform revenue, so every open lead ≈ $40K
 * expected value (the ad budget is pass-through and excluded). Editable per
 * lead.
 */
export const PIPELINE = {
  EXPECTED_LIFETIME_MONTHS: 8,
  DEFAULT_DEAL_VALUE_CENTS: 8 * DRS_PRICING.MONTHLY_CENTS, // $40,000
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
