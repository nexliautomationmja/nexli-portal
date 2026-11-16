import { change, count } from "@/lib/ads/format";
import type { AdsSnapshot, TrackingItem } from "@/lib/ads/types";

/**
 * Can Meta's numbers be trusted? (pure, client-safe). Lines Meta's lead count
 * up against the CRM (GoHighLevel, the source of truth) — the last 7 days,
 * day by day, today so far and per ad — and says in plain words what's off
 * and exactly how to fix it.
 */

export interface TrackingDay {
  date: string;
  spendCents: number;
  /** Leads Meta counted, dated by when they happened. */
  metaLeads: number;
  /** Meta leads that reached GoHighLevel that day. */
  crmLeads: number;
  booked: number;
}

export interface LiveAd {
  adId: string;
  name: string;
  spendCents: number;
  linkClicks: number;
  metaLeads: number;
  crmLeads: number;
}

export interface LiveToday {
  date: string;
  spendCents: number;
  impressions: number;
  linkClicks: number;
  landingPageViews: number;
  metaLeads: number;
  crmLeads: number;
  booked: number;
  /** CRM leads today that don't name a running ad. */
  unmatched: number;
  lastCrmLeadAt: string | null;
  ads: LiveAd[];
  at: string;
  error: string | null;
}

export interface TrackingData {
  tz: string;
  through: string;
  days: TrackingDay[];
  daysAt: string;
  crmConnected: boolean;
  live: LiveToday | null;
  errors: string[];
}

export type TrackingStatus = "trust" | "over" | "under" | "lost" | "no_crm" | "quiet" | "loading";
export type TrackingSeverity = "ok" | "info" | "warning" | "critical";

export interface AdMismatch {
  adId: string;
  name: string;
  live: boolean;
  meta: number;
  crm: number;
  issue: "no_utm" | "meta_only" | "crm_more" | "meta_more";
  text: string;
  fix: string;
  adsManagerUrl: string;
}

export interface TrackingVerdict {
  status: TrackingStatus;
  severity: TrackingSeverity;
  title: string;
  detail: string;
  fixes: string[];
  week: { meta: number; crm: number; gap: number | null };
  today: { severity: TrackingSeverity; text: string } | null;
  days: (TrackingDay & { flag: "match" | "meta_more" | "crm_more" })[];
  ads: AdMismatch[];
  checks: TrackingItem[];
  /** Things to look at (the verdict, mismatched ads, failing checks). */
  issues: number;
}

const FIX_OVER = [
  "Events Manager → your pixel → Test events: open the landing page, submit the form once, and check the Lead event fires exactly once. Firing twice doubles Meta's count.",
  "Make sure Lead fires only after the form is sent (the thank-you step), never when the page loads.",
  "Some of Meta's extra leads are people who only saw the ad (1-day view). In Ads Manager → Columns → Compare attribution settings, look at 7-day click only — that's the number closest to your CRM.",
];
const FIX_UNDER = [
  "Make sure the Lead event fires on every form and on the booking page — not just one of them.",
  "Send leads to Meta from the server too (Conversions API). Browsers and iPhones block part of the pixel; the server copy fills the gap and Meta optimizes on the real number.",
  "Events Manager → your pixel → Diagnostics: fix anything it flags on the thank-you page.",
];
const FIX_LOST = [
  "Submit a test lead from the ad's landing page right now and check it lands in GoHighLevel within a minute.",
  "Check the form → GoHighLevel connection (the form's integration or webhook) didn't break or get switched off.",
  "Check the form still sends the utm_ fields — without them the lead lands in GoHighLevel but isn't counted as a Meta lead.",
];

const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

export function trackingVerdict({ data, snapshot }: { data: TrackingData | null; snapshot: AdsSnapshot | null }): TrackingVerdict {
  const checks = snapshot?.tracking ?? [];
  const days = (data?.days ?? []).map((d) => {
    const diff = d.metaLeads - d.crmLeads;
    const tol = Math.max(1, Math.round(0.3 * Math.max(d.metaLeads, d.crmLeads)));
    return { ...d, flag: Math.abs(diff) <= tol ? ("match" as const) : diff > 0 ? ("meta_more" as const) : ("crm_more" as const) };
  });
  const last7 = days.slice(-7);
  const meta = last7.reduce((t, d) => t + d.metaLeads, 0);
  const crm = last7.reduce((t, d) => t + d.crmLeads, 0);
  const gap = crm > 0 ? (meta - crm) / crm : null;
  const week = { meta, crm, gap };

  // ── Per ad (30 days, from the snapshot) ──
  const ads: AdMismatch[] = [];
  for (const a of snapshot?.ads ?? []) {
    const m = a.l30;
    const live = a.effectiveStatus === "ACTIVE";
    if (!m || (!live && m.spendCents === 0)) continue;
    const mc = m.metaLeads;
    const cc = m.ghlLeads ?? 0;
    const base = { adId: a.id, name: a.name, live, meta: mc, crm: cc, adsManagerUrl: a.adsManagerUrl };
    if (a.creative.hasUtmContent === false && (live || m.spendCents > 0)) {
      ads.push({ ...base, issue: "no_utm", text: `No utm_content in its link, so leads from it reach the CRM without its name${mc ? ` (Meta counts ${plural(mc, "lead")})` : ""}.`, fix: "Ads Manager → the ad → Tracking → URL parameters: add utm_content={{ad.name}}." });
    } else if (mc >= 2 && cc === 0) {
      ads.push({ ...base, issue: "meta_only", text: `Meta credits it ${plural(mc, "lead")} in 30 days; none reached the CRM with its name.`, fix: "Check the ad wasn't renamed after it launched (the CRM matches on the name) and that the form keeps the utm_ fields." });
    } else if (cc - mc >= 3) {
      ads.push({ ...base, issue: "crm_more", text: `Your CRM got ${plural(cc, "lead")} from it in 30 days; Meta only counted ${count(mc)}.`, fix: "The pixel is missing leads from this ad's page — check the Lead event fires there." });
    } else if (mc - cc >= 3 && cc > 0) {
      ads.push({ ...base, issue: "meta_more", text: `Meta counts ${plural(mc, "lead")} in 30 days; your CRM got ${count(cc)}.`, fix: "Check the Lead event fires only once per form sent on this ad's page." });
    }
  }
  ads.sort((a, b) => Number(b.live) - Number(a.live) || b.meta + b.crm - (a.meta + a.crm));

  // ── Today so far ──
  let today: TrackingVerdict["today"] = null;
  const lv = data?.live ?? null;
  if (lv?.error) today = { severity: "info", text: lv.error };
  else if (lv && lv.metaLeads - lv.crmLeads >= 2) today = { severity: "warning", text: `Meta has counted ${plural(lv.metaLeads, "lead")} today; only ${count(lv.crmLeads)} reached your CRM. If that gap is still there tonight, submit a test lead and check it lands in GoHighLevel.` };
  else if (lv && lv.crmLeads - lv.metaLeads >= 2) today = { severity: "info", text: `Your CRM has ${plural(lv.crmLeads - lv.metaLeads, "more lead")} today than Meta has counted — Meta usually catches up within a few hours.` };

  // ── The verdict ──
  let status: TrackingStatus;
  let severity: TrackingSeverity;
  let title: string;
  let detail: string;
  let fixes: string[] = [];
  const counts = `Last 7 days: Meta counted ${plural(meta, "lead")}, your CRM got ${count(crm)}.`;
  const tol = Math.max(2, Math.round(0.15 * Math.max(meta, crm)));
  if (!data) {
    status = "loading";
    severity = "info";
    title = "Checking tracking…";
    detail = "Lining Meta up against your CRM.";
  } else if (!data.crmConnected || (snapshot && !snapshot.ghl.connected)) {
    status = "no_crm";
    severity = "critical";
    title = "GoHighLevel isn't connected";
    detail = "There's nothing to check Meta's numbers against — and no booked calls to judge ads by.";
    fixes = ["Connect GoHighLevel in Settings."];
  } else if (meta + crm === 0) {
    status = "quiet";
    severity = "info";
    title = "No leads in the last 7 days";
    detail = "Neither Meta nor your CRM has any — nothing to compare yet.";
  } else if (meta >= 3 && crm === 0) {
    status = "lost";
    severity = "critical";
    title = "Leads may not be reaching GoHighLevel";
    detail = `${counts} Either the form → CRM connection broke, or leads arrive without their utm_ fields.`;
    fixes = FIX_LOST;
  } else if (Math.abs(meta - crm) <= tol) {
    status = "trust";
    severity = "ok";
    title = "Tracking you can trust";
    detail = `${counts} Close enough that Meta is optimizing on real numbers.`;
  } else if (meta > crm) {
    status = "over";
    severity = "warning";
    title = `Meta is over-counting leads${gap !== null ? ` (${change(gap)})` : ""}`;
    detail = `${counts} Meta's cost per lead looks better than it really is — judge ads by the CRM numbers on this page.`;
    fixes = FIX_OVER;
  } else {
    status = "under";
    severity = "warning";
    title = `Meta is under-counting leads${gap !== null ? ` (${change(gap)})` : ""}`;
    detail = `${counts} Meta optimizes on the leads it sees, so it's working with part of the picture.`;
    fixes = FIX_UNDER;
  }

  const failing = checks.filter((c) => c.severity === "warning" || c.severity === "critical").length;
  const issues = (severity === "warning" || severity === "critical" ? 1 : 0) + ads.filter((a) => a.live).length + failing;
  return { status, severity, title, detail, fixes, week, today, days, ads, checks, issues };
}
