/**
 * Digital Rainmaker System pricing — single source of truth.
 *
 * Client-safe: no server-only imports, so these constants can be used from
 * both API routes and client components (compose UI, invoice pay page).
 *
 * One flat all-in-one price: the whole Digital Rainmaker System for a single
 * monthly (or discounted annual) investment — no setup fees, no ad-management
 * tiers. Ad management is separate and performance-based (see AD_PERFORMANCE).
 */

export const DRS_PRICING = {
  MONTHLY_CENTS: 499_700, // $4,997.00 / month — all-in-one
  ANNUAL_CENTS: 3_999_700, // $39,997.00 / year prepaid (~33% off vs monthly)
} as const;

export type BillingPlan = "monthly" | "annual";

/**
 * Performance-based ad management. There is no monthly ad retainer — the
 * Provider earns a percentage of the revenue the Client actually collects
 * from tax advisory clients attributable to the Nexli acquisition system
 * (i.e., strictly the clients the Provider-managed ads bring in), attributed
 * via the tracking system. Billed as results come in, outside the flat
 * platform price. The flat price covers the buildout AND ongoing maintenance.
 */
export const AD_PERFORMANCE = {
  PERCENT_OF_COLLECTED_REVENUE: 20, // 20% of revenue the client actually collects (leaves margin for ad contractors)
  ADVERTISED_SERVICE: "tax planning",
} as const;

/**
 * The Nexli Triple Guarantee — written into the engagement letter
 * (engagement-defaults.ts) so firm owners have less fear of starting.
 */
export const TRIPLE_GUARANTEE = {
  QUALIFIED_OPPORTUNITIES: 10, // qualified advisory opportunities…
  OPPORTUNITY_WINDOW_DAYS: 90, // …within 90 days of campaign launch, else work free
  LAUNCH_DAYS: 21, // launch within 21 days of receiving all client materials
  LAUNCH_CREDIT_CENTS: 100_000, // $1,000 credit toward next payment if Provider misses it
} as const;

/**
 * Pipeline economics: expected lifetime value of one DRS client, used as
 * the default deal value for each open pipeline lead. Industry benchmarks
 * (Focus Digital 2026 churn report; Agiled/Promethean): retainer agencies
 * average ~18–20% annual churn (top shops 8–10%), typical client lifespan
 * 2–5 years — but ~25% of agencies see tenures under a year, and a new
 * agency should assume the conservative end. Marcel's own estimate is 6–8
 * months; 8 × $4,997 = $39,976 ≈ the $39,997 annual plan, so every open
 * lead ≈ $40K expected value regardless of plan. Editable per lead.
 */
export const PIPELINE = {
  EXPECTED_LIFETIME_MONTHS: 8,
  DEFAULT_DEAL_VALUE_CENTS: 8 * DRS_PRICING.MONTHLY_CENTS, // $39,976
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
