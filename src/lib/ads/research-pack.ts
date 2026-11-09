import { DRS_PRICING, TOTAL_MONTHLY_CENTS } from "@/lib/drs-pricing";
import { money, pct } from "@/lib/ads/format";
import { daysBetween } from "@/lib/ads/time";
import type { AdsSnapshot } from "@/lib/ads/types";
import type { AdSettingsRow } from "@/lib/ads/settings";
import type { ParsedAnalysis } from "@/lib/ads/parse";
import type { ParsedResearch, ResearchIndex } from "@/lib/ads/research-parse";
import { ADJACENT_SEEDS, RESEARCH_SEEDS } from "@/lib/ads/research-playbook";

/**
 * What Manus is given for Ad Library research (compact; no personal data):
 * Nexli's offer, its own top ads with results and Manus's verdicts, what the
 * last analysis found, competitors to always check, keywords, and the
 * previous research (to track long-runners and flag what's new). Also the
 * index the parser checks the answer against, and the summary the weekly
 * analysis reads.
 */

export const RESEARCH_PACK_VERSION = "ads-research-pack-v1";

const usd = (c: number | null | undefined) => (c === null || c === undefined ? null : Math.round(c) / 100);

export interface Still {
  url: string;
  filename: string;
}

/** "Acme Marketing" / a Facebook page link / an Ad Library link → what we can tell Manus. */
export function parseCompetitors(text: string): { input: string; url: string | null; page_id: string | null }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 25)
    .map((input) => {
      let url: string | null = null;
      let pageId: string | null = null;
      try {
        const u = new URL(input);
        if (u.protocol === "https:" || u.protocol === "http:") {
          url = u.toString();
          pageId = u.searchParams.get("view_all_page_id") ?? (u.pathname.startsWith("/profile.php") ? u.searchParams.get("id") : null);
        }
      } catch {
        /* a name */
      }
      if (!pageId && /^\d{6,25}$/.test(input)) pageId = input;
      return { input, url, page_id: pageId && /^\d{5,25}$/.test(pageId) ? pageId : null };
    });
}

export function buildResearchPack(src: {
  s30: AdsSnapshot;
  settings: AdSettingsRow;
  /** The latest analysis's result (verdicts, what's working, refresh angles). */
  analysis: { finishedAt: Date | null; result: Omit<ParsedAnalysis, "reportMarkdown"> | null } | null;
  previous: { finishedAt: Date | null; result: ParsedResearch | null } | null;
  /** Full-size stills of our top ads (from /media), by ad id. */
  posters: Map<string, string>;
}) {
  const { s30, settings, analysis, previous, posters } = src;
  const today = s30.range.until;
  const verdicts = new Map((analysis?.result?.creatives ?? []).map((c) => [c.adId, c]));
  const top = s30.ads
    .filter((a) => a.effectiveStatus === "ACTIVE" || (a.l30?.spendCents ?? 0) > 0)
    .sort((a, b) => (b.l30?.spendCents ?? 0) - (a.l30?.spendCents ?? 0))
    .slice(0, 12);
  const stills: Still[] = top
    .slice(0, 6)
    .map((a, i) => ({ url: posters.get(a.id) ?? a.creative.thumbnailUrl ?? "", filename: `ours-${String(i + 1).padStart(2, "0")}-${a.id}.jpg` }))
    .filter((s) => s.url);
  const stillOf = new Map(stills.map((s) => [s.filename.split("-").slice(2).join("-").replace(/\.jpg$/, ""), s.filename]));
  const domains = [...new Set(top.map((a) => a.creative.linkUrl).filter(Boolean).map((u) => {
    try {
      return new URL(u as string).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }).filter(Boolean))].slice(0, 5);
  const refreshAngles = (analysis?.result?.steps ?? []).flatMap((s) => s.creativeRefresh?.angles ?? []).slice(0, 6);
  const prev = previous?.result ?? null;

  const pack = {
    pack_version: RESEARCH_PACK_VERSION,
    generated_at: new Date().toISOString(),
    today,
    nexli: {
      offer: "The Digital Rainmaker System: done-for-you client acquisition for CPA firms — Meta ads, landing page, follow-up, and booked strategy calls with qualified firm owners",
      ideal_client: "Owners and partners of US CPA / accounting firms who want more high-value clients",
      setup_fee_usd: usd(DRS_PRICING.SETUP_FEE_CENTS),
      monthly_usd: usd(TOTAL_MONTHLY_CENTS),
      main_conversion: "booked strategy call",
      presenter: "Daniela",
      creative_styles: "9:16 talking-head videos with Daniela; static ads with the headline on the image (9:16 story + 4:5 feed)",
      landing_domains: domains,
      notes_from_marcel: settings.context || null,
    },
    our_results_30d: {
      spend: money(s30.totals.cur.spendCents),
      booked_calls: s30.totals.cur.booked,
      cost_per_booked_call: money(s30.totals.cur.costPerBookedCents),
      target_cost_per_booked_call_usd: usd(s30.targetCpb.cents),
    },
    our_ads: top.map((a) => {
      const v = verdicts.get(a.id);
      return {
        id: a.id,
        name: a.name,
        status: a.effectiveStatus,
        media_type: a.creative.mediaType,
        headline: a.creative.headline,
        primary_text: a.creative.primaryText ? a.creative.primaryText.slice(0, 400) : null,
        cta: a.creative.ctaType,
        age_days: a.ageDays,
        fatigue: { state: a.fatigue.state, score: a.fatigue.score },
        winner: a.winner,
        spend_30d: money(a.l30?.spendCents ?? null),
        booked_30d: a.l30?.booked ?? null,
        cost_per_booked_30d: money(a.l30?.costPerBookedCents ?? null),
        ctr_7d: pct(a.l7?.ctr ?? null),
        hook_rate_7d: pct(a.l7?.hookRate ?? null),
        manus_verdict: v?.verdict ?? null,
        manus_why: v?.why ?? null,
        manus_iterate_idea: v?.iterateIdea ?? null,
        still_file: stillOf.get(a.id) ?? null,
      };
    }),
    manus_latest_analysis: analysis?.result
      ? {
          finished_at: analysis.finishedAt?.toISOString() ?? null,
          headline: analysis.result.headline,
          whats_working: analysis.result.whatsWorking.slice(0, 4).map((f) => `${f.title}: ${f.detail}`.slice(0, 300)),
          whats_not: analysis.result.whatsNot.slice(0, 4).map((f) => `${f.title}: ${f.detail}`.slice(0, 300)),
          planned_refresh_angles: refreshAngles,
        }
      : null,
    competitors_to_check: parseCompetitors(settings.competitors),
    seed_keywords: [...RESEARCH_SEEDS],
    adjacent_keywords: [...ADJACENT_SEEDS],
    previous_research: prev
      ? {
          finished_at: previous?.finishedAt?.toISOString() ?? null,
          competitors: prev.competitors.slice(0, 20).map((c) => ({ name: c.name, page_url: c.pageUrl, page_id: c.pageId })),
          ads: prev.ads.slice(0, 30).map((a) => ({
            library_id: a.libraryId,
            advertiser: a.advertiser,
            started_running: a.startedRunning,
            days_active: a.daysActive,
            format: a.format,
            hook: a.hook.slice(0, 160),
            ad_library_url: a.libraryUrl,
          })),
        }
      : null,
    limits: { ads_min: 15, ads_max: 30, max_per_advertiser: 4, minutes: 45 },
  };
  return { pack, stills };
}

export type ResearchPack = ReturnType<typeof buildResearchPack>["pack"];

export function researchIndex(pack: ResearchPack): ResearchIndex {
  return {
    today: pack.today,
    ourAdIds: new Set(pack.our_ads.map((a) => a.id)),
    ourAdIdByName: new Map(pack.our_ads.map((a) => [a.name.toLowerCase(), a.id])),
    previousLibraryIds: new Set((pack.previous_research?.ads ?? []).map((a) => a.library_id).filter((x): x is string => Boolean(x))),
  };
}

export interface ResearchPackSummary {
  finished_at: string | null;
  age_days: number | null;
  headline: string;
  summary: string;
  market_patterns: { title: string; detail: string }[];
  gaps: { title: string; detail: string }[];
  long_running_competitor_ads: { advertiser: string; format: string; hook: string; angle: string; offer: string; cta: string | null; days_active: number | null; versions: number | null; ad_library_url: string | null }[];
  briefs: { key: string; title: string; source: string; format: string; angle: string; hook_lines: string[] }[];
  replicate_ours: { our_ad_id: string; why: string; how_to_extend: string }[];
  note: string;
}

/** What the weekly analysis reads from the latest research (only if it's from the last 60 days). */
export function researchPackSummary(finishedAt: Date | null, result: ParsedResearch | null, today: string): ResearchPackSummary | null {
  if (!result || !finishedAt) return null;
  const finished = finishedAt.toISOString().slice(0, 10);
  const age = daysBetween(finished, today);
  if (age > 60) return null;
  return {
    finished_at: finishedAt.toISOString(),
    age_days: age,
    headline: result.headline,
    summary: result.summary,
    market_patterns: result.marketPatterns.slice(0, 5).map((p) => ({ title: p.title, detail: p.detail })),
    gaps: result.gaps.slice(0, 5).map((p) => ({ title: p.title, detail: p.detail })),
    long_running_competitor_ads: result.ads
      .filter((a) => (a.daysActive ?? 0) >= 30)
      .sort((a, b) => (b.daysActive ?? 0) - (a.daysActive ?? 0))
      .slice(0, 8)
      .map((a) => ({ advertiser: a.advertiser, format: a.format, hook: a.hook.slice(0, 160), angle: a.angle, offer: a.offer, cta: a.cta, days_active: a.daysActive, versions: a.versions, ad_library_url: a.libraryUrl })),
    briefs: result.briefs.slice(0, 6).map((b) => ({ key: b.key, title: b.title, source: b.source, format: b.format, angle: b.angle, hook_lines: b.hookLines })),
    replicate_ours: result.replicateOurs.map((r) => ({ our_ad_id: r.ourAdId, why: r.why, how_to_extend: r.howToExtend })),
    note: "Borrow patterns (angle, hook structure, format, offer framing) — never competitors' words, names, logos or footage.",
  };
}
