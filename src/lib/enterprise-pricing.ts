/**
 * Nexli Enterprise License — pricing and program constants.
 *
 * Client-safe: no server-only imports, so these can be used from the compose
 * UI, the invoice pay page, and API routes alike.
 *
 * The offer (Oct 2026): a licensed, done-for-you install of Nexli's internal
 * operating system for CPA firms — talent acquisition, the Facebook ad
 * acquisition model, AI creative generation (ChatGPT) and editing (Kling AI),
 * AI for profitability, and the internal scaling SOPs. Priced by firm size
 * with an annual renewal, paid 100% up front by ACH/wire (checks accepted
 * once cleared, no cards), and nothing is scheduled until funds clear.
 *
 * Duration rationale: ads take ~90 days to mature and an A-player hire is a
 * 60–90 day cycle, so 3 months is too short; 6 continuous months on site is
 * too expensive and signals the client can't run it. Hence a 6-month
 * program front-loaded into a 90-day intensive, inside a 12-month license.
 */

export type EnterpriseTier = "core" | "growth" | "scale";

export const ENTERPRISE_TIER_ORDER: EnterpriseTier[] = ["core", "growth", "scale"];

export interface EnterpriseTierInfo {
  label: string;
  priceCents: number;
  /** Who the tier is for — rendered into the contract and the compose UI. */
  firmSize: string;
  /** Scale tier: Nexli also operates the client's advertising for the license year. */
  includesAds: boolean;
}

export const ENTERPRISE_TIERS: Record<EnterpriseTier, EnterpriseTierInfo> = {
  core: {
    label: "Core",
    priceCents: 25_000_000, // $250,000
    firmSize: "single-location firms under approximately $3M in annual revenue",
    includesAds: false,
  },
  growth: {
    label: "Growth",
    priceCents: 35_000_000, // $350,000
    firmSize: "multi-partner firms between $3M and $10M in annual revenue",
    includesAds: false,
  },
  scale: {
    label: "Scale",
    priceCents: 50_000_000, // $500,000
    firmSize:
      "firms above $10M in annual revenue, or any firm where Nexli also operates the advertising for the full license year",
    includesAds: true,
  },
};

export const ENTERPRISE = {
  /** Annual renewal as a percentage of the tier's license fee (adjustable). */
  RENEWAL_PERCENT: 25,
  IMPLEMENTATION_MONTHS: 6,
  INTENSIVE_DAYS: 90,
  LICENSE_MONTHS: 12,
  KICKOFF_ONSITE_DAYS: 5, // business days on site for the kickoff week
  MONTHLY_VISIT_DAYS: 2, // business days per on-site visit in months 2 and 3
  NON_SOLICIT_MONTHS: 12,
  CHECK_CLEARING_BUSINESS_DAYS: 10,
  KICKOFF_SCHEDULING_BUSINESS_DAYS: 10, // after funds clear
} as const;

export function renewalCents(tier: EnterpriseTier): number {
  return Math.round(
    (ENTERPRISE_TIERS[tier].priceCents * ENTERPRISE.RENEWAL_PERCENT) / 100
  );
}

export const ENTERPRISE_TEMPLATE_NAME = "Nexli Enterprise License";

/** Template detection by name — the same approach DRS uses ("digital rainmaker"). */
export function isEnterpriseTemplateName(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().includes("enterprise license");
}

export function isEnterpriseTier(value: unknown): value is EnterpriseTier {
  return value === "core" || value === "growth" || value === "scale";
}
