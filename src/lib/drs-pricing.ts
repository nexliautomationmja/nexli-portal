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
 * Provider earns a percentage of the value of each closed deal in the
 * advertised service line (tax planning), attributed via the tracking
 * system. Billed as results come in, outside the flat platform price.
 */
export const AD_PERFORMANCE = {
  PERCENT_OF_CLOSED_DEAL: 20, // 20% of the closed deal value (leaves margin for ad contractors)
  ADVERTISED_SERVICE: "tax planning",
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
