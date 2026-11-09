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
} as const;

export type Thresholds = typeof THRESHOLDS;
