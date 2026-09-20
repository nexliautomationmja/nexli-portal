/**
 * Digital Rainmaker System pricing — single source of truth.
 *
 * Client-safe: no server-only imports, so these constants can be used from
 * both API routes and client components (compose UI, invoice pay page).
 *
 * One flat all-in-one price: the whole Digital Rainmaker System for a single
 * monthly (or discounted annual) investment — no setup fees, no ad-management
 * tiers, no revenue share. Ad management is included in the flat price (the
 * client pays ad spend directly to the platforms). The only performance-based
 * compensation is the milestone SUCCESS_BONUS below.
 */

export const DRS_PRICING = {
  MONTHLY_CENTS: 499_700, // $4,997.00 / month — all-in-one
  ANNUAL_CENTS: 4_200_000, // $42,000.00 / year prepaid (~30% off vs $59,964 at the monthly rate; covers processing fees)
} as const;

export type BillingPlan = "monthly" | "annual";

/** The service the Provider-managed ads promote (used in attribution wording). */
export const ADVERTISED_SERVICE = "tax planning";

/**
 * Success bonus — the ONLY performance-based compensation. Nexli never takes
 * a percentage of the client's revenue (Marcel, Sep 2026: "not price
 * gouging"). Instead, each time the cumulative revenue a client actually
 * collects from advisory clients attributable to Nexli's campaigns
 * ("Attributed Revenue") first reaches a milestone within a contract year,
 * the client owes a one-time bonus for that milestone. Each milestone pays
 * once per contract year; the counter resets every contract year. Invoiced
 * manually when a milestone is hit — never auto-invoiced.
 *
 * Bonus = milestone × BONUS_PERCENT_OF_MILESTONE, so one number tunes the
 * whole schedule. At 2%: $250K→$5,000, $500K→$10,000, $1M→$20,000,
 * $2M→$40,000 … $10M→$200,000. If every milestone is hit in one contract
 * year the cumulative bonus is $1,115,000 on $10M of Attributed Revenue
 * (~11%); at the first milestone it is 2%.
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
 * The Nexli Triple Guarantee — written into the engagement letter
 * (engagement-defaults.ts) so firm owners have less fear of starting. The
 * third leg is the flat-rate / no-revenue-share promise.
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
 * months; 8 × $4,997 = $39,976, so every open lead ≈ $40K expected value
 * (close to the $42,000 annual plan). Editable per lead.
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
