import { scanAdLeads } from "@/lib/ad-leads";
import { adsCache } from "@/lib/ads/cache";
import { adsCreds, insights, newBudget, rawOf } from "@/lib/ads/graph";
import { buildAttribution, ghlLocationOf } from "@/lib/ads/attribution";
import { cachedAdCreatives, cachedTimezone } from "@/lib/ads/snapshot";
import { loadCorrections } from "@/lib/ads/corrections";
import { applyLeadCorrections } from "@/lib/ads/corrections-shared";
import { addDays, localDate, zonedMidnight } from "@/lib/ads/time";
import {
  VSL_SINCE,
  buildVslBoard,
  hasAdvisoryBookedTag,
  isQualifiedTag,
  vslOfContact,
  vslOfUrl,
  type VslBoard,
  type VslLead,
} from "@/lib/ads/vsl-shared";

/**
 * The VSL scoreboard (server): every contact created since the four VSL
 * funnels went live, tagged with the VSL that brought it in, plus what each
 * ad spent over the same days. Its own GoHighLevel scan (the snapshot's lead
 * list keeps no tags), cached 15 minutes. Marcel's lead corrections from the
 * Ask chat apply here too.
 */

interface VslLayer {
  since: string;
  until: string;
  connected: boolean;
  leads: VslLead[];
  spend: { adId: string; name: string; spendCents: number }[];
  scanned: number;
  truncated: boolean;
  error: string | null;
}

const P_META = new Set(["facebook", "instagram", "other", "unknown"]);
const norm = (s: string | null | undefined) => {
  const v = (s ?? "").trim().toLowerCase();
  return v || null;
};

async function loadVslData(ownerId: string, accountId: string, opts: { refresh?: boolean } = {}): Promise<VslLayer | null> {
  const creds = adsCreds(accountId);
  const tz = await cachedTimezone(ownerId, accountId);
  const today = localDate(new Date(), tz);
  // Through today (leads book the same day); never more than 180 days back.
  const until = today;
  const since = VSL_SINCE > addDays(until, -179) ? VSL_SINCE : addDays(until, -179);
  const r = await adsCache<VslLayer>({
    userId: ownerId,
    layer: "vsl",
    key: `v1:${accountId}`,
    ttlMs: 15 * 60 * 1000,
    refresh: opts.refresh,
    isFresh: (v) => v.until === until && v.since === since,
    load: async () => {
      const locationId = await ghlLocationOf(ownerId);
      const empty: VslLayer = { since, until, connected: Boolean(locationId), leads: [], spend: [], scanned: 0, truncated: false, error: null };
      if (!locationId) return { ok: true, value: { ...empty, error: "GoHighLevel isn't connected, so VSL leads can't be counted." } };
      const [scan, spend] = await Promise.all([
        scanAdLeads({ ownerId, locationId, since: zonedMidnight(since, tz), until: new Date(zonedMidnight(addDays(until, 1), tz).getTime() - 1), maxPages: 30 }).catch((err) => {
          console.error("[ads] VSL lead scan failed:", err instanceof Error ? err.message : err);
          return null;
        }),
        creds
          ? insights(creds, newBudget(25_000), { level: "ad", range: { since, until }, fields: "lean", label: "VSL ad spend", maxPages: 3 })
          : Promise.resolve({ rows: [], error: null, truncated: false }),
      ]);
      if (!scan) return { ok: false, value: { ...empty, error: "Couldn't read leads from GoHighLevel right now." } };
      const leads: VslLead[] = [];
      for (const c of scan.contacts) {
        const as = vslOfContact(c.contact);
        if (!as.v) continue;
        const d = new Date(c.contact.dateAdded).getTime();
        if (!Number.isFinite(d)) continue;
        const booked = c.booked || hasAdvisoryBookedTag(c.contact.tags);
        leads.push({
          i: c.contact.id,
          d,
          v: as.v,
          how: as.how,
          q: isQualifiedTag(c.contact.tags) || booked ? 1 : 0,
          b: booked ? 1 : 0,
          w: c.won ? 1 : 0,
          m: c.platform && P_META.has(c.platform) ? 1 : 0,
          a: norm(c.utm?.content),
        });
      }
      const byAd = new Map<string, { adId: string; name: string; spendCents: number }>();
      for (const row of spend.rows) {
        if (!row.ad_id) continue;
        const cur = byAd.get(row.ad_id) ?? { adId: row.ad_id, name: row.ad_name ?? row.ad_id, spendCents: 0 };
        cur.spendCents += rawOf(row).spendCents;
        byAd.set(row.ad_id, cur);
      }
      return {
        ok: true,
        value: {
          since,
          until,
          connected: true,
          leads,
          spend: [...byAd.values()],
          scanned: scan.scanned,
          truncated: scan.truncated,
          error: spend.error ? "Meta's spend didn't load, so cost per lead isn't shown." : null,
        },
      };
    },
  });
  return r.value;
}

/** The scoreboard (corrections applied). null when GoHighLevel isn't connected. */
export async function vslBoardFor(ownerId: string, accountId: string, opts: { refresh?: boolean } = {}): Promise<VslBoard | null> {
  const [data, corrections, creatives] = await Promise.all([loadVslData(ownerId, accountId, opts), loadCorrections(ownerId, accountId), cachedAdCreatives(ownerId, accountId).catch(() => new Map())]);
  if (!data || !data.connected) return null;
  const leads = applyLeadCorrections(data.leads, corrections.fixes);
  const attribution = buildAttribution(
    data.spend.map((s) => ({ id: s.adId, name: creatives.get(s.adId)?.name ?? s.name, campaignId: "", adsetId: "", spendCents: s.spendCents })),
    []
  );
  return buildVslBoard({
    leads,
    spend: data.spend.map((s) => ({ adId: s.adId, spendCents: s.spendCents, vsl: vslOfUrl(creatives.get(s.adId)?.linkUrl ?? null) })),
    adOf: (l) => attribution.adOf({ d: l.d, p: "u", c: null, a: l.a, b: l.b, w: l.w }),
    since: data.since,
    until: data.until,
    now: Date.now(),
    scanned: data.scanned,
    truncated: data.truncated,
    error: data.error,
    correctionsApplied: corrections.fixes.filter((f) => data.leads.some((l) => l.i === f.contactId)).length,
  });
}
