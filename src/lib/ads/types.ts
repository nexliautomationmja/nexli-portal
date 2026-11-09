import type { Thresholds } from "@/lib/ads/thresholds";

/**
 * The Ads tab's data shapes (pure, client-safe). One `AdsSnapshot` powers the
 * whole page and is what Manus gets (as a trimmed data pack).
 * Money is in cents, rates are 0–1, dates are YYYY-MM-DD in the ad account's
 * timezone.
 */

export type AdsRange = "7" | "14" | "30" | "90";
export const ADS_RANGES: AdsRange[] = ["7", "14", "30", "90"];
export const parseAdsRange = (v: unknown): AdsRange => (v === "7" || v === "14" || v === "90" ? v : "30");

/** Delivery counts from Meta for one window. */
export interface RawCounts {
  spendCents: number;
  impressions: number;
  /** Unique people; only valid for the window it was fetched for (never summed). */
  reach: number | null;
  frequency: number | null;
  linkClicks: number;
  landingPageViews: number;
  /** Meta's own lead count (one action type — never the sum of overlapping ones). */
  metaLeads: number;
  /** 3-second video plays. */
  videoViews3s: number;
  thruplays: number;
}

/** GoHighLevel outcomes for a window (the source of truth for leads and bookings). */
export interface Outcomes {
  ghlLeads: number;
  booked: number;
  won: number;
}

export interface Metrics extends RawCounts {
  /** null = can't be attributed at this level. */
  ghlLeads: number | null;
  booked: number | null;
  won: number | null;
  /** Link clicks ÷ impressions. */
  ctr: number | null;
  cpmCents: number | null;
  cpcCents: number | null;
  /** Landing page views ÷ link clicks. */
  lpvRate: number | null;
  /** 3-second plays ÷ impressions. */
  hookRate: number | null;
  /** ThruPlays ÷ 3-second plays. */
  holdRate: number | null;
  /** Spend ÷ GHL leads. */
  cplCents: number | null;
  costPerBookedCents: number | null;
  /** Booked ÷ GHL leads. */
  bookedRate: number | null;
}

export type MetricKey = keyof Metrics;

export interface Delta {
  /** (cur − prev) ÷ prev. */
  rel: number | null;
  /** Did it move the good way? null = neutral metric or no change. */
  better: boolean | null;
  /** Too little data on either side to trust the move. */
  lowVolume: boolean;
  /** Statistically significant (rates with a z-test); null when not tested. */
  significant: boolean | null;
}

export interface Compare {
  cur: Metrics;
  prev: Metrics | null;
  delta: Partial<Record<MetricKey, Delta>>;
}

export interface DailyPoint {
  date: string;
  spendCents: number;
  impressions: number;
  linkClicks: number;
  landingPageViews: number;
  metaLeads: number;
  ghlLeads: number;
  booked: number;
}

export interface WeeklyPoint {
  since: string;
  until: string;
  spendCents: number;
  impressions: number;
  reach: number | null;
  frequency: number | null;
  linkClicks: number;
}

export type AccountStatusTone = "ok" | "warn" | "bad";

export interface AccountInfo {
  id: string;
  name: string | null;
  currency: string;
  timezone: string;
  status: { code: number | null; label: string; tone: AccountStatusTone };
  pixel: { id: string; name: string | null; lastFiredAt: string | null; stale: boolean } | null;
}

export type LearningStatus = "LEARNING" | "SUCCESS" | "FAIL" | "UNKNOWN";

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string | null;
  /** Budget on the campaign (Advantage campaign budget). */
  isCbo: boolean;
  dailyBudgetCents: number | null;
  lifetimeBudgetCents: number | null;
  bidStrategy: string | null;
  createdTime: string | null;
  activeAdsets: number;
  metrics: Compare;
  adsManagerUrl: string;
}

export interface AdsetRow {
  id: string;
  name: string;
  campaignId: string;
  status: string;
  effectiveStatus: string;
  dailyBudgetCents: number | null;
  lifetimeBudgetCents: number | null;
  bidStrategy: string | null;
  optimizationGoal: string | null;
  customEvent: string | null;
  temperature: "cold" | "warm" | "unknown";
  audience: string | null;
  learning: { status: LearningStatus; conversions: number | null; lastSigEditAt: string | null; daysSinceEdit: number | null };
  /** Optimization events in the last 7 days (what Meta's learning phase counts), when we can tell. */
  eventsLast7: number | null;
  activeAds: number;
  createdTime: string | null;
  metrics: Compare;
  adsManagerUrl: string;
}

export type FatigueState = "too_early" | "fresh" | "healthy" | "watch" | "fatigued" | "dead" | "inactive";

export interface AdRow {
  id: string;
  name: string;
  adsetId: string;
  campaignId: string;
  status: string;
  effectiveStatus: string;
  createdTime: string | null;
  ageDays: number | null;
  issues: string[];
  creative: {
    mediaType: "video" | "image" | "carousel" | "other";
    thumbnailUrl: string | null;
    imageUrl: string | null;
    headline: string | null;
    primaryText: string | null;
    ctaType: string | null;
    linkUrl: string | null;
    urlTags: string | null;
    /** utm_content set in the URL parameters (or the link itself). */
    hasUtmContent: boolean | null;
  };
  /** The chosen range vs the previous one. */
  metrics: Compare;
  /** Fatigue windows. */
  l7: Metrics | null;
  base14: Metrics | null;
  l30: Metrics | null;
  rankings: { quality: string | null; engagement: string | null; conversion: string | null } | null;
  video: { p25: number; p50: number; p75: number; p100: number; avgWatchSec: number | null } | null;
  /** Last 28 days (top ads only). */
  daily: { date: string; spendCents: number; impressions: number; linkClicks: number; videoViews3s: number }[];
  fatigue: { state: FatigueState; score: number | null; reasons: string[] };
  winner: boolean;
  /** How GHL leads were matched: exact, or by a name several ads share. */
  attribution: "exact" | "shared_name" | "none";
  adsManagerUrl: string;
}

export interface BreakdownRow {
  key: string;
  label: string;
  group: string;
  spendCents: number;
  impressions: number;
  linkClicks: number;
  landingPageViews: number;
  metaLeads: number;
  ctr: number | null;
  cpmCents: number | null;
  lpvRate: number | null;
  share: number | null;
}

export type FunnelKey = "impressions" | "link_clicks" | "landing_page_views" | "leads" | "booked" | "won";

export interface FunnelStage {
  key: FunnelKey;
  label: string;
  cur: number | null;
  prev: number | null;
  /** Conversion from the stage above. */
  rate: number | null;
  prevRate: number | null;
  costPerCents: number | null;
  prevCostPerCents: number | null;
}

export type Severity = "good" | "info" | "warning" | "critical";

export interface TrackingItem {
  key: string;
  severity: "ok" | Severity;
  label: string;
  value: string;
  fix: string | null;
  link: { href: string; label: string } | null;
}

export interface Business {
  newClients: number;
  cashCents: number;
  cacCents: number | null;
  closeRate: number | null;
  setupCoverage: number | null;
  cashRoas: number | null;
}

export interface EntityRef {
  level: "account" | "campaign" | "adset" | "ad";
  id: string | null;
  name: string;
}

export interface Signal {
  kind: string;
  severity: Severity;
  title: string;
  detail: string;
  ref: EntityRef | null;
}

export type PlatformKey = "facebook" | "instagram" | "other" | "unknown";

export interface AdsSnapshot {
  version: 1;
  fetchedAt: string;
  /** Sections that couldn't be fully loaded this time. */
  partial: string[];
  errors: { meta: string | null; ghl: string | null };
  account: AccountInfo;
  range: { key: AdsRange; days: number; since: string; until: string; prevSince: string; prevUntil: string };
  fatigueWindow: { l7: [string, string]; base14: [string, string] };
  totals: Compare;
  today: { spendCents: number; impressions: number; linkClicks: number } | null;
  platforms: { key: PlatformKey; label: string; m: Compare }[];
  /** Current period day by day, aligned with the previous period by position. */
  daily: { date: string; prevDate: string; cur: DailyPoint | null; prev: DailyPoint | null }[];
  weekly: WeeklyPoint[];
  campaigns: CampaignRow[];
  adsets: AdsetRow[];
  ads: AdRow[];
  placements: BreakdownRow[];
  demographics: BreakdownRow[];
  funnel: FunnelStage[];
  tracking: TrackingItem[];
  business: { cur: Business; prev: Business | null };
  signals: Signal[];
  ghl: {
    connected: boolean;
    scanned: number;
    truncated: boolean;
    unattributed: number;
    platformUnknown: number;
    sharedName: number;
  };
  thresholds: Thresholds;
  targetCpb: { cents: number; source: "settings" | "history" | "default" };
}
