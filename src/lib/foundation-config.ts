/**
 * Firm Foundation tier — shared constants.
 *
 * The Foundation tier is the $497/mo self-serve product (website + branded
 * client portal). Provisioning is driven by the marketing app's Stripe
 * webhook calling POST /api/internal/provision.
 */

export const FOUNDATION_TIER = "foundation" as const;

/**
 * Name of the auto-generated service agreement engagement. Must NOT contain
 * "digital rainmaker" — src/lib/digital-rainmaker.ts detects DRS templates by
 * that substring and would auto-invoice $10k on signature.
 */
export const FOUNDATION_AGREEMENT_TEMPLATE_NAME =
  "Firm Foundation Service Agreement";

export const FOUNDATION_MONTHLY_CENTS = 49_700; // $497.00
export const FOUNDATION_MIN_TERM_DAYS = 90;
export const FOUNDATION_LIVE_IN_DAYS = 21;

/** Nexli admin account that owns Foundation agreements (role = admin). */
export const NEXLI_ADMIN_EMAIL =
  process.env.NEXLI_ADMIN_EMAIL || "mail@nexli.net";

/** Public portal origin (no trailing slash). */
export function getPortalUrl(): string {
  return (process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net").replace(
    /\/+$/,
    ""
  );
}

/**
 * Public origin of the marketing app (no trailing slash). Firm websites are
 * served from there at /sites/<slug> and on custom domains.
 */
export function getMarketingSiteUrl(): string {
  return (process.env.MARKETING_SITE_URL || "https://www.nexli.net").replace(
    /\/+$/,
    ""
  );
}

export const PASSWORD_SETUP_TTL_DAYS = 7;
