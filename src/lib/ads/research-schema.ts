/**
 * What Manus must return for Ad Library research (Manus structured_output_schema).
 * Same subset as the analysis schema: root object; every object has
 * additionalProperties:false and lists ALL properties as required; optional
 * values are nullable types; only type/enum/description/$ref/$defs; nesting
 * ≤ 5 (this one is 4). The first value of each enum is the harmless one.
 * Pure, client-safe.
 */

export const RESEARCH_SCHEMA_VERSION = "ads-research-v1";

export const AD_FORMATS = ["other", "video_9x16", "video_other", "image", "carousel"] as const;
export const LONGEVITY = ["unknown", "new", "testing", "proven", "evergreen"] as const;
export const ADVERTISER_TYPES = ["other", "agency", "lead_gen", "coach_or_consultant", "software", "media_or_association", "accounting_firm"] as const;
export const RELEVANCE = ["low", "medium", "high"] as const;
export const BRIEF_SOURCES = ["gap", "competitor", "ours"] as const;
export const BRIEF_FORMATS = ["photo", "video"] as const;

const nullable = (type: string) => ({ type: [type, "null"] });
const strings = { type: "array", items: { type: "string" } };

export const RESEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "headline", "summary", "searched", "market_patterns", "gaps", "competitors", "ads", "replicate_ours", "briefs", "data_notes", "report_markdown"],
  properties: {
    schema_version: { type: "string", enum: [RESEARCH_SCHEMA_VERSION] },
    headline: { type: "string", description: "One plain sentence, max 140 characters: the biggest takeaway for Nexli." },
    summary: { type: "string", description: "3-5 plain sentences." },
    searched: { $ref: "#/$defs/searched" },
    market_patterns: { type: "array", items: { $ref: "#/$defs/insight" }, description: "What's working in the market, from long-running ads." },
    gaps: { type: "array", items: { $ref: "#/$defs/insight" }, description: "Angles or formats nobody is using well that Nexli could own." },
    competitors: { type: "array", items: { $ref: "#/$defs/competitor" } },
    ads: { type: "array", items: { $ref: "#/$defs/ad" }, description: "15-30 active ads, longest-running first." },
    replicate_ours: { type: "array", items: { $ref: "#/$defs/replicate" }, description: "Nexli's own ads worth making more of." },
    briefs: { type: "array", items: { $ref: "#/$defs/brief" }, description: "4-8 creatives to make next." },
    data_notes: { ...strings, description: "Caveats: blocked pages, missing screenshots, thin results." },
    report_markdown: { type: "string", description: "The full written report in Markdown, sections in the playbook's order." },
  },
  $defs: {
    searched: {
      type: "object",
      additionalProperties: false,
      required: ["keywords", "advertisers_checked", "blocked"],
      properties: { keywords: strings, advertisers_checked: strings, blocked: strings },
    },
    insight: {
      type: "object",
      additionalProperties: false,
      required: ["title", "detail", "ad_refs"],
      properties: { title: { type: "string" }, detail: { type: "string" }, ad_refs: { ...strings, description: "Refs of ads that show it, e.g. ad-03." } },
    },
    competitor: {
      type: "object",
      additionalProperties: false,
      required: ["name", "page_url", "page_id", "type", "relevance", "active_ads_seen", "longest_running_days", "offer", "notes"],
      properties: {
        name: { type: "string" },
        page_url: nullable("string"),
        page_id: { ...nullable("string"), description: "The Facebook page id (view_all_page_id), if seen." },
        type: { type: "string", enum: [...ADVERTISER_TYPES] },
        relevance: { type: "string", enum: [...RELEVANCE] },
        active_ads_seen: nullable("integer"),
        longest_running_days: nullable("integer"),
        offer: { type: "string" },
        notes: { type: "string" },
      },
    },
    ad: {
      type: "object",
      additionalProperties: false,
      required: [
        "ref",
        "library_id",
        "advertiser",
        "page_url",
        "ad_library_url",
        "landing_url",
        "started_running",
        "days_active",
        "versions",
        "platforms",
        "format",
        "hook",
        "angle",
        "offer",
        "cta",
        "text_excerpt",
        "why_it_works",
        "longevity",
        "relevance",
        "screenshot_file",
        "similar_to_our_ad_id",
      ],
      properties: {
        ref: { type: "string", description: "ad-01, ad-02… in list order." },
        library_id: { ...nullable("string"), description: "The Library ID shown on the ad card." },
        advertiser: { type: "string" },
        page_url: nullable("string"),
        ad_library_url: { ...nullable("string"), description: "https://www.facebook.com/ads/library/?id=<library id>" },
        landing_url: nullable("string"),
        started_running: { ...nullable("string"), description: "YYYY-MM-DD from 'Started running on'." },
        days_active: nullable("integer"),
        versions: { ...nullable("integer"), description: "Versions / ads using this creative, if shown." },
        platforms: strings,
        format: { type: "string", enum: [...AD_FORMATS] },
        hook: { type: "string", description: "The first line, or the first words spoken or on screen." },
        angle: { type: "string" },
        offer: { type: "string" },
        cta: nullable("string"),
        text_excerpt: nullable("string"),
        why_it_works: { type: "string" },
        longevity: { type: "string", enum: [...LONGEVITY] },
        relevance: { type: "string", enum: [...RELEVANCE] },
        screenshot_file: { ...nullable("string"), description: "The attached screenshot's file name, e.g. ad-01.png." },
        similar_to_our_ad_id: { ...nullable("string"), description: "Id of Nexli's ad (from our_ads) it most resembles." },
      },
    },
    replicate: {
      type: "object",
      additionalProperties: false,
      required: ["our_ad_id", "why", "how_to_extend"],
      properties: { our_ad_id: { type: "string" }, why: { type: "string" }, how_to_extend: { type: "string" } },
    },
    brief: {
      type: "object",
      additionalProperties: false,
      required: ["key", "title", "source", "based_on_refs", "based_on_our_ad_ids", "angle", "hook_lines", "format", "count", "creative_studio_prompt", "why"],
      properties: {
        key: { type: "string", description: "Stable kebab-case." },
        title: { type: "string", description: "Max 90 characters." },
        source: { type: "string", enum: [...BRIEF_SOURCES] },
        based_on_refs: strings,
        based_on_our_ad_ids: strings,
        angle: { type: "string" },
        hook_lines: strings,
        format: { type: "string", enum: [...BRIEF_FORMATS] },
        count: { type: "integer", description: "Photo ads 3-6, videos 2-4." },
        creative_studio_prompt: { type: "string", description: "Paste-ready for Creative Studio, complete on its own, max 1,500 characters." },
        why: { type: "string" },
      },
    },
  },
} as const;
