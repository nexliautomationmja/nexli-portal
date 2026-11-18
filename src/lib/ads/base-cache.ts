import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsSnapshots } from "@/db/schema";
import { centsOrNull, type GraphAd, type GraphAdset, type GraphCampaign } from "@/lib/ads/graph";
import type { Structure } from "@/lib/ads/meta-changes-shared";

/**
 * The cached account structure (the snapshot's "base" layer: every campaign,
 * ad set and ad Meta returned, on or off) — read for planning changes in
 * Meta, patched right after one is applied so the page shows it at once.
 * Lives apart from snapshot.ts so the change code doesn't import the
 * snapshot (which imports the changes).
 */

type Base = { campaigns: GraphCampaign[]; adsets: GraphAdset[]; ads: GraphAd[]; until?: string } & Record<string, unknown>;

const whereBase = (ownerId: string, accountId: string) =>
  and(eq(analyticsSnapshots.userId, ownerId), eq(analyticsSnapshots.source, "ads-base"), sql`${analyticsSnapshots.data}->>'rangeKey' = ${`v1:${accountId}`}`);

async function baseRow(ownerId: string, accountId: string): Promise<{ id: string; data: { rangeKey: string; result?: Base } } | null> {
  const [row] = await db
    .select({ id: analyticsSnapshots.id, data: analyticsSnapshots.data })
    .from(analyticsSnapshots)
    .where(whereBase(ownerId, accountId))
    .orderBy(desc(analyticsSnapshots.createdAt))
    .limit(1);
  return row ? { id: row.id, data: row.data as { rangeKey: string; result?: Base } } : null;
}

/** Everything in the account as last cached, with each ad's 30-day spend when given. */
export async function metaStructure(ownerId: string, accountId: string, spend30?: Map<string, number>): Promise<Structure | null> {
  const row = await baseRow(ownerId, accountId).catch(() => null);
  const B = row?.data.result;
  if (!B) return null;
  const gone = (s: string | undefined) => s === "DELETED" || s === "ARCHIVED";
  return {
    campaigns: B.campaigns
      .filter((c) => !gone(c.effective_status))
      .map((c) => {
        const daily = centsOrNull(c.daily_budget);
        const lifetime = centsOrNull(c.lifetime_budget);
        return { id: c.id, name: c.name ?? c.id, status: c.status ?? "PAUSED", effectiveStatus: c.effective_status ?? "PAUSED", isCbo: Boolean(daily || lifetime), dailyBudgetCents: daily, lifetimeBudgetCents: lifetime };
      }),
    adsets: B.adsets
      .filter((a) => !gone(a.effective_status))
      .map((a) => ({
        id: a.id,
        name: a.name ?? a.id,
        campaignId: a.campaign_id ?? "",
        status: a.status ?? "PAUSED",
        effectiveStatus: a.effective_status ?? "PAUSED",
        dailyBudgetCents: centsOrNull(a.daily_budget),
        lifetimeBudgetCents: centsOrNull(a.lifetime_budget),
      })),
    ads: B.ads
      .filter((a) => !gone(a.effective_status))
      .map((a) => ({
        id: a.id,
        name: a.name ?? a.id,
        adsetId: a.adset_id ?? "",
        campaignId: a.campaign_id ?? "",
        status: a.status ?? "PAUSED",
        effectiveStatus: a.effective_status ?? "PAUSED",
        spend30Cents: spend30?.get(a.id) ?? 0,
      })),
  };
}

/** Change the cached structure in place (e.g. an ad just turned off). Never throws. */
export async function patchBase(ownerId: string, accountId: string, edit: (b: Base) => void): Promise<void> {
  try {
    const row = await baseRow(ownerId, accountId);
    if (!row?.data.result) return;
    const next = structuredClone(row.data);
    edit(next.result as Base);
    await db.update(analyticsSnapshots).set({ data: next }).where(eq(analyticsSnapshots.id, row.id));
  } catch (err) {
    console.error("[ads] base cache patch failed:", err instanceof Error ? err.message : err);
  }
}

/** Mark the cached structure old so the next page load asks Meta again (it stays as the fallback). Never throws. */
export async function staleBase(ownerId: string, accountId: string): Promise<void> {
  try {
    await db.update(analyticsSnapshots).set({ createdAt: new Date(0) }).where(whereBase(ownerId, accountId));
  } catch (err) {
    console.error("[ads] base cache mark-stale failed:", err instanceof Error ? err.message : err);
  }
}
