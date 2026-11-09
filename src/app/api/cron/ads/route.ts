import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { metaAdAccountId, metaAdsConfigured } from "@/lib/meta-ads";
import { getNexliAdminId } from "@/lib/foundation-project";
import { adAnalyses, adSettings, ensureAdsTables } from "@/lib/ads/tables";
import { getSettings } from "@/lib/ads/settings";
import { activeAnalysis, advanceAnalysis, analysesToAdvance, enqueueAnalysis, pruneOldPacks } from "@/lib/ads/analysis-service";
import { notifyCheckBacks, notifyNeedsInput, notifyReady } from "@/lib/ads/notify";
import { cachedTimezone } from "@/lib/ads/snapshot";
import { pruneAdsCache } from "@/lib/ads/cache";
import { weekKey, weeklyDue } from "@/lib/ads/time";
import { manusConfigured } from "@/lib/creative-studio/manus";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Every 10 minutes: check-back reminders, "ready" / "needs you" alerts that
 * weren't sent yet, keep running analyses moving when no page is open, start
 * the Monday analysis (07:00 in the ad account's timezone, once per week),
 * and tidy old caches once a day. Every send and start is claimed, so
 * overlapping runs can't double up.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!metaAdsConfigured()) return NextResponse.json({ skipped: "Meta ads aren't configured" });
  const started = Date.now();
  const deadline = started + 240_000;
  await ensureAdsTables();
  const ownerId = await getNexliAdminId();
  const accountId = metaAdAccountId();
  if (!ownerId || !accountId) return NextResponse.json({ skipped: "No Nexli admin or ad account" });

  const out = { weekly: "not_due" as string, advanced: 0, notified: 0, reminders: 0, errors: [] as string[] };
  const note = (label: string, err: unknown) => {
    const m = `${label}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300);
    out.errors.push(m);
    console.error("[cron/ads]", m);
  };

  // 1. Check-backs that came due.
  try {
    out.reminders = await notifyCheckBacks(ownerId, accountId);
  } catch (err) {
    note("reminders", err);
  }

  // 2. Alerts not sent yet (e.g. a run that finished while the page was polling).
  try {
    const unsent = await db
      .select()
      .from(adAnalyses)
      .where(and(eq(adAnalyses.status, "done"), isNull(adAnalyses.notifiedAt), gt(adAnalyses.finishedAt, new Date(Date.now() - 3 * 86400000))))
      .limit(5);
    for (const row of unsent) {
      await notifyReady(row);
      out.notified++;
    }
    const waiting = await db.select().from(adAnalyses).where(eq(adAnalyses.status, "waiting")).limit(5);
    for (const row of waiting) await notifyNeedsInput(row);
  } catch (err) {
    note("alerts", err);
  }

  // 3. Keep running analyses moving.
  try {
    for (const row of await analysesToAdvance()) {
      if (Date.now() > deadline - 30_000) break;
      await advanceAnalysis(row, { deadline });
      out.advanced++;
    }
  } catch (err) {
    note("advance", err);
  }

  // 4. The Monday analysis.
  try {
    const settings = await getSettings(ownerId, accountId);
    const tz = await cachedTimezone(ownerId, accountId);
    const now = new Date();
    const wk = weekKey(now, tz);
    if (!settings.weeklyAuto) out.weekly = "off";
    else if (!manusConfigured()) out.weekly = "no_manus";
    else if (!settings.lastWeeklyKey) {
      // First run after the feature arrived: start counting from next Monday (no surprise credit spend).
      await db
        .update(adSettings)
        .set({ lastWeeklyKey: wk })
        .where(and(eq(adSettings.ownerId, ownerId), eq(adSettings.accountId, accountId), isNull(adSettings.lastWeeklyKey)));
      out.weekly = "initialized";
    } else if (settings.lastWeeklyKey === wk) out.weekly = "done";
    else if (weeklyDue(now, tz)) {
      const [claimed] = await db
        .update(adSettings)
        .set({ lastWeeklyKey: wk })
        .where(and(eq(adSettings.ownerId, ownerId), eq(adSettings.accountId, accountId), sql`${adSettings.lastWeeklyKey} IS DISTINCT FROM ${wk}`))
        .returning();
      if (claimed) {
        const running = await activeAnalysis(ownerId, accountId);
        const [recent] = await db
          .select({ id: adAnalyses.id })
          .from(adAnalyses)
          .where(and(eq(adAnalyses.ownerId, ownerId), eq(adAnalyses.accountId, accountId), eq(adAnalyses.status, "done"), gt(adAnalyses.finishedAt, new Date(Date.now() - 86400000))))
          .limit(1);
        if (running || recent) out.weekly = "covered";
        else {
          const { row } = await enqueueAnalysis({ ownerId, accountId, trigger: "weekly", weekKey: wk, agentProfile: claimed.agentProfile });
          out.weekly = "queued";
          if (Date.now() < deadline - 60_000) {
            await advanceAnalysis(row, { deadline });
            out.weekly = "started";
          }
        }
      }
    }
  } catch (err) {
    note("weekly", err);
  }

  // 5. Tidy up once a day.
  const at = new Date();
  if (at.getUTCHours() === 9 && at.getUTCMinutes() < 10) {
    try {
      await pruneAdsCache(7);
      await pruneOldPacks();
    } catch (err) {
      note("cleanup", err);
    }
  }

  await db
    .update(adSettings)
    .set({ lastCronAt: new Date(), lastCronError: out.errors.length ? out.errors.join(" | ").slice(0, 1000) : null })
    .where(and(eq(adSettings.ownerId, ownerId), eq(adSettings.accountId, accountId)))
    .catch(() => {});
  return NextResponse.json({ ...out, ms: Date.now() - started });
}
