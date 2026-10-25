import type { GHLContact, GHLAttribution } from "./ghl-client";

/**
 * UTM attribution helpers for GoHighLevel contacts.
 *
 * GHL can hold UTM data in three places depending on how the contact was
 * created: the `attributions[]` history (GHL-native capture from funnels,
 * forms and calendars), the `attributionSource` / `lastAttributionSource`
 * objects (older shape), and plain custom fields (when a workflow copies
 * webhook fields like utm_source onto the contact). We read all three so
 * Ad Analytics works no matter which one a given contact carries.
 */

export interface UtmAttribution {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  /** GHL's own session classification, e.g. "Paid Social", "Direct traffic". */
  sessionSource: string | null;
  url: string | null;
}

/**
 * A contact counts as "booked" when a tag shows they booked a call at some
 * point (cal.com bookings, "booked call", "call booked", …).
 */
export function hasBookedTag(tags: string[] | undefined): boolean {
  if (!tags) return false;
  return tags.some((raw) => {
    const t = raw.toLowerCase();
    return t.includes("cal.com") || (t.includes("book") && t.includes("call"));
  });
}

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, 200) : null;
};

/** "contact.utm_source" / "UTM Source" / "utm-source" → "utmsource" */
export function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/^contact\./, "").replace(/[^a-z0-9]/g, "");
}

const CUSTOM_FIELD_KEYS: Record<string, keyof UtmAttribution> = {
  utmsource: "source",
  utmmedium: "medium",
  utmcampaign: "campaign",
  utmcontent: "content",
  utmterm: "term",
};

function fromAttributionRecord(a: GHLAttribution | undefined): UtmAttribution | null {
  if (!a) return null;
  const r: UtmAttribution = {
    source: clean(a.utmSource),
    medium: clean(a.utmMedium),
    campaign: clean(a.utmCampaign) ?? clean(a.campaign),
    content: clean(a.utmContent),
    term: clean(a.utmTerm) ?? clean(a.utmKeyword),
    sessionSource: clean(a.utmSessionSource) ?? clean(a.sessionSource),
    url: clean(a.url),
  };
  return hasUtm(r) ? r : null;
}

function fromUrl(url: string | null): UtmAttribution | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const p = parsed.searchParams;
  const r: UtmAttribution = {
    source: clean(p.get("utm_source")),
    medium: clean(p.get("utm_medium")),
    campaign: clean(p.get("utm_campaign")),
    content: clean(p.get("utm_content")),
    term: clean(p.get("utm_term")),
    sessionSource: null,
    url,
  };
  return hasUtm(r) ? r : null;
}

function fromCustomFields(
  contact: GHLContact,
  fieldNames: Map<string, string>
): UtmAttribution | null {
  const fields = contact.customFields ?? contact.customField ?? [];
  if (!fields.length) return null;
  const r: UtmAttribution = {
    source: null,
    medium: null,
    campaign: null,
    content: null,
    term: null,
    sessionSource: null,
    url: null,
  };
  for (const f of fields) {
    const name = fieldNames.get(f.id) ?? f.key ?? f.fieldKey ?? "";
    const key = CUSTOM_FIELD_KEYS[normalizeFieldName(name)];
    if (key && key !== "sessionSource" && key !== "url") {
      r[key] = clean(f.value) ?? r[key];
    }
  }
  return hasUtm(r) ? r : null;
}

export function hasUtm(r: UtmAttribution): boolean {
  return Boolean(r.source || r.campaign || r.content);
}

/** Fill any blank fields in `base` from `extra`. */
function merge(base: UtmAttribution, extra: UtmAttribution | null): UtmAttribution {
  if (!extra) return base;
  return {
    source: base.source ?? extra.source,
    medium: base.medium ?? extra.medium,
    campaign: base.campaign ?? extra.campaign,
    content: base.content ?? extra.content,
    term: base.term ?? extra.term,
    sessionSource: base.sessionSource ?? extra.sessionSource,
    url: base.url ?? extra.url,
  };
}

/**
 * Best-effort first-touch UTM attribution for a contact, or null when the
 * contact carries no UTM data anywhere. `fieldNames` maps custom field id →
 * name (from getCustomFields) so custom-field UTMs can be recognised.
 */
export function extractUtm(
  contact: GHLContact,
  fieldNames: Map<string, string>
): UtmAttribution | null {
  const history = contact.attributions ?? [];
  const first =
    history.find((a) => a.isFirst) ?? history.find((a) => fromAttributionRecord(a));

  const candidates: (UtmAttribution | null)[] = [
    fromAttributionRecord(first),
    fromAttributionRecord(contact.attributionSource),
    fromAttributionRecord(contact.lastAttributionSource),
    fromCustomFields(contact, fieldNames),
    fromUrl(clean(first?.url) ?? clean(contact.attributionSource?.url)),
  ];

  let result: UtmAttribution | null = null;
  for (const c of candidates) {
    if (!c) continue;
    result = result ? merge(result, c) : c;
  }
  return result;
}

/** Lower-cased, trimmed grouping key so "Tax-Planning" and "tax-planning" merge. */
export function groupKey(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  return s || null;
}

/**
 * Which Meta placement a lead came from:
 *  - "facebook" / "instagram" / "other" (Messenger, Audience Network, Threads)
 *  - "unknown": clearly a Meta ad lead (paid_social medium, utm_source=meta,
 *    an fbclid, an unresolved {{site_source_name}}…) but the platform can't
 *    be told apart — counted in the Meta total, flagged as unattributed
 *  - null: not a Meta lead (Google, email, direct…) — excluded
 *
 * utm_source wins; when it is missing or generic, GHL's session source and
 * the attribution referrer/URL are used as a fallback. Ads should carry
 * `utm_source={{site_source_name}}`, which Meta fills with fb / ig / msg / an.
 */
export type LeadPlatform = "facebook" | "instagram" | "other" | "unknown";

const FACEBOOK_SOURCES = new Set(["fb", "facebook", "facebook.com", "m.facebook.com", "l.facebook.com", "lm.facebook.com", "web.facebook.com"]);
const INSTAGRAM_SOURCES = new Set(["ig", "instagram", "instagram.com", "l.instagram.com", "www.instagram.com"]);
const OTHER_META_SOURCES = new Set(["msg", "an", "messenger", "audience_network", "audiencenetwork", "threads", "th"]);
const GENERIC_META_SOURCES = new Set(["meta", "meta_ads", "metaads", "meta-ads", "fb_ads", "facebook_ads", "paid_social", "site_source_name"]);

function platformFromText(raw: string | null | undefined): LeadPlatform | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (FACEBOOK_SOURCES.has(s)) return "facebook";
  if (INSTAGRAM_SOURCES.has(s)) return "instagram";
  if (OTHER_META_SOURCES.has(s)) return "other";
  // Referrer URLs / free text ("https://l.instagram.com/…", "Instagram Ads").
  if (s.includes("instagram")) return "instagram";
  if (s.includes("facebook") || s.includes("fb.com") || s.includes("fb.me")) return "facebook";
  if (s.includes("messenger")) return "other";
  return null;
}

function looksMeta(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return (
    GENERIC_META_SOURCES.has(s) ||
    s.includes("{{site_source_name}}") ||
    /paid[\s_-]*social/.test(s) ||
    /\bmeta\b/.test(s)
  );
}

export function platformOf(
  utm: UtmAttribution | null,
  contact?: GHLContact
): LeadPlatform | null {
  const direct = platformFromText(utm?.source);
  if (direct) return direct;
  // An explicit non-Meta source (google, linkedin, newsletter…) is not a Meta lead.
  if (utm?.source && !looksMeta(utm.source)) return null;

  const records: (GHLAttribution | undefined)[] = contact
    ? [
        contact.attributions?.find((a) => a.isFirst),
        ...(contact.attributions ?? []),
        contact.attributionSource,
        contact.lastAttributionSource,
      ]
    : [];

  // Fallbacks: session source, then referrer, then landing URL host.
  const fallbacks: (string | null | undefined)[] = [
    utm?.sessionSource,
    ...records.map((a) => a?.utmSessionSource ?? a?.sessionSource),
    ...records.map((a) => a?.referrer),
    contact?.source,
  ];
  for (const f of fallbacks) {
    const p = platformFromText(f);
    if (p) return p;
  }

  const hasFbclid =
    records.some((a) => Boolean(a?.fbclid)) ||
    [utm?.url, ...records.map((a) => a?.url)].some((u) => Boolean(u && /[?&]fbclid=/i.test(u)));

  if (
    hasFbclid ||
    looksMeta(utm?.source) ||
    looksMeta(utm?.medium) ||
    records.some((a) => looksMeta(a?.utmMedium) || looksMeta(a?.medium) || looksMeta(a?.utmSource))
  ) {
    return "unknown";
  }
  return null;
}
