/**
 * The VSL scoreboard (pure, client-safe): which of Marcel's four VSL funnels
 * on nexli.net turns CRM leads into booked calls best, and how sure that is.
 *
 * Every VSL lead reaches GoHighLevel with its funnel's tag (`agencyVSL`,
 * `better-clientsVSL`, `systemsVSL`, `acquisitionVSL`; GHL lowercases them),
 * applied by the site's qualifier and again at booking. A contact can carry
 * two (a rebook button sends everyone to /agency/qualify), so the first-touch
 * landing URL breaks the tie. The tags exist since Nov 5 2026 and the four
 * funnels since Nov 2 — data is thin, so the board says how sure it is
 * (the chance each VSL truly books best, from a Beta posterior).
 */

export type VslKey = "agency" | "better-clients" | "systems" | "acquisition";

export const VSLS: { key: VslKey; label: string; path: string; note: string | null }[] = [
  { key: "agency", label: "Agency", path: "/agency", note: "Daniela — CPA ads" },
  { key: "better-clients", label: "Better Clients", path: "/better-clients", note: null },
  { key: "systems", label: "Systems", path: "/systems", note: null },
  { key: "acquisition", label: "Acquisition", path: "/acquisition", note: "referrals" },
];
export const VSL_LABEL: Record<VslKey, string> = Object.fromEntries(VSLS.map((v) => [v.key, v.label])) as Record<VslKey, string>;

/** The day the four funnels went live (contacts created before it are left out). */
export const VSL_SINCE = "2026-11-02";
/** A lead counts toward the booking rate once it has had this many days to book. */
export const VSL_MATURE_DAYS = 3;

const KEYS = new Set<string>(VSLS.map((v) => v.key));
const isKey = (v: string | null | undefined): v is VslKey => typeof v === "string" && KEYS.has(v);

/** Exact tags only — never "ends with vsl" (that would catch `qualified-vsl`). */
const TAGS: Record<string, VslKey> = { agencyvsl: "agency", "better-clientsvsl": "better-clients", systemsvsl: "systems", acquisitionvsl: "acquisition" };
const QUALIFIED_TAG = "qualified-vsl";
/** Tags the site's advisory funnel sets (any of them + a VSL landing URL = that VSL). */
const FUNNEL_TAGS = new Set(["qualified-vsl", "advisory opt-in", "advisory incomplete", "advisory qualified", "advisory booked", "agency pitch", "advisory not a fit"]);
/** Paths that 301 to /agency on the site (old funnels and the pre-Nov 4 VSL address). */
const AGENCY_ALIASES = new Set(["advisory-pricing", "demo", "demo-opt-in", "funnel", "free-guide", "roadmap", "foundation"]);

/** Which VSL a landing URL is: `?angle=` first (before Nov 4 every angle ran on /advisory-pricing), then the path. */
export function vslOfUrl(url: string | null | undefined): VslKey | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim(), "https://www.nexli.net");
  } catch {
    return null;
  }
  const angle = u.searchParams.get("angle")?.trim().toLowerCase();
  if (isKey(angle)) return angle;
  const seg = u.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  if (isKey(seg)) return seg;
  if (AGENCY_ALIASES.has(seg) || /^vslfunnel(-|$)/.test(seg)) return "agency";
  return null;
}

/** The contact fields the board needs (a subset of GHLContact). */
export interface VslContactInput {
  tags?: string[];
  attributions?: { isFirst?: boolean; url?: string }[];
  attributionSource?: { url?: string };
  lastAttributionSource?: { url?: string };
}

export interface VslAssignment {
  v: VslKey | "unclear" | null;
  how: "tag" | "tag+url" | "url" | null;
}

/** First-touch first: the first attribution, the rest of the history, then the contact's two summary records. */
function urlsOf(c: VslContactInput): string[] {
  const list = c.attributions ?? [];
  const firstOnes = list.filter((a) => a.isFirst);
  const rest = list.filter((a) => !a.isFirst);
  return [...firstOnes, ...rest, c.attributionSource ?? {}, c.lastAttributionSource ?? {}].map((a) => a.url ?? "").filter(Boolean);
}

/** Which VSL brought this contact in (null = not a VSL lead). */
export function vslOfContact(c: VslContactInput): VslAssignment {
  const tags = (c.tags ?? []).map((t) => t.trim().toLowerCase());
  const tagged = [...new Set(tags.map((t) => TAGS[t]).filter(isKey))];
  if (tagged.length === 1) return { v: tagged[0], how: "tag" };
  const urls = urlsOf(c);
  if (tagged.length > 1) {
    for (const u of urls) {
      const v = vslOfUrl(u);
      if (v && tagged.includes(v)) return { v, how: "tag+url" };
    }
    return { v: "unclear", how: null };
  }
  // No VSL tag: only a contact the funnel touched, landing on a VSL page.
  if (!tags.some((t) => FUNNEL_TAGS.has(t))) return { v: null, how: null };
  for (const u of urls) {
    const v = vslOfUrl(u);
    if (v) return { v, how: "url" };
  }
  return { v: null, how: null };
}

export const isQualifiedTag = (tags: string[] | undefined) => (tags ?? []).some((t) => t.trim().toLowerCase() === QUALIFIED_TAG);
export const hasAdvisoryBookedTag = (tags: string[] | undefined) => (tags ?? []).some((t) => t.trim().toLowerCase() === "advisory booked");

/** One VSL lead, compact and PII-free (cached). */
export interface VslLead {
  /** GoHighLevel contact id (for Marcel's corrections). */
  i: string;
  /** dateAdded, epoch ms. */
  d: number;
  v: VslKey | "unclear";
  how: VslAssignment["how"];
  /** Qualified (or booked). */
  q: 0 | 1;
  b: 0 | 1;
  w: 0 | 1;
  /** Came from Meta (has Meta attribution). */
  m: 0 | 1;
  /** utm_content, lowercased. */
  a: string | null;
}

// ── How sure: P(each VSL has the best booking rate) ───────

/** mulberry32 — a tiny seeded generator, so the same counts always give the same %. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Marsaglia–Tsang gamma(shape, 1). */
function gamma(shape: number, r: () => number): number {
  if (shape < 1) return gamma(shape + 1, r) * Math.pow(r() || 1e-12, 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(r);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

const beta = (a: number, b: number, r: () => number) => {
  const x = gamma(a, r);
  const y = gamma(b, r);
  return x / (x + y);
};

function seedOf(counts: { n: number; b: number }[]): number {
  let h = 2166136261;
  for (const c of counts) for (const v of [c.n, c.b, 7]) h = Math.imul(h ^ v, 16777619);
  return h >>> 0;
}

/**
 * For each arm (n leads, b booked): the chance its true booking rate is the
 * highest, and its 10th–90th percentile range. Beta(1+b, 1+n−b), 20,000 draws.
 */
export function pBest(arms: { n: number; b: number }[], draws = 20000): { p: number; lo: number; hi: number }[] {
  if (!arms.length) return [];
  const r = rng(seedOf(arms));
  const wins = arms.map(() => 0);
  const samples: number[][] = arms.map(() => []);
  for (let k = 0; k < draws; k++) {
    let best = -1;
    let bi = 0;
    for (let i = 0; i < arms.length; i++) {
      const s = beta(1 + arms[i].b, 1 + Math.max(0, arms[i].n - arms[i].b), r);
      if (k < 4000) samples[i].push(s);
      if (s > best) {
        best = s;
        bi = i;
      }
    }
    wins[bi]++;
  }
  return arms.map((_, i) => {
    const s = samples[i].sort((a, b) => a - b);
    return { p: wins[i] / draws, lo: s[Math.floor(s.length * 0.1)], hi: s[Math.floor(s.length * 0.9)] };
  });
}

// ── The board ──────────────────────────────────────────────

export interface VslRow {
  key: VslKey;
  label: string;
  path: string;
  note: string | null;
  leads: number;
  /** Leads at least VSL_MATURE_DAYS old (the booking rate's base). */
  matureLeads: number;
  matureBooked: number;
  qualified: number;
  booked: number;
  won: number;
  /** matureBooked ÷ matureLeads. */
  bookingRate: number | null;
  /** 10th–90th percentile of the true booking rate. */
  range: [number, number] | null;
  /** Chance this VSL books best (null when it has no mature leads). */
  pBest: number | null;
  /** Meta spend on ads that send people to this VSL. */
  spendCents: number | null;
  /** Leads and booked calls that came from Meta (for cost per lead / booked call). */
  metaLeads: number;
  metaBooked: number;
  cplCents: number | null;
  cpbCents: number | null;
  /** Ads pointing here (inferred = matched from their leads, not their link). */
  ads: number;
  inferredAds: number;
  flags: string[];
}

export type VslVerdictKind = "clear" | "leading" | "close" | "no_bookings" | "no_data";

export interface VslBoard {
  since: string;
  until: string;
  matureDays: number;
  rows: VslRow[];
  /** Contacts with two VSL tags and no URL to tell them apart. */
  unclear: number;
  /** Spend on ads whose VSL couldn't be told. */
  unassignedSpendCents: number;
  verdict: { kind: VslVerdictKind; best: VslKey | null; p: number | null; text: string };
  scanned: number;
  truncated: boolean;
  error: string | null;
  correctionsApplied: number;
  /** When the numbers were read (ISO). */
  at: string;
}

/** What each ad cost over the window, where it points, and which VSL its credited leads came through. */
export interface VslAdSpend {
  adId: string;
  spendCents: number;
  /** VSL from the ad's link (null = not a VSL page / unknown). */
  vsl: VslKey | null;
}

const pctText = (p: number) => `${Math.round(p * 100)}%`;

export function vslVerdict(rows: VslRow[]): VslBoard["verdict"] {
  const withLeads = rows.filter((r) => r.matureLeads > 0);
  if (!withLeads.length) return { kind: "no_data", best: null, p: null, text: "No VSL leads old enough to judge yet." };
  const booked = rows.reduce((t, r) => t + r.matureBooked, 0);
  if (!booked) return { kind: "no_bookings", best: null, p: null, text: "No booked calls from any VSL yet — nothing to compare." };
  const top = [...withLeads].sort((a, b) => (b.pBest ?? 0) - (a.pBest ?? 0))[0];
  const p = top.pBest ?? 0;
  if (p >= 0.9 && top.matureBooked >= 3) return { kind: "clear", best: top.key, p, text: `${top.label} is the clear winner — ${pctText(p)} likely to book best.` };
  if (p >= 0.6) return { kind: "leading", best: top.key, p, text: `${top.label} is leading — ${pctText(p)} likely to book best. Not proven yet.` };
  return { kind: "close", best: top.key, p, text: `${top.label} is ahead (${pctText(p)} likely to book best), but the gap could still be luck.` };
}

/**
 * The scoreboard from the VSL leads (already corrected) and the window's ad
 * spend. `adOf` credits a lead to an ad (utm_content), for working out the
 * VSL of ads whose link doesn't say.
 */
export function buildVslBoard(o: {
  leads: VslLead[];
  spend: VslAdSpend[];
  adOf: (l: VslLead) => string | null;
  since: string;
  until: string;
  now: number;
  scanned: number;
  truncated: boolean;
  error: string | null;
  correctionsApplied: number;
}): VslBoard {
  const matureBefore = o.now - VSL_MATURE_DAYS * 86_400_000;
  // Ads whose link doesn't name a VSL: the VSL ≥80% of their credited leads came through (2+ leads).
  const leadVsl = new Map<string, Map<VslKey, number>>();
  for (const l of o.leads) {
    if (l.v === "unclear") continue;
    const ad = o.adOf(l);
    if (!ad) continue;
    const m = leadVsl.get(ad) ?? new Map<VslKey, number>();
    m.set(l.v, (m.get(l.v) ?? 0) + 1);
    leadVsl.set(ad, m);
  }
  const inferred = (adId: string): VslKey | null => {
    const m = leadVsl.get(adId);
    if (!m) return null;
    const total = [...m.values()].reduce((t, n) => t + n, 0);
    const [k, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return total >= 2 && n / total >= 0.8 ? k : null;
  };
  const spendBy = new Map<VslKey, { cents: number; ads: number; inferred: number }>();
  let unassigned = 0;
  for (const s of o.spend) {
    if (s.spendCents <= 0) continue;
    const viaLink = s.vsl;
    const v = viaLink ?? inferred(s.adId);
    if (!v) {
      unassigned += s.spendCents;
      continue;
    }
    const cur = spendBy.get(v) ?? { cents: 0, ads: 0, inferred: 0 };
    spendBy.set(v, { cents: cur.cents + s.spendCents, ads: cur.ads + 1, inferred: cur.inferred + (viaLink ? 0 : 1) });
  }

  const base = VSLS.map((v) => {
    const mine = o.leads.filter((l) => l.v === v.key);
    const mature = mine.filter((l) => l.d <= matureBefore);
    const meta = mine.filter((l) => l.m);
    const sp = spendBy.get(v.key);
    const metaLeads = meta.length;
    const metaBooked = meta.reduce((t, l) => t + l.b, 0);
    return {
      key: v.key,
      label: v.label,
      path: v.path,
      note: v.note,
      leads: mine.length,
      matureLeads: mature.length,
      matureBooked: mature.reduce((t, l) => t + l.b, 0),
      qualified: mine.reduce((t, l) => t + (l.q || l.b ? 1 : 0), 0),
      booked: mine.reduce((t, l) => t + l.b, 0),
      won: mine.reduce((t, l) => t + l.w, 0),
      spendCents: sp ? sp.cents : null,
      metaLeads,
      metaBooked,
      cplCents: sp && metaLeads ? Math.round(sp.cents / metaLeads) : null,
      cpbCents: sp && metaBooked ? Math.round(sp.cents / metaBooked) : null,
      ads: sp?.ads ?? 0,
      inferredAds: sp?.inferred ?? 0,
    };
  });
  const arms = base.filter((r) => r.matureLeads > 0);
  const probs = pBest(arms.map((r) => ({ n: r.matureLeads, b: r.matureBooked })));
  const probOf = new Map(arms.map((r, i) => [r.key, probs[i]]));
  const rows: VslRow[] = base.map((r) => {
    const pr = probOf.get(r.key);
    const flags: string[] = [];
    if (r.leads > 0 && r.leads < 10) flags.push("fewer than 10 leads");
    if (r.leads === 0) flags.push("no leads yet");
    if (r.inferredAds) flags.push(`${r.inferredAds} ad${r.inferredAds === 1 ? "" : "s"} matched by their leads`);
    return {
      ...r,
      bookingRate: r.matureLeads ? r.matureBooked / r.matureLeads : null,
      range: pr ? [pr.lo, pr.hi] : null,
      pBest: pr ? pr.p : null,
      flags,
    };
  });
  return {
    since: o.since,
    until: o.until,
    matureDays: VSL_MATURE_DAYS,
    rows,
    unclear: o.leads.filter((l) => l.v === "unclear").length,
    unassignedSpendCents: unassigned,
    verdict: vslVerdict(rows),
    scanned: o.scanned,
    truncated: o.truncated,
    error: o.error,
    correctionsApplied: o.correctionsApplied,
    at: new Date(o.now).toISOString(),
  };
}

/** One line for Today's plan, the morning email and the chat brief. */
export interface VslHeadline {
  kind: VslVerdictKind;
  best: VslKey | null;
  label: string | null;
  booked: number;
  leads: number;
  rate: number | null;
  p: number | null;
  text: string;
}

export function vslHeadline(b: VslBoard | null): VslHeadline | null {
  if (!b) return null;
  const top = b.verdict.best ? b.rows.find((r) => r.key === b.verdict.best) ?? null : null;
  const stat = top && top.bookingRate !== null ? ` — ${top.matureBooked} of ${top.matureLeads} booked (${Math.round(top.bookingRate * 100)}%)` : "";
  const text =
    b.verdict.kind === "no_data" || b.verdict.kind === "no_bookings"
      ? b.verdict.text
      : b.verdict.kind === "clear"
        ? `${top?.label}${stat} · clear winner`
        : b.verdict.kind === "leading"
          ? `${top?.label}${stat} · leading, ${Math.round((b.verdict.p ?? 0) * 100)}% likely best`
          : `Too close to call · ${top?.label} ahead${stat}`;
  return {
    kind: b.verdict.kind,
    best: b.verdict.best,
    label: top?.label ?? null,
    booked: top?.matureBooked ?? 0,
    leads: top?.matureLeads ?? 0,
    rate: top?.bookingRate ?? null,
    p: b.verdict.p,
    text,
  };
}

/** Compact rows for Manus and the chat. */
export function vslPackSummary(b: VslBoard | null) {
  if (!b) return null;
  return {
    since: b.since,
    through: b.until,
    verdict: b.verdict.text,
    note: `Booking rate = booked ÷ leads at least ${b.matureDays} days old. best_chance = the chance this VSL truly books best given the counts so far.`,
    vsls: b.rows.map((r) => ({
      vsl: r.label,
      path: r.path,
      leads: r.leads,
      qualified: r.qualified,
      booked: r.booked,
      won: r.won,
      booking_rate: r.bookingRate === null ? null : Math.round(r.bookingRate * 1000) / 1000,
      best_chance: r.pBest === null ? null : Math.round(r.pBest * 100) / 100,
      spend_usd: r.spendCents === null ? null : Math.round(r.spendCents) / 100,
      cost_per_lead_usd: r.cplCents === null ? null : Math.round(r.cplCents) / 100,
      cost_per_booked_usd: r.cpbCents === null ? null : Math.round(r.cpbCents) / 100,
    })),
    unclear_contacts: b.unclear,
  };
}
