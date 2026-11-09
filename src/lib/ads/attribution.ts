import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { scanAdLeads } from "@/lib/ad-leads";
import { adsCache } from "@/lib/ads/cache";
import { addDays, daysBetween, zonedMidnight } from "@/lib/ads/time";
import type { Outcomes } from "@/lib/ads/types";

/**
 * GoHighLevel side of the Ads tab: every Meta lead in the window, kept as a
 * compact, PII-free list (when it came in, which platform, which campaign
 * and ad its UTMs name, booked/won) and joined to ads the same way the
 * Overview's top creatives do: utm_content = the ad's name or id.
 */

export interface CompactLead {
  /** dateAdded, epoch ms. */
  d: number;
  /** Platform: facebook / instagram / other Meta / unknown Meta. */
  p: "f" | "i" | "o" | "u";
  /** utm_campaign, lowercased. */
  c: string | null;
  /** utm_content, lowercased. */
  a: string | null;
  b: 0 | 1;
  w: 0 | 1;
}

export interface LeadScan {
  connected: boolean;
  leads: CompactLead[];
  scanned: number;
  truncated: boolean;
  error: string | null;
  scanSince: string;
  until: string;
}

const norm = (s: string | null | undefined) => {
  const v = (s ?? "").trim().toLowerCase();
  return v || null;
};

const P: Record<string, CompactLead["p"]> = { facebook: "f", instagram: "i", other: "o", unknown: "u" };

/** All Meta leads added between scanSince and until (account days), cached 10 min. */
export async function loadLeads(opts: { ownerId: string; scanSince: string; until: string; tz: string; refresh?: boolean }): Promise<LeadScan> {
  const days = daysBetween(opts.scanSince, opts.until) + 1;
  const empty = (connected: boolean, error: string | null): LeadScan => ({
    connected,
    leads: [],
    scanned: 0,
    truncated: false,
    error,
    scanSince: opts.scanSince,
    until: opts.until,
  });

  const [owner] = await db.select({ loc: users.ghlLocationId }).from(users).where(eq(users.id, opts.ownerId)).limit(1);
  const locationId = owner?.loc ?? null;
  if (!locationId) return empty(false, "GoHighLevel isn't connected, so leads and booked calls can't be counted.");

  const r = await adsCache<LeadScan>({
    userId: opts.ownerId,
    layer: "ghl",
    key: `v1:${days}`,
    ttlMs: 10 * 60 * 1000,
    refresh: opts.refresh,
    isFresh: (v) => v.until === opts.until && v.scanSince === opts.scanSince,
    load: async () => {
      try {
        const scan = await scanAdLeads({
          ownerId: opts.ownerId,
          locationId,
          since: zonedMidnight(opts.scanSince, opts.tz),
          until: new Date(zonedMidnight(addDays(opts.until, 1), opts.tz).getTime() - 1),
          maxPages: 30,
        });
        const leads: CompactLead[] = [];
        for (const c of scan.contacts) {
          if (!c.platform) continue; // not a Meta lead
          const d = new Date(c.contact.dateAdded).getTime();
          if (!Number.isFinite(d)) continue;
          leads.push({ d, p: P[c.platform] ?? "u", c: norm(c.utm?.campaign), a: norm(c.utm?.content), b: c.booked ? 1 : 0, w: c.won ? 1 : 0 });
        }
        return {
          ok: true,
          value: { connected: true, leads, scanned: scan.scanned, truncated: scan.truncated, error: null, scanSince: opts.scanSince, until: opts.until },
        };
      } catch (err) {
        console.error("[ads] GHL lead scan failed:", err instanceof Error ? err.message : err);
        return { ok: false, value: empty(true, "Couldn't load leads from GoHighLevel right now.") };
      }
    },
  });
  return r.value;
}

/** [start, end) instants of an account-day window. */
export function bounds(w: [string, string] | { since: string; until: string }, tz: string): [number, number] {
  const [a, b] = Array.isArray(w) ? w : [w.since, w.until];
  return [zonedMidnight(a, tz).getTime(), zonedMidnight(addDays(b, 1), tz).getTime()];
}

export const inBounds = (l: CompactLead, [a, b]: [number, number]) => l.d >= a && l.d < b;

export function outcomesOf(leads: CompactLead[], win: [number, number], filter?: (l: CompactLead) => boolean): Outcomes {
  const o = { ghlLeads: 0, booked: 0, won: 0 };
  for (const l of leads) {
    if (!inBounds(l, win) || (filter && !filter(l))) continue;
    o.ghlLeads++;
    o.booked += l.b;
    o.won += l.w;
  }
  return o;
}

export interface AdRef {
  id: string;
  name: string;
  campaignId: string;
  adsetId: string;
  /** Spend used to break ties when several ads share a name. */
  spendCents: number;
}

export interface Attribution {
  /** Lead index → ad id (exact or by the shared name's biggest spender). */
  adOf: (l: CompactLead) => string | null;
  campaignOf: (l: CompactLead) => string | null;
  /** Ads whose name other ads share (their counts are a best guess). */
  sharedNameAds: Set<string>;
}

/**
 * How leads map to ads and campaigns. utm_content = ad name or ad id; a name
 * several ads share goes to the one that spent most (flagged as shared).
 * utm_campaign = campaign name or id; otherwise the matched ad's campaign.
 */
export function buildAttribution(ads: AdRef[], campaigns: { id: string; name: string }[]): Attribution {
  const byKey = new Map<string, AdRef[]>();
  const add = (k: string | null, ad: AdRef) => {
    if (!k) return;
    const list = byKey.get(k) ?? [];
    if (!list.some((x) => x.id === ad.id)) list.push(ad);
    byKey.set(k, list);
  };
  for (const ad of ads) {
    add(norm(ad.name), ad);
    add(norm(ad.id), ad);
  }
  const sharedNameAds = new Set<string>();
  const adFor = new Map<string, string>();
  for (const [k, list] of byKey) {
    const best = [...list].sort((a, b) => b.spendCents - a.spendCents)[0];
    adFor.set(k, best.id);
    if (list.length > 1) for (const a of list) sharedNameAds.add(a.id);
  }
  const campaignByKey = new Map<string, string>();
  for (const c of campaigns) {
    const n = norm(c.name);
    if (n) campaignByKey.set(n, c.id);
    campaignByKey.set(c.id.toLowerCase(), c.id);
  }
  const adCampaign = new Map(ads.map((a) => [a.id, a.campaignId]));
  return {
    adOf: (l) => (l.a ? (adFor.get(l.a) ?? null) : null),
    campaignOf: (l) => {
      const ad = l.a ? adFor.get(l.a) : undefined;
      if (ad && adCampaign.get(ad)) return adCampaign.get(ad) ?? null;
      return l.c ? (campaignByKey.get(l.c) ?? null) : null;
    },
    sharedNameAds,
  };
}
