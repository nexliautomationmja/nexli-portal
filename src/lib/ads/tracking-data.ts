import { scanAdLeads } from "@/lib/ad-leads";
import { adsCache } from "@/lib/ads/cache";
import { adsCreds, insights, newBudget, rawOf, type InsightRow } from "@/lib/ads/graph";
import { buildAttribution, compactLeads, ghlLocationOf, loadLeads, type CompactLead } from "@/lib/ads/attribution";
import { cachedTimezone } from "@/lib/ads/snapshot";
import { addDays, dateList, localDate, zonedMidnight } from "@/lib/ads/time";
import type { LiveAd, LiveToday, TrackingData, TrackingDay } from "@/lib/ads/tracking-check";

/**
 * What the tracking check compares: the last 14 complete days (Meta's leads
 * dated by when they happened, against GoHighLevel's), cached 30 minutes,
 * and today so far (Meta's live numbers and today's CRM leads, per ad),
 * cached 2 minutes so the page can refresh every minute without hammering
 * Meta.
 */

const DAYS = 14;

interface DaysLayer {
  through: string;
  days: TrackingDay[];
  crmConnected: boolean;
  lastLeadAt: string | null;
  errors: string[];
}

export async function loadTrackingData(ownerId: string, accountId: string, opts: { refresh?: boolean } = {}): Promise<TrackingData | null> {
  const creds = adsCreds(accountId);
  if (!creds) return null;
  const tz = await cachedTimezone(ownerId, accountId);
  const today = localDate(new Date(), tz);
  const until = addDays(today, -1);
  const since = addDays(until, -(DAYS - 1));

  const daysLayer = adsCache<DaysLayer>({
    userId: ownerId,
    layer: "tracking-days",
    key: `v1:${creds.account}`,
    ttlMs: 30 * 60 * 1000,
    refresh: opts.refresh,
    isFresh: (v) => v.through === until,
    load: async () => {
      const errors: string[] = [];
      const [meta, scan] = await Promise.all([
        insights(creds, newBudget(30_000), { level: "account", range: { since, until }, timeIncrement: 1, fields: "lean", actionReportTime: "conversion", label: "leads by day", maxPages: 1 }),
        loadLeads({ ownerId, scanSince: since, until, tz }),
      ]);
      if (meta.error) errors.push(`Meta: ${meta.error}`);
      if (scan.error && scan.connected) errors.push(scan.error);
      const byDay = new Map<string, InsightRow>();
      for (const r of meta.rows) if (r.date_start) byDay.set(r.date_start, r);
      const crm = new Map<string, { leads: number; booked: number }>();
      let last = 0;
      for (const l of scan.leads) {
        const d = localDate(new Date(l.d), tz);
        const o = crm.get(d) ?? { leads: 0, booked: 0 };
        o.leads++;
        o.booked += l.b;
        crm.set(d, o);
        last = Math.max(last, l.d);
      }
      const days = dateList(since, until).map((date) => {
        const raw = rawOf(byDay.get(date));
        return { date, spendCents: raw.spendCents, metaLeads: raw.metaLeads, crmLeads: crm.get(date)?.leads ?? 0, booked: crm.get(date)?.booked ?? 0 };
      });
      return { ok: !meta.error && !(scan.connected && scan.error), value: { through: until, days, crmConnected: scan.connected, lastLeadAt: last ? new Date(last).toISOString() : null, errors } };
    },
  });

  const liveLayer = adsCache<LiveToday>({
    userId: ownerId,
    layer: "tracking-live",
    key: `v1:${creds.account}`,
    ttlMs: 2 * 60 * 1000,
    isFresh: (v) => v.date === today,
    load: async () => {
      const budget = newBudget(25_000);
      const [acct, ads, leads] = await Promise.all([
        insights(creds, budget, { level: "account", datePreset: "today", fields: "lean", actionReportTime: "conversion", label: "today", maxPages: 1 }),
        insights(creds, budget, { level: "ad", datePreset: "today", fields: "lean", actionReportTime: "conversion", label: "today by ad", maxPages: 2 }),
        crmToday(ownerId, today, tz),
      ]);
      const raw = rawOf(acct.rows[0]);
      const adRows = ads.rows.filter((r) => r.ad_id);
      const attribution = buildAttribution(
        adRows.map((r) => ({ id: r.ad_id as string, name: r.ad_name ?? (r.ad_id as string), campaignId: r.campaign_id ?? "", adsetId: r.adset_id ?? "", spendCents: rawOf(r).spendCents })),
        []
      );
      const crmByAd = new Map<string, number>();
      let unmatched = 0;
      for (const l of leads.leads) {
        const id = attribution.adOf(l);
        if (id) crmByAd.set(id, (crmByAd.get(id) ?? 0) + 1);
        else unmatched++;
      }
      const list: LiveAd[] = adRows
        .map((r) => {
          const x = rawOf(r);
          return { adId: r.ad_id as string, name: r.ad_name ?? (r.ad_id as string), spendCents: x.spendCents, linkClicks: x.linkClicks, metaLeads: x.metaLeads, crmLeads: crmByAd.get(r.ad_id as string) ?? 0 };
        })
        .filter((a) => a.spendCents > 0 || a.metaLeads > 0 || a.crmLeads > 0)
        .sort((a, b) => b.spendCents - a.spendCents)
        .slice(0, 12);
      const last = leads.leads.reduce((t, l) => Math.max(t, l.d), 0);
      const error = acct.error ? "Meta's live numbers didn't load — showing what we have." : leads.error;
      return {
        ok: !acct.error,
        value: {
          date: today,
          spendCents: raw.spendCents,
          impressions: raw.impressions,
          linkClicks: raw.linkClicks,
          landingPageViews: raw.landingPageViews,
          metaLeads: raw.metaLeads,
          crmLeads: leads.leads.length,
          booked: leads.leads.reduce((t, l) => t + l.b, 0),
          unmatched,
          lastCrmLeadAt: last ? new Date(last).toISOString() : null,
          ads: list,
          at: new Date().toISOString(),
          error,
        },
      };
    },
  });

  const [d, lv] = await Promise.all([daysLayer, liveLayer]);
  const live = lv.value;
  return {
    tz,
    through: until,
    days: d.value.days,
    daysAt: d.cachedAt.toISOString(),
    crmConnected: d.value.crmConnected,
    // Today's last lead, else the last one in the 14 days.
    live: live ? { ...live, lastCrmLeadAt: live.lastCrmLeadAt ?? d.value.lastLeadAt } : null,
    errors: d.value.errors,
  };
}

/** Today's Meta leads in GoHighLevel (since local midnight). */
async function crmToday(ownerId: string, today: string, tz: string): Promise<{ leads: CompactLead[]; error: string | null }> {
  const locationId = await ghlLocationOf(ownerId);
  if (!locationId) return { leads: [], error: "GoHighLevel isn't connected." };
  try {
    const scan = await scanAdLeads({ ownerId, locationId, since: zonedMidnight(today, tz), until: new Date(), maxPages: 3 });
    return { leads: compactLeads(scan.contacts), error: null };
  } catch (err) {
    console.error("[ads] today's CRM scan failed:", err instanceof Error ? err.message : err);
    return { leads: [], error: "Couldn't read today's leads from GoHighLevel just now." };
  }
}
