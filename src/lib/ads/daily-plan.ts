import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { adDailyPlans } from "@/lib/ads/tables";
import { getSettings } from "@/lib/ads/settings";
import { snapshot30 } from "@/lib/ads/pack";
import { cachedTimezone } from "@/lib/ads/snapshot";
import { localDate } from "@/lib/ads/time";
import { decideAds, type AdPlan } from "@/lib/ads/decide";
import { fallbackMake, loadTags, tagCreatives, writeMakeCards } from "@/lib/ads/creative-ai";
import { stopCards, typeStats, type MakeCard, type StopCard, type TypeStat } from "@/lib/ads/creative-types";
import { loadTrackingData } from "@/lib/ads/tracking-data";
import { trackingVerdict, type TrackingSeverity, type TrackingStatus } from "@/lib/ads/tracking-check";
import { notifyDailyPlan } from "@/lib/ads/notify";

/**
 * The morning plan: once a day (07:00 in the ad account's timezone, or when
 * the page asks for it first) the Cut / Keep calls are made from the latest
 * complete day, the creatives get tagged, Claude writes what to make, the
 * tracking is checked — and, only when something needs Marcel, he's emailed.
 * The page shows the calls live (same rules, current numbers); this keeps
 * the morning's version, the "what to make" cards and the email.
 */

export interface PlanMake {
  cards: MakeCard[];
  stop: StopCard[];
  types: TypeStat[];
  source: "claude" | "fallback" | "none";
}

export interface PlanTracking {
  status: TrackingStatus;
  severity: TrackingSeverity;
  title: string;
  detail: string;
}

export interface DailyPlanView {
  id: string;
  planDate: string;
  status: "making" | "done" | "failed";
  throughDate: string | null;
  plan: AdPlan | null;
  make: PlanMake | null;
  tracking: PlanTracking | null;
  actionable: boolean;
  error: string | null;
  seen: boolean;
  createdAt: string;
}

type Row = typeof adDailyPlans.$inferSelect;

export const planView = (r: Row): DailyPlanView => ({
  id: r.id,
  planDate: r.planDate,
  status: r.status,
  throughDate: r.throughDate,
  plan: (r.plan as AdPlan | null) ?? null,
  make: (r.make as PlanMake | null) ?? null,
  tracking: (r.tracking as PlanTracking | null) ?? null,
  actionable: r.actionable,
  error: r.error,
  seen: Boolean(r.seenAt),
  createdAt: r.createdAt.toISOString(),
});

/** The newest plan (today's, or the last one made). */
export async function latestPlan(ownerId: string, accountId: string): Promise<Row | null> {
  const [row] = await db
    .select()
    .from(adDailyPlans)
    .where(and(eq(adDailyPlans.ownerId, ownerId), eq(adDailyPlans.accountId, accountId)))
    .orderBy(desc(adDailyPlans.planDate))
    .limit(1);
  return row ?? null;
}

/** Today in the ad account's timezone. */
export async function planDateFor(ownerId: string, accountId: string): Promise<string> {
  return localDate(new Date(), await cachedTimezone(ownerId, accountId));
}

const STUCK_MS = 10 * 60 * 1000;

/**
 * Make today's plan unless it exists (or is being made). Claimed through the
 * unique (owner, account, day) row, so the cron and the page can't double up;
 * a run stuck in "making" for 10 minutes, or a failed one, can be redone.
 */
export async function makeDailyPlan(ownerId: string, accountId: string, opts: { deadline?: number } = {}): Promise<Row | null> {
  const planDate = await planDateFor(ownerId, accountId);
  let [row] = await db.insert(adDailyPlans).values({ ownerId, accountId, planDate }).onConflictDoNothing().returning();
  if (!row) {
    [row] = await db
      .update(adDailyPlans)
      .set({ status: "making", error: null, updatedAt: new Date() })
      .where(
        and(
          eq(adDailyPlans.ownerId, ownerId),
          eq(adDailyPlans.accountId, accountId),
          eq(adDailyPlans.planDate, planDate),
          or(eq(adDailyPlans.status, "failed"), and(eq(adDailyPlans.status, "making"), lt(adDailyPlans.updatedAt, new Date(Date.now() - STUCK_MS))))
        )
      )
      .returning();
    if (!row) return null; // already made, or being made right now
  }

  try {
    const settings = await getSettings(ownerId, accountId);
    const s = await snapshot30(ownerId, accountId, settings);
    if (!s) throw new Error("Meta ads aren't connected.");
    if (s.errors.meta) throw new Error(s.errors.meta);

    const deadline = opts.deadline ?? Date.now() + 240_000;
    // Up to 16 new creatives a run (the rest the next run) so the morning job fits its time.
    const tagRun = await tagCreatives(ownerId, accountId, s.ads, { deadline, max: 16 }).catch((err) => ({ tagged: 0, error: err instanceof Error ? err.message : String(err) }));
    const tags = await loadTags(ownerId, accountId);
    const plan = decideAds(s);
    const types = typeStats(s.ads, tags, { cpbCents: plan.targets.cpbCents, cplCents: plan.targets.cplCents });
    const made =
      plan.need.add > 0 && Date.now() < deadline - 45_000
        ? await writeMakeCards({ add: plan.need.add, types, ads: s.ads, tags, plan, context: settings.context, timeoutMs: deadline - Date.now() - 20_000 })
        : { cards: fallbackMake({ add: plan.need.add, ads: s.ads, tags, plan }), source: "fallback" as const };
    const make: PlanMake = { cards: made.cards, stop: stopCards(types), types, source: plan.need.add > 0 ? made.source : "none" };

    const data = await loadTrackingData(ownerId, accountId).catch(() => null);
    const v = trackingVerdict({ data, snapshot: s });
    const tracking: PlanTracking = { status: v.status, severity: v.severity, title: v.title, detail: v.detail };

    const actionable = plan.counts.cut > 0 || plan.need.when === "today" || v.severity === "warning" || v.severity === "critical";
    const [saved] = await db
      .update(adDailyPlans)
      .set({
        status: "done",
        throughDate: s.range.until,
        plan,
        make,
        tracking,
        actionable,
        error: tagRun.error ? `Creative tagging: ${tagRun.error}`.slice(0, 500) : null,
        updatedAt: new Date(),
      })
      .where(eq(adDailyPlans.id, row.id))
      .returning();
    if (actionable) await notifyDailyPlan(saved).catch((err) => console.error("[ads] daily plan email failed:", err instanceof Error ? err.message : err));
    return saved;
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    console.error("[ads] daily plan failed:", message);
    const [failed] = await db.update(adDailyPlans).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(adDailyPlans.id, row.id)).returning();
    return failed ?? null;
  }
}

export async function markPlanSeen(ownerId: string, id: string): Promise<void> {
  await db
    .update(adDailyPlans)
    .set({ seenAt: new Date() })
    .where(and(eq(adDailyPlans.id, id), eq(adDailyPlans.ownerId, ownerId)));
}
