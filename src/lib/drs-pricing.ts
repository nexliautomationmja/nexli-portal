/**
 * Digital Rainmaker System pricing — single source of truth.
 *
 * Client-safe: no server-only imports, so these constants can be used from
 * both API routes and client components (compose UI, invoice pay page).
 *
 * One flat all-in-one platform price — $5,000/mo or $42,000/yr prepaid — with
 * no setup fees, no ad-management tiers, no revenue share, no performance
 * fee, no bonus, and (since Oct 12 2026) no guarantees of any kind. Ad
 * management is included. On top of the platform price every client funds a
 * Managed Advertising Budget of $5,000/mo that Nexli collects and deploys on
 * the ad platforms on the client's behalf (pass-through, no markup — see
 * AD_SPEND_MONTHLY_CENTS and engagement letter Section 3(b)). Monthly plan
 * = one $10,000 invoice (two line items); annual = $42,000 yearly + a
 * $5,000 monthly ad-budget invoice.
 *
 * Marcel's stance: clients keep all of the upside ("the cherry on top");
 * Nexli's upside is graduating them to the Enterprise tier
 * (enterprise-pricing.ts), not backend bonuses.
 *
 * Minimum term: 6 months on monthly, 12 on annual — ads need ~90 days to
 * mature; the goal is retention, not lock-in.
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
