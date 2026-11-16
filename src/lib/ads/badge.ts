import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * The Ads sidebar badge: an unseen finished analysis, a run waiting on
 * Marcel, steps whose check-back date has come, plus today's plan when it
 * needs him and he hasn't opened it. One statement, no DDL —
 * before the tables exist it throws and the caller shows 0.
 */
export async function adsBadgeCount(ownerId: string): Promise<number> {
  const res = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM ad_analyses WHERE owner_id = ${ownerId} AND ((status = 'done' AND seen_at IS NULL) OR status = 'waiting'))
      + (SELECT count(*)::int FROM ad_steps WHERE owner_id = ${ownerId} AND status IN ('open', 'done') AND check_back_at <= now() AND checked_at IS NULL)
      + COALESCE((SELECT count(*)::int FROM ad_daily_plans WHERE owner_id = ${ownerId} AND status = 'done' AND actionable AND seen_at IS NULL AND created_at > now() - interval '2 days'), 0)
      AS n
  `);
  const rows = (res as unknown as { rows?: { n?: number | string }[] }).rows ?? (res as unknown as { n?: number | string }[]);
  const n = Number(Array.isArray(rows) ? rows[0]?.n : 0);
  return Number.isFinite(n) ? n : 0;
}
