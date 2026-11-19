import { money } from "@/lib/ads/format";
import type { AdRow } from "@/lib/ads/types";
import type { AdPlan } from "@/lib/ads/decide";
import { AUDIENCE } from "@/lib/creative-studio/offer-facts";

/**
 * What kind of creative each ad is — format and angle, as Claude read it
 * once — and how each kind performs, so the plan can say what to make more
 * of and what to stop making (pure, client-safe).
 */

export const FORMATS = {
  talking_head: "Talking head",
  ai_presenter: "AI presenter",
  b_roll_video: "B-roll video",
  screen_recording: "Screen recording",
  static_photo: "Photo",
  text_graphic: "Text graphic",
  carousel: "Carousel",
  other: "Other",
} as const;

export const ANGLES = {
  pain: "pain-led",
  proof: "proof",
  mechanism: "how it works",
  offer: "offer",
  authority: "authority",
  curiosity: "curiosity",
  other: "other angle",
} as const;

export type CreativeFormat = keyof typeof FORMATS;
export type CreativeAngle = keyof typeof ANGLES;

export interface CreativeTags {
  format: CreativeFormat;
  angle: CreativeAngle;
  /** The opening line or image, in a few words. */
  hook: string;
  /** What the creative is, in one sentence. */
  summary: string;
}

const VIDEO_FORMATS: CreativeFormat[] = ["talking_head", "ai_presenter", "b_roll_video", "screen_recording"];
export const isVideoFormat = (f: CreativeFormat) => VIDEO_FORMATS.includes(f);
export const typeKey = (t: Pick<CreativeTags, "format" | "angle">) => `${t.format}:${t.angle}`;
export const typeLabel = (t: Pick<CreativeTags, "format" | "angle">) => `${FORMATS[t.format] ?? "Other"} · ${ANGLES[t.angle] ?? "other angle"}`;

export interface TypeStat {
  key: string;
  label: string;
  format: CreativeFormat;
  angle: CreativeAngle;
  ads: number;
  live: number;
  spendCents: number;
  leads: number;
  booked: number;
  cplCents: number | null;
  cpbCents: number | null;
  best: { adId: string; name: string } | null;
  /** best = booking at or under target · weak = 2× target spent, no booked call · unproven = not enough yet. */
  verdict: "best" | "good" | "weak" | "unproven";
}

/** A card in "What to make". */
export interface MakeCard {
  label: string;
  count: number;
  format: "video" | "photo";
  why: string;
  brief: string;
  basedOn: { adId: string; name: string }[];
}

export interface StopCard {
  label: string;
  why: string;
}

/** 30-day results per creative type (only tagged ads that spent). */
export function typeStats(ads: AdRow[], tags: Record<string, CreativeTags>, targets: { cpbCents: number; cplCents: number }): TypeStat[] {
  const by = new Map<string, TypeStat & { bestCpb: number }>();
  for (const a of ads) {
    const t = tags[a.id];
    const m = a.l30;
    if (!t || !m || m.spendCents <= 0) continue;
    const key = typeKey(t);
    const cur = by.get(key) ?? { key, label: typeLabel(t), format: t.format, angle: t.angle, ads: 0, live: 0, spendCents: 0, leads: 0, booked: 0, cplCents: null, cpbCents: null, best: null, verdict: "unproven" as const, bestCpb: Infinity };
    cur.ads++;
    if (a.effectiveStatus === "ACTIVE") cur.live++;
    cur.spendCents += m.spendCents;
    cur.leads += m.ghlLeads ?? 0;
    cur.booked += m.booked ?? 0;
    const cpb = m.booked ? m.spendCents / m.booked : Infinity;
    if (cpb < cur.bestCpb || (!cur.best && (m.ghlLeads ?? 0) > 0)) {
      cur.bestCpb = cpb;
      cur.best = { adId: a.id, name: a.name };
    }
    by.set(key, cur);
  }
  return [...by.values()]
    .map((entry) => {
      const { bestCpb, ...t } = entry;
      void bestCpb;
      const cpb = t.booked ? Math.round(t.spendCents / t.booked) : null;
      const cpl = t.leads ? Math.round(t.spendCents / t.leads) : null;
      const verdict: TypeStat["verdict"] =
        cpb !== null && cpb <= targets.cpbCents ? "best" : cpb !== null && cpb <= 2 * targets.cpbCents ? "good" : t.booked === 0 && t.spendCents >= 2 * targets.cpbCents ? "weak" : "unproven";
      return { ...t, cpbCents: cpb, cplCents: cpl, verdict };
    })
    .sort((a, b) => (a.cpbCents ?? Infinity) - (b.cpbCents ?? Infinity) || (a.cplCents ?? Infinity) - (b.cplCents ?? Infinity) || b.spendCents - a.spendCents);
}

/** Types to stop making: real money spent, nothing booked. */
export function stopCards(types: TypeStat[]): StopCard[] {
  return types
    .filter((t) => t.verdict === "weak")
    .map((t) => ({ label: t.label, why: `${money(t.spendCents)} spent across ${t.ads} ad${t.ads === 1 ? "" : "s"} in 30 days with no booked calls${t.leads ? ` (${t.leads} lead${t.leads === 1 ? "" : "s"})` : ""}.` }));
}

/** Counts made to add up to `add` exactly (the last card absorbs the difference; empty cards drop). */
export function fitCounts(cards: MakeCard[], add: number): MakeCard[] {
  const list = cards.filter((c) => c.count > 0).slice(0, 3);
  if (!list.length) return [];
  let total = list.reduce((t, c) => t + c.count, 0);
  while (total > add && list.length) {
    const last = list[list.length - 1];
    const cut = Math.min(last.count, total - add);
    last.count -= cut;
    total -= cut;
    if (last.count === 0) list.pop();
  }
  if (total < add && list.length) list[0].count += add - total;
  return list;
}

/** No Claude: variations of the best keeper (winner first). */
export function fallbackMake(input: { add: number; ads: AdRow[]; tags: Record<string, CreativeTags>; plan: AdPlan }): MakeCard[] {
  if (input.add <= 0) return [];
  const keep = input.plan.calls.filter((c) => c.call === "keep");
  const rank = (tag: string | null) => (tag === "winner" ? 0 : tag === "tiring" ? 1 : tag === "working" ? 2 : 3);
  const best = [...keep].sort((a, b) => rank(a.tag) - rank(b.tag) || (a.numbers.cpbCents ?? Infinity) - (b.numbers.cpbCents ?? Infinity) || (a.numbers.cplCents ?? Infinity) - (b.numbers.cplCents ?? Infinity))[0];
  const ad = best ? input.ads.find((a) => a.id === best.adId) : undefined;
  const t = ad ? input.tags[ad.id] : undefined;
  const video = t ? isVideoFormat(t.format) : ad?.creative.mediaType === "video";
  if (!ad || !best) {
    return [{ label: "New creatives", count: input.add, format: "video", why: "No creative has proven itself yet — test fresh angles.", brief: `Fresh ads for owners of CPA firms doing ${AUDIENCE.short}: lead with a pain they feel (no time, inconsistent clients, referrals drying up), show how the system fixes it, end with booking a call.`, basedOn: [] }];
  }
  return [
    {
      label: t ? typeLabel(t) : `Variations of "${ad.name}"`,
      count: input.add,
      format: video ? "video" : "photo",
      why: `"${ad.name}" is your best performer — ${best.reason}`,
      brief: [
        `Variations of the ad "${ad.name}".`,
        ad.creative.headline ? `Its headline: "${ad.creative.headline}".` : null,
        ad.creative.primaryText ? `Its copy: "${ad.creative.primaryText.slice(0, 300)}"` : null,
        t ? `What it is: ${t.summary} Hook: ${t.hook}.` : null,
        "Keep the angle that works; change the hook, the scene and the look so the audience sees something new.",
      ]
        .filter(Boolean)
        .join("\n"),
      basedOn: [{ adId: ad.id, name: ad.name }],
    },
  ];
}
