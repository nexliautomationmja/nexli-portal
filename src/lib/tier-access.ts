/**
 * Commercial-tier helpers shared by the dashboard layout, sidebar, auth and
 * middleware. Pure functions only — safe to import from client components.
 */

export type Tier = "drs" | "foundation";

/** users.tier is nullable; null means the legacy full-service DRS client. */
export function normalizeTier(tier: string | null | undefined): Tier {
  return tier === "foundation" ? "foundation" : "drs";
}

/** Stripe subscription statuses that still grant dashboard access. */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isSubscriptionActive(status: string | null | undefined): boolean {
  return !!status && ACTIVE_STATUSES.has(status);
}

/**
 * Dashboard routes backed by agency tooling (GHL, ad platforms, Vercel
 * analytics). Hidden from — and redirected away for — Foundation-tier firms.
 */
export const AGENCY_ROUTE_PREFIXES = [
  "/dashboard/contacts",
  "/dashboard/pipeline",
  "/dashboard/calendar",
  "/dashboard/messages",
  "/dashboard/ad-analytics",
  "/dashboard/onboarding",
  "/dashboard/contract-analyzer",
  "/dashboard/client-tracker",
] as const;

export function isAgencyRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return AGENCY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export const BILLING_PAUSED_PATH = "/dashboard/billing-paused";
