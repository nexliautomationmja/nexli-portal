import { arr, en, int, obj, str, strOrNull } from "@/lib/ads/parse";
import { daysBetween } from "@/lib/ads/time";
import { AD_FORMATS, ADVERTISER_TYPES, BRIEF_FORMATS, BRIEF_SOURCES, LONGEVITY, RELEVANCE } from "@/lib/ads/research-schema";

/**
 * Ad Library research as the page can trust it (pure, client-safe): links
 * must be real https Facebook / Instagram URLs (library links rebuilt from
 * the Library ID otherwise), days running recomputed from the start date,
 * Nexli's ad ids checked, briefs flagged when they name a competitor or
 * promise results. A zero-filled failure is rejected. Screenshots are matched
 * to ads by file name only — never by position.
 */

export type AdFormat = (typeof AD_FORMATS)[number];
export type Longevity = (typeof LONGEVITY)[number];

export interface ResearchIndex {
  /** YYYY-MM-DD in the account's timezone. */
  today: string;
  ourAdIds: Set<string>;
  ourAdIdByName: Map<string, string>;
  previousLibraryIds: Set<string>;
}

export interface ResearchAd {
  ref: string;
  libraryId: string | null;
  advertiser: string;
  pageUrl: string | null;
  pageId: string | null;
  libraryUrl: string | null;
  landingUrl: string | null;
  landingDomain: string | null;
  startedRunning: string | null;
  daysActive: number | null;
  versions: number | null;
  platforms: string[];
  format: AdFormat;
  hook: string;
  angle: string;
  offer: string;
  cta: string | null;
  textExcerpt: string | null;
  whyItWorks: string;
  longevity: Longevity;
  relevance: (typeof RELEVANCE)[number];
  screenshotFile: string | null;
  similarToOurAdId: string | null;
  isNew: boolean;
  /** Stored copy of the screenshot (set when the run is saved). */
  screenshot?: { path: string; w: number; h: number } | null;
}

export interface ResearchInsight {
  title: string;
  detail: string;
  adRefs: string[];
}

export interface ResearchCompetitor {
  name: string;
  pageUrl: string | null;
  pageId: string | null;
  libraryUrl: string | null;
  type: (typeof ADVERTISER_TYPES)[number];
  relevance: (typeof RELEVANCE)[number];
  activeAdsSeen: number | null;
  longestRunningDays: number | null;
  offer: string;
  notes: string;
}

export interface ResearchBrief {
  key: string;
  title: string;
  source: (typeof BRIEF_SOURCES)[number];
  basedOnRefs: string[];
  basedOnOurAdIds: string[];
  angle: string;
  hookLines: string[];
  format: (typeof BRIEF_FORMATS)[number];
  count: number;
  prompt: string;
  why: string;
  flags: string[];
}

export interface ParsedResearch {
  headline: string;
  summary: string;
  searched: { keywords: string[]; advertisersChecked: string[]; blocked: string[] };
  marketPatterns: ResearchInsight[];
  gaps: ResearchInsight[];
  competitors: ResearchCompetitor[];
  ads: ResearchAd[];
  replicateOurs: { ourAdId: string; why: string; howToExtend: string }[];
  briefs: ResearchBrief[];
  dataNotes: string[];
  reportMarkdown: string;
  /** Screenshots stored vs ads found (set when the run is saved). */
  screenshots?: { found: number; expected: number };
}

const FB_HOST = /^(www\.|m\.|web\.)?facebook\.com$/i;
const IG_HOST = /^(www\.)?instagram\.com$/i;
const PLATFORMS = new Set(["facebook", "instagram", "messenger", "audience_network", "threads", "whatsapp"]);

function safeUrl(v: unknown, opts: { https?: boolean } = {}): URL | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    if (opts.https ? u.protocol !== "https:" : u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u;
  } catch {
    return null;
  }
}

export const libraryLink = (id: string) => `https://www.facebook.com/ads/library/?id=${encodeURIComponent(id)}`;
export const advertiserLibraryLink = (pageId: string) =>
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&view_all_page_id=${encodeURIComponent(pageId)}&search_type=page`;

const digits = (v: unknown, min = 5, max = 25): string | null => {
  const m = typeof v === "string" || typeof v === "number" ? String(v).match(new RegExp(`\\d{${min},${max}}`)) : null;
  return m ? m[0] : null;
};

function libraryUrlOf(v: unknown, libraryId: string | null): string | null {
  const u = safeUrl(v, { https: true });
  if (u && FB_HOST.test(u.hostname) && u.pathname.startsWith("/ads/library")) return u.toString();
  return libraryId ? libraryLink(libraryId) : null;
}

function pageUrlOf(v: unknown): string | null {
  const u = safeUrl(v, { https: true });
  return u && (FB_HOST.test(u.hostname) || IG_HOST.test(u.hostname)) ? u.toString() : null;
}

function pageIdOf(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v !== "string" && typeof v !== "number") continue;
    const s = String(v);
    const u = safeUrl(s);
    const fromUrl = u ? (u.searchParams.get("view_all_page_id") ?? u.searchParams.get("id")) : null;
    const id = digits(fromUrl ?? (/^\d+$/.test(s) ? s : null), 5, 25);
    if (id) return id;
  }
  return null;
}

/** The landing page (unwrapping Facebook's l.php redirect). */
function landingOf(v: unknown): { url: string; domain: string } | null {
  let u = safeUrl(v);
  if (u && /(^|\.)l\.facebook\.com$/i.test(u.hostname)) u = safeUrl(u.searchParams.get("u"));
  if (!u) return null;
  return { url: u.toString(), domain: u.hostname.replace(/^www\./i, "") };
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** YYYY-MM-DD from "2026-06-15" or "Jun 15, 2026", between 2010 and today. */
export function dayOf(v: unknown, today: string): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  let y: number | null = null;
  let m: number | null = null;
  let d: number | null = null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const us = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (us && MONTHS[us[1].slice(0, 4).toLowerCase()] !== undefined) [y, m, d] = [Number(us[3]), MONTHS[us[1].slice(0, 4).toLowerCase()], Number(us[2])];
  else if (us && MONTHS[us[1].slice(0, 3).toLowerCase()] !== undefined) [y, m, d] = [Number(us[3]), MONTHS[us[1].slice(0, 3).toLowerCase()], Number(us[2])];
  if (!y || !m || !d || m > 12 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (ymd < "2010-01-01" || ymd > today) return null;
  return ymd;
}

export function longevityOf(days: number | null, fallback: Longevity = "unknown"): Longevity {
  if (days === null) return fallback;
  if (days >= 90) return "evergreen";
  if (days >= 30) return "proven";
  if (days >= 14) return "testing";
  return "new";
}

const refOf = (v: unknown, i: number) => {
  const n = typeof v === "string" ? v.match(/(\d{1,3})(?!.*\d)/)?.[1] : null;
  return `ad-${String(n ? Number(n) : i + 1).padStart(2, "0")}`;
};

const FILE = /^[\w.\- ()]{1,80}\.(png|jpe?g|webp)$/i;
const baseName = (v: string) => (v.split(/[\\/]/).pop() ?? v).split("?")[0];

/** "We guarantee 10 clients" yes; "Avoid: guarantees" / "no promised results" no (the briefs list what to avoid). */
export function promisesResults(text: string): boolean {
  for (const m of text.matchAll(/\b(guarantee[ds]?|promise[ds]?)\b/gi)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    const clause = before.split(/[.;!?\n]/).pop() ?? "";
    if (!/\b(no|never|avoid(?:ing)?|without|don'?t|do not|not|nor|zero)\b/i.test(clause)) return true;
  }
  return false;
}

export function parseResearch(value: unknown, idx: ResearchIndex): ParsedResearch | null {
  const v = obj(value);
  const headline = str(v.headline, 200);
  const summary = str(v.summary, 1500);
  const rawAds = arr(v.ads, 40);
  const rawBriefs = arr(v.briefs, 12);
  if (!headline && !summary && rawAds.length === 0 && rawBriefs.length === 0) return null;

  // Ads.
  const ads: ResearchAd[] = [];
  const seenRefs = new Set<string>();
  const seenIds = new Set<string>();
  rawAds.forEach((av, i) => {
    if (ads.length >= 30) return;
    const a = obj(av);
    const advertiser = str(a.advertiser, 120);
    const hook = str(a.hook, 200);
    let libraryId = digits(a.library_id, 10, 20);
    const libUrl = safeUrl(a.ad_library_url);
    if (!libraryId && libUrl && FB_HOST.test(libUrl.hostname)) libraryId = digits(libUrl.searchParams.get("id"), 10, 20);
    const libraryUrl = libraryUrlOf(a.ad_library_url, libraryId);
    if (!advertiser || (!libraryUrl && !hook)) return;
    if (libraryId && seenIds.has(libraryId)) return;
    let ref = refOf(a.ref, i);
    while (seenRefs.has(ref)) ref = `ad-${String(Number(ref.slice(3)) + 1).padStart(2, "0")}`;
    seenRefs.add(ref);
    if (libraryId) seenIds.add(libraryId);
    const started = dayOf(a.started_running, idx.today);
    const days = started ? Math.max(0, Math.min(3650, daysBetween(started, idx.today))) : int(a.days_active, 0, 3650);
    const landing = landingOf(a.landing_url);
    const shot = strOrNull(a.screenshot_file, 200);
    const shotName = shot ? baseName(shot) : null;
    let similar = strOrNull(a.similar_to_our_ad_id, 40);
    if (similar && !idx.ourAdIds.has(similar)) similar = idx.ourAdIdByName.get(similar.toLowerCase()) ?? null;
    ads.push({
      ref,
      libraryId,
      advertiser,
      pageUrl: pageUrlOf(a.page_url),
      pageId: pageIdOf(a.page_url),
      libraryUrl,
      landingUrl: landing?.url ?? null,
      landingDomain: landing?.domain ?? null,
      startedRunning: started,
      daysActive: days,
      versions: int(a.versions, 1, 500),
      platforms: arr(a.platforms, 10)
        .map((p) => str(p, 30).toLowerCase().replace(/\s+/g, "_"))
        .filter((p) => PLATFORMS.has(p))
        .slice(0, 6),
      format: en(a.format, AD_FORMATS, "other"),
      hook,
      angle: str(a.angle, 160),
      offer: str(a.offer, 200),
      cta: strOrNull(a.cta, 60),
      textExcerpt: strOrNull(a.text_excerpt, 300),
      whyItWorks: str(a.why_it_works, 500),
      longevity: longevityOf(days, en(a.longevity, LONGEVITY, "unknown")),
      relevance: en(a.relevance, RELEVANCE, "low"),
      screenshotFile: shotName && FILE.test(shotName) ? shotName : null,
      similarToOurAdId: similar,
      isNew: !libraryId || !idx.previousLibraryIds.has(libraryId),
    });
  });
  const refs = new Set(ads.map((a) => a.ref));
  const advertisers = [...new Set(ads.map((a) => a.advertiser))];

  const insight = (x: unknown): ResearchInsight => {
    const o = obj(x);
    return { title: str(o.title, 140), detail: str(o.detail, 600), adRefs: [...new Set(arr(o.ad_refs, 10).map((r, i) => refOf(r, i)).filter((r) => refs.has(r)))] };
  };

  const competitors: ResearchCompetitor[] = arr(v.competitors, 20)
    .map((cv) => {
      const c = obj(cv);
      const pageId = pageIdOf(c.page_id, c.page_url);
      const libraryUrl = pageId ? advertiserLibraryLink(pageId) : null;
      return {
        name: str(c.name, 120),
        pageUrl: pageUrlOf(c.page_url),
        pageId,
        libraryUrl,
        type: en(c.type, ADVERTISER_TYPES, "other"),
        relevance: en(c.relevance, RELEVANCE, "low"),
        activeAdsSeen: int(c.active_ads_seen, 0, 5000),
        longestRunningDays: int(c.longest_running_days, 0, 3650),
        offer: str(c.offer, 300),
        notes: str(c.notes, 500),
      };
    })
    .filter((c, i, all) => c.name && all.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()) === i);

  const competitorNames = [...new Set([...advertisers, ...competitors.map((c) => c.name)])].filter((n) => n.length >= 4 && !/nexli/i.test(n));
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const namesCompetitor = (text: string) => competitorNames.find((n) => new RegExp(`(?<![\\w])${escape(n)}(?![\\w])`, "i").test(text)) ?? null;

  const keys = new Set<string>();
  const briefs: ResearchBrief[] = [];
  for (const bv of rawBriefs) {
    if (briefs.length >= 8) break;
    const b = obj(bv);
    const title = str(b.title, 90);
    const prompt = str(b.creative_studio_prompt, 1800);
    if (!title || !prompt) continue;
    let key = (str(b.key, 60).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || `brief-${briefs.length + 1}`).slice(0, 60);
    while (keys.has(key)) key = `${key}-2`;
    keys.add(key);
    const format = en(b.format, BRIEF_FORMATS, "photo");
    const flags: string[] = [];
    const named = namesCompetitor(`${title} ${prompt}`);
    if (named) flags.push(`Names a competitor (${named}) — keep their name out`);
    if (promisesResults(prompt)) flags.push("Promises results — no guarantees");
    briefs.push({
      key,
      title,
      source: en(b.source, BRIEF_SOURCES, "gap"),
      basedOnRefs: [...new Set(arr(b.based_on_refs, 6).map((r, i) => refOf(r, i)).filter((r) => refs.has(r)))],
      basedOnOurAdIds: [
        ...new Set(
          arr(b.based_on_our_ad_ids, 6)
            .map((x) => str(x, 40))
            .map((x) => (idx.ourAdIds.has(x) ? x : (idx.ourAdIdByName.get(x.toLowerCase()) ?? "")))
            .filter(Boolean)
        ),
      ],
      angle: str(b.angle, 200),
      hookLines: arr(b.hook_lines, 5)
        .map((h) => str(h, 160))
        .filter(Boolean),
      format,
      count: int(b.count, 1, format === "video" ? 10 : 20) ?? (format === "video" ? 3 : 4),
      prompt,
      why: str(b.why, 500),
      flags,
    });
  }

  const searched = obj(v.searched);
  return {
    headline: headline || summary.slice(0, 140),
    summary,
    searched: {
      keywords: arr(searched.keywords, 20).map((x) => str(x, 80)).filter(Boolean),
      advertisersChecked: arr(searched.advertisers_checked, 30).map((x) => str(x, 120)).filter(Boolean),
      blocked: arr(searched.blocked, 10).map((x) => str(x, 200)).filter(Boolean),
    },
    marketPatterns: arr(v.market_patterns, 8).map(insight).filter((x) => x.title),
    gaps: arr(v.gaps, 8).map(insight).filter((x) => x.title),
    competitors,
    ads,
    replicateOurs: arr(v.replicate_ours, 6)
      .map((rv) => {
        const r = obj(rv);
        const raw = str(r.our_ad_id, 40);
        const id = idx.ourAdIds.has(raw) ? raw : (idx.ourAdIdByName.get(raw.toLowerCase()) ?? "");
        return { ourAdId: id, why: str(r.why, 500), howToExtend: str(r.how_to_extend, 500) };
      })
      .filter((r, i, all) => r.ourAdId && all.findIndex((x) => x.ourAdId === r.ourAdId) === i),
    briefs,
    dataNotes: arr(v.data_notes, 8).map((x) => str(x, 300)).filter(Boolean),
    reportMarkdown: str(v.report_markdown, 60_000),
  };
}

export interface ImageAttachment {
  filename: string;
  url: string;
  contentType: string;
}

const isImage = (a: ImageAttachment) => /^image\//i.test(a.contentType) || a.contentType.toLowerCase() === "image" || /\.(png|jpe?g|webp)$/i.test(baseName(a.filename));
const stem = (name: string) => name.toLowerCase().replace(/\.(png|jpe?g|webp)$/i, "");
const numberOf = (name: string) => {
  const m = name.toLowerCase().match(/^ad[\s_-]*0*(\d{1,3})(?!\d)/);
  return m ? Number(m[1]) : null;
};

/**
 * Which attached image is each ad's screenshot: exact file name, then the
 * same name with another extension, then the same number (ad-1 / ad_01 /
 * "ad-01 (1).png"). Newest attachments first, each used once, at most `max`.
 */
export function matchScreenshots(ads: Pick<ResearchAd, "ref" | "screenshotFile">[], attachments: ImageAttachment[], max = 30): Map<string, string> {
  const images = attachments.filter(isImage).map((a) => ({ ...a, base: baseName(a.filename).toLowerCase() }));
  const used = new Set<number>();
  const out = new Map<string, string>();
  const take = (ref: string, pick: (img: (typeof images)[number]) => boolean) => {
    const i = images.findIndex((img, j) => !used.has(j) && pick(img));
    if (i < 0) return false;
    used.add(i);
    out.set(ref, images[i].url);
    return true;
  };
  // Pass by pass across all ads, so one ad's loose match never takes another ad's exact file.
  const passes: ((ad: (typeof ads)[number], file: string | null) => ((img: (typeof images)[number]) => boolean) | null)[] = [
    (_ad, file) => (file ? (img) => img.base === file : null),
    (_ad, file) => (file ? (img) => stem(img.base) === stem(file) : null),
    (ad, file) => {
      const n = numberOf(file ?? "") ?? numberOf(ad.ref);
      return n === null ? null : (img) => numberOf(img.base) === n;
    },
  ];
  for (const pass of passes) {
    for (const ad of ads) {
      if (out.size >= max) return out;
      if (out.has(ad.ref)) continue;
      const pick = pass(ad, ad.screenshotFile?.toLowerCase() ?? null);
      if (pick) take(ad.ref, pick);
    }
  }
  return out;
}
