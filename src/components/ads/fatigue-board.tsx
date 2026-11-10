"use client";

import { useEffect, useMemo, useState } from "react";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { change, count, decimal, money, pct } from "@/lib/ads/format";
import { rel } from "@/lib/ads/math";
import type { AdRow, AdsSnapshot, FatigueState } from "@/lib/ads/types";
import { AdsManagerLink, Ico, Meter, Sparkline, StateBadge } from "@/components/ads/parts";
import { FATIGUE, VIZ } from "@/components/ads/viz";
import { MediaFrame, MediaLightbox } from "@/components/ads/media-frame";

export interface CreativeVerdict {
  verdict: string;
  why: string;
  iterateIdea: string | null;
}

interface Media {
  mediaType: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  videoUrl: string | null;
  permalinkUrl: string | null;
  primaryText: string | null;
  headline: string | null;
  ctaLabel: string | null;
  linkDomain: string | null;
}

type Filter = "all" | "fatigued" | "watch" | "winners" | "too_early" | "off";

const FILTERS: { id: Filter; label: string; test: (a: AdRow) => boolean }[] = [
  { id: "all", label: "All", test: (a) => a.effectiveStatus === "ACTIVE" || a.metrics.cur.spendCents > 0 },
  { id: "fatigued", label: "Fatigued", test: (a) => a.fatigue.state === "fatigued" || a.fatigue.state === "dead" },
  { id: "watch", label: "Watch", test: (a) => a.fatigue.state === "watch" },
  { id: "winners", label: "Winners", test: (a) => a.winner },
  { id: "too_early", label: "Too early", test: (a) => a.fatigue.state === "too_early" || a.fatigue.state === "fresh" },
  { id: "off", label: "Not running", test: (a) => a.effectiveStatus !== "ACTIVE" },
];

const PAGE = 12;
const VERDICT_LABEL: Record<string, string> = { keep: "Keep", scale: "Scale", iterate: "Make variations", watch: "Watch", refresh: "Refresh", pause: "Pause", too_early: "Too early" };

export function FatigueBoard({
  s,
  verdicts,
  onVariations,
}: {
  s: AdsSnapshot;
  verdicts?: Record<string, CreativeVerdict>;
  /** "Make variations" → Creative Studio with a brief from this ad. */
  onVariations?: (ad: AdRow, idea: string | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [media, setMedia] = useState<Record<string, Media>>({});
  const [open, setOpen] = useState<AdRow | null>(null);

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    return s.ads.filter(f.test);
  }, [s.ads, filter]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, s.ads.filter(f.test).length])) as Record<Filter, number>, [s.ads]);
  const visible = list.slice(0, shown);
  const wantIds = visible.map((a) => a.id).filter((id) => !media[id]);
  const wantKey = wantIds.join(",");

  // Bigger stills and playable video for the cards on screen (12 at a time).
  useEffect(() => {
    if (!wantKey) return;
    let live = true;
    const ids = wantKey.split(",").slice(0, 12);
    fetch(`/api/dashboard/ads/media?ids=${ids.join(",")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { byId?: Record<string, Media> } | null) => {
        if (live && d?.byId) setMedia((m) => ({ ...m, ...d.byId }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wantKey]);

  return (
    <div>
      <div className="cs-scroll -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              setShown(PAGE);
            }}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-bold transition-colors ${
              filter === f.id ? "border-blue-500 bg-blue-600 text-white" : "border-white/10 bg-white/5 text-neutral-400 hover:text-white"
            }`}
          >
            {f.label} <span className="opacity-70" style={NUM_FONT}>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-neutral-400">Nothing here for this period.</p>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((a) => (
            <CreativeCard
              key={a.id}
              ad={a}
              s={s}
              media={media[a.id]}
              verdict={verdicts?.[a.id]}
              onOpen={() => setOpen(a)}
              onVariations={onVariations}
            />
          ))}
        </div>
      )}
      {list.length > shown && (
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="min-h-10 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-300 hover:text-white">
            Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}
          </button>
        </div>
      )}
      {open && <Lightbox ad={open} media={media[open.id]} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className="truncate text-sm font-bold text-white" style={NUM_FONT}>
        {value}
      </p>
      {sub && <p className="truncate text-[10px] text-neutral-400" style={NUM_FONT}>{sub}</p>}
    </div>
  );
}

function CreativeCard({
  ad,
  s,
  media,
  verdict,
  onOpen,
  onVariations,
}: {
  ad: AdRow;
  s: AdsSnapshot;
  media?: Media;
  verdict?: CreativeVerdict;
  onOpen: () => void;
  onVariations?: (ad: AdRow, idea: string | null) => void;
}) {
  const [more, setMore] = useState(false);
  const f = FATIGUE[ad.fatigue.state];
  const img = media?.posterUrl || media?.thumbnailUrl || ad.creative.thumbnailUrl;
  const isVideo = (media?.mediaType ?? ad.creative.mediaType) === "video";
  const campaign = s.campaigns.find((c) => c.id === ad.campaignId)?.name;
  const adset = s.adsets.find((x) => x.id === ad.adsetId)?.name;
  const l7 = ad.l7;
  const b14 = ad.base14;
  const l30 = ad.l30;
  const ctrChange = rel(l7?.ctr ?? null, b14?.ctr ?? null);
  const ctrDaily = ad.daily.map((d) => (d.impressions ? d.linkClicks / d.impressions : null));
  const scoreColor = ad.fatigue.score !== null && ad.fatigue.score >= 70 ? VIZ.status.serious : ad.fatigue.score !== null && ad.fatigue.score >= 35 ? VIZ.status.warning : VIZ.status.good;

  return (
    <article id={`ad-${ad.id}`} className="flex scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] md:scroll-mt-20">
      {/* The creative at its real shape — a 9:16 video shows full height, nothing cropped. */}
      <div className="bg-black/50 px-2 pt-2">
        <MediaFrame
          kind={isVideo ? "video" : "image"}
          src={img}
          videoUrl={media?.videoUrl ?? null}
          trustImage={Boolean(media?.posterUrl)}
          onOpen={onOpen}
          label={`Open ${ad.name}`}
        >
          <span className="absolute left-2 top-2">
            <StateBadge state={ad.fatigue.state} />
          </span>
          {ad.winner && (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-100 backdrop-blur-sm">
              <Ico d={<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22m7-7.34V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />} size={11} />
              Winner
            </span>
          )}
        </MediaFrame>
        <div className="h-2" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold text-white">{ad.name}</h3>
          <p className="truncate text-[11px] text-neutral-400">{[campaign, adset].filter(Boolean).join(" › ") || "—"}</p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            <span>Fatigue</span>
            <span style={NUM_FONT}>{ad.fatigue.score !== null ? `${ad.fatigue.score}/100` : f.blurb}</span>
          </div>
          <Meter value={ad.fatigue.score !== null ? ad.fatigue.score / 100 : 0} color={ad.fatigue.score !== null ? scoreColor : VIZ.previous} label={`Fatigue ${ad.fatigue.score ?? 0} of 100`} />
          <ul className="mt-2 space-y-1">
            {(more ? ad.fatigue.reasons : ad.fatigue.reasons.slice(0, 2)).map((r, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-neutral-300">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: f.color }} />
                {r}
              </li>
            ))}
          </ul>
          {ad.fatigue.reasons.length > 2 && (
            <button type="button" onClick={() => setMore((m) => !m)} className="mt-1 min-h-8 text-[11px] font-semibold text-cyan-300 hover:underline">
              {more ? "Less" : `${ad.fatigue.reasons.length - 2} more`}
            </button>
          )}
        </div>

        {verdict && (
          <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.08] px-3 py-2">
            <p className="text-[11px] font-bold text-violet-200">Manus: {VERDICT_LABEL[verdict.verdict] ?? verdict.verdict}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-violet-100/80">{verdict.why}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Spend" value={money(ad.metrics.cur.spendCents)} sub={`30d ${money(l30?.spendCents ?? null)}`} />
          <Stat label="Booked (30d)" value={count(l30?.booked ?? null)} sub={l30?.won ? `${l30.won} won` : l30?.ghlLeads !== null && l30?.ghlLeads !== undefined ? `${l30.ghlLeads} leads` : undefined} />
          <Stat label="Cost / booked" value={money(l30?.costPerBookedCents ?? null)} sub="last 30 days" />
          <Stat label="CTR 7d" value={pct(l7?.ctr ?? null)} sub={ctrChange !== null ? `${change(ctrChange)} vs 14d` : undefined} />
          <Stat label="Freq. 7d" value={decimal(l7?.frequency ?? null, 1)} sub={l7?.cpmCents ? `CPM ${money(l7.cpmCents)}` : undefined} />
          {isVideo ? (
            <Stat label="Hook / hold" value={`${pct(l7?.hookRate ?? null, 0)} / ${pct(l7?.holdRate ?? null, 0)}`} sub="last 7 days" />
          ) : (
            <Stat label="CPC 7d" value={money(l7?.cpcCents ?? null)} sub={b14?.cpcCents ? `was ${money(b14.cpcCents)}` : undefined} />
          )}
        </div>

        {ctrDaily.filter((v) => v !== null).length >= 4 && (
          <div>
            <Sparkline values={ctrDaily} height={24} />
            <p className="mt-0.5 text-[10px] text-neutral-400">Link CTR, last 28 days</p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2">
          <AdsManagerLink href={ad.adsManagerUrl} />
          {onVariations && (ad.winner || ad.fatigue.state === "fatigued" || ad.fatigue.state === "watch" || verdict?.verdict === "iterate") && (
            <button type="button" onClick={() => onVariations(ad, verdict?.iterateIdea ?? null)} className="min-h-9 rounded-full bg-white/10 px-3 text-[11px] font-bold text-white hover:bg-white/15">
              Make variations
            </button>
          )}
        </div>
        {ad.attribution === "shared_name" && <p className="text-[10px] text-amber-300/80">Another ad shares this name, so its leads are a best guess.</p>}
      </div>
    </article>
  );
}

function Lightbox({ ad, media, onClose }: { ad: AdRow; media?: Media; onClose: () => void }) {
  const poster = media?.posterUrl || media?.thumbnailUrl || ad.creative.thumbnailUrl;
  const text = media?.primaryText ?? ad.creative.primaryText;
  const headline = media?.headline ?? ad.creative.headline;
  const isVideo = (media?.mediaType ?? ad.creative.mediaType) === "video";
  return (
    <MediaLightbox
      title={ad.name}
      badge={<StateBadge state={ad.fatigue.state as FatigueState} />}
      kind={isVideo ? "video" : "image"}
      src={poster}
      videoUrl={media?.videoUrl ?? null}
      onClose={onClose}
      side={
        <>
          {text && <p className="whitespace-pre-wrap text-neutral-200">{text}</p>}
          {headline && <p className="font-bold">{headline}</p>}
          {(media?.ctaLabel || media?.linkDomain) && <p className="text-xs text-neutral-400">{[media?.linkDomain, media?.ctaLabel].filter(Boolean).join(" · ")}</p>}
          <ul className="space-y-1 border-t border-white/10 pt-3">
            {ad.fatigue.reasons.map((r, i) => (
              <li key={i} className="text-xs text-neutral-300">
                • {r}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-x-4">
            <AdsManagerLink href={ad.adsManagerUrl} />
            {media?.permalinkUrl && <AdsManagerLink href={media.permalinkUrl} label="View post" />}
          </div>
        </>
      }
    />
  );
}
