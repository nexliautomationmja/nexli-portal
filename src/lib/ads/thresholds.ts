/**
 * The rules of thumb the Ads tab and Manus judge ads by (pure, client-safe).
 * Explicit numbers so the fatigue board, the signals and the data pack all
 * say the same thing — and Marcel can see why an ad was flagged.
 */
export const THRESHOLDS = {
  // Below these an ad is "too early" to judge.
  minImpressions: 1000,
  minSpendCents: 2000,
  minActiveDays: 5,
  // 7-day frequency (cold / warm audiences).
  freqWatch: { cold: 2.5, warm: 5 },
  freqFatigued: { cold: 3.5, warm: 8 },
  // Link CTR, last 7 days vs the 14 days before.
  ctrDropWatch: -0.15,
  ctrDropFatigued: -0.2,
  ctrDropSevere: -0.3,
  /** One-sided two-proportion z at ~95%. */
  zSignificant: -1.64,
  cpcRiseSevere: 0.3,
  cpmRiseWatch: 0.25,
  // Video hook rate (3-second views ÷ impressions).
  hookDropWatch: -0.15,
  hookDropFatigued: -0.25,
  hookMinImpressions: 2000,
  // Dead ads.
  deadMinImpressions: 3000,
  deadCtr: 0.004,
  deadSpendMultiple: 2,
  deadSpendFloorCents: 30000,
  // Account-level.
  accountCpmSpike: 0.35,
  unattributedWarn: 0.2,
  unattributedCritical: 0.4,
  metaGhlGapWarn: 0.3,
  lpvRateWarn: 0.6,
  pixelStaleHours: 24,
  learningEventsPerWeek: 50,
  recentEditDays: 3,
  minActiveCreativesPerAdset: 3,
  winnerConcentration: 0.7,
  cpbOverTarget: 1.25,
  cpbUnderTarget: 0.8,
  pacingTolerance: 0.15,
  /** Below these, deltas are shown but not trusted. */
  lowVolume: { booked: 3, leads: 5, impressions: 5000 },
  /** When there's no target and no history to learn one from. */
  defaultTargetCpbCents: 50000,
  // The daily Cut / Keep calls (decide.ts). T = target cost per booked call, L = target cost per lead.
  /** Cut: spent 2T with no booked call (once it's 5+ days old). */
  cutNoBookedSpendX: 2,
  cutNoBookedMinDays: 5,
  /** Cut: spent 3L with no lead (once it's 3+ days old). */
  cutNoLeadsSpendX: 3,
  cutNoLeadsMinDays: 3,
  /** Cut: booked calls cost 2T or more, once it has spent 3T. */
  cutExpensiveCpbX: 2,
  cutExpensiveSpendX: 3,
  /** Cut a worn-out (fatigued) non-winner whose leads cost this many L. */
  cutWornCplX: 1.5,
  /** Live creatives to aim for per ad set (retargeting: the floor), the floor, and the most to ask for at once. */
  idealLiveCreatives: 5,
  minLiveCreatives: 3,
  maxAddPerAdset: 8,
  // Early read (early-read.ts): a new creative whose hook or clicks are clearly weak after a first look.
  /** Impressions before an early read is trusted. */
  earlyMinImpressions: 1500,
  /** Only new creatives (days since created). */
  earlyMaxAgeDays: 14,
  /** Weak = under this share of the benchmark median (and significantly lower). */
  earlyRatio: 0.6,
  /** Benchmark ads need this many impressions in 30 days, and there must be this many of them. */
  earlyBenchMinImpressions: 3000,
  earlyMinBenchAds: 3,
} as const;

export type Thresholds = typeof THRESHOLDS;
