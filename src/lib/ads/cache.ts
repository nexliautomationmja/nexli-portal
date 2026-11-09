import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsSnapshots } from "@/db/schema";

/**
 * The Ads tab's cache (analyticsSnapshots, source "ads-<layer>"). Keys never
 * contain dates, so each layer keeps one row that gets replaced; freshness is
 * the TTL plus `isFresh` (e.g. "still ends yesterday"). Failed loads are never
 * stored and fall back to the last good value.
 */
export async function adsCache<T>(opts: {
  userId: string;
  layer: string;
  key: string;
  ttlMs: number;
  refresh?: boolean;
  isFresh?: (value: T) => boolean;
  load: () => Promise<{ ok: boolean; value: T }>;
}): Promise<{ value: T; cachedAt: Date; fromCache: boolean; stale: boolean }> {
  const source = `ads-${opts.layer}`;
  const where = and(
    eq(analyticsSnapshots.userId, opts.userId),
    eq(analyticsSnapshots.source, source),
    sql`${analyticsSnapshots.data}->>'rangeKey' = ${opts.key}`
  );
  let cached: { data: unknown; createdAt: Date } | undefined;
  try {
    [cached] = await db
      .select({ data: analyticsSnapshots.data, createdAt: analyticsSnapshots.createdAt })
      .from(analyticsSnapshots)
      .where(where)
      .orderBy(desc(analyticsSnapshots.createdAt))
      .limit(1);
  } catch (err) {
    console.error(`[ads] cache read failed (${source}, continuing):`, err instanceof Error ? err.message : err);
  }
  const cachedValue = (cached?.data as { result?: T } | undefined)?.result;
  const cachedAt = cached ? new Date(cached.createdAt) : null;
  if (
    !opts.refresh &&
    cachedValue !== undefined &&
    cachedAt &&
    Date.now() - cachedAt.getTime() < opts.ttlMs &&
    (!opts.isFresh || opts.isFresh(cachedValue))
  ) {
    return { value: cachedValue, cachedAt, fromCache: true, stale: false };
  }

  const live = await opts.load();
  if (live.ok) {
    const now = new Date();
    try {
      await db.delete(analyticsSnapshots).where(where);
      await db.insert(analyticsSnapshots).values({
        userId: opts.userId,
        source,
        periodStart: now,
        periodEnd: now,
        data: { rangeKey: opts.key, result: live.value },
      });
    } catch (err) {
      console.error(`[ads] cache write failed (${source}, continuing):`, err instanceof Error ? err.message : err);
    }
    return { value: live.value, cachedAt: now, fromCache: false, stale: false };
  }
  if (cachedValue !== undefined && cachedAt) return { value: cachedValue, cachedAt, fromCache: true, stale: true };
  return { value: live.value, cachedAt: new Date(), fromCache: false, stale: false };
}

/** Old cache rows (the cron tidies up). */
export async function pruneAdsCache(olderThanDays = 7): Promise<void> {
  await db.execute(
    sql`DELETE FROM ${analyticsSnapshots} WHERE ${analyticsSnapshots.source} LIKE 'ads-%' AND ${analyticsSnapshots.createdAt} < now() - make_interval(days => ${Math.max(1, Math.round(olderThanDays))})`
  );
}
