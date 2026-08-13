/**
 * Digital Rainmaker System pricing — single source of truth.
 *
 * Client-safe: no server-only imports, so these constants can be used from
 * both API routes and client components (compose UI, invoice pay page).
 */

/** Original DRS pricing in cents — $20k total setup ($10k + $10k) + $2,497/mo. */
export const DRS_PRICING = {
  INITIAL_SETUP_CENTS: 10_000_00, // $10,000.00
  FINAL_SETUP_CENTS: 10_000_00,   // $10,000.00
  MONTHLY_SUBSCRIPTION_CENTS: 249_700, // $2,497.00
} as const;

/** Starter DRS pricing — $15k total setup ($7.5k + $7.5k) + $1,497/mo. */
export const STARTER_DRS_PRICING = {
  INITIAL_SETUP_CENTS: 750_000,    // $7,500.00
  FINAL_SETUP_CENTS: 750_000,      // $7,500.00
  MONTHLY_RETAINER_CENTS: 149_700, // $1,497.00
} as const;

/** Ad management tier pricing — monthly management fees. */
export const ADS_TIERS = {
  foundation: { label: "Foundation Ads", cents: 250_000, spendRange: "$2,000–$5,000/mo" },
  growth:     { label: "Growth Ads",     cents: 450_000, spendRange: "$5,000–$10,000/mo" },
  scale:      { label: "Scale Ads",      cents: 750_000, spendRange: "$10,000–$25,000+/mo" },
} as const;

export type AdsTier = keyof typeof ADS_TIERS;

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
