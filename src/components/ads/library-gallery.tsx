"use client";

import { useMemo, useState } from "react";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { shortDay } from "@/lib/ads/time";
import type { ResearchAdView } from "@/lib/ads/research-service";
import { AdsManagerLink, Glass, Ico } from "@/components/ads/parts";
import { MediaFrame, MediaLightbox } from "@/components/ads/media-frame";

/**
 * The competitor ads Manus found in the Ad Library, each at its real shape
 * (from the stored screenshot), with how long it has run — the best public
 * signal that an ad works — and why it likely does.
 */

type Filter = "all" | "video" | "image" | "evergreen" | "new";

const FILTERS: { id: Filter; label: string; test: (a: ResearchAdView) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "video", label: "9:16 videos", test: (a) => a.format === "video_9x16" },
  { id: "image", label: "Images", test: (a) => a.format === "image" || a.format === "carousel" },
  { id: "evergreen", label: "90+ days", test: (a) => (a.daysActive ?? 0) >= 90 },
  { id: "new", label: "New", test: (a) => a.isNew },
];

const FORMAT: Record<string, string> = { video_9x16: "9:16 video", video_other: "Video", image: "Image", carousel: "Carousel", other: "Ad" };

export const LONGEVITY_CHIP: Record<string, { label: string; cls: string }> = {
  evergreen: { label: "Evergreen", cls: "border-emerald-400/35 bg-emerald-500/15 text-emerald-200" },
  proven: { label: "Proven", cls: "border-blue-400/35 bg-blue-500/15 text-blue-200" },
  testing: { label: "Testing", cls: "border-amber-400/35 bg-amber-500/15 text-amber-200" },
  new: { label: "New", cls: "border-white/15 bg-white/5 text-neutral-300" },
  unknown: { label: "Unknown age", cls: "border-white/15 bg-white/5 text-neutral-400" },
};

const PAGE = 6;

export function LibraryGallery({ ads, ourName }: { ads: ResearchAdView[]; ourName: (id: string) => string | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<ResearchAdView | null>(null);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, ads.filter(f.test).length])) as Record<Filter, number>, [ads]);
  const list = ads.filter((FILTERS.find((f) => f.id === filter) ?? FILTERS[0]).test);

  if (!ads.length) return <Glass className="p-5"><p className="text-sm text-neutral-400">No competitor ads were recorded this time.</p></Glass>;

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
            className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-bold transition-colors ${filter === f.id ? "border-blue-500 bg-blue-600 text-white" : "border-white/10 bg-white/5 text-neutral-400 hover:text-white"}`}
          >
            {f.label} <span className="opacity-70" style={NUM_FONT}>{counts[f.id]}</span>
          </button>
        ))}
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, shown).map((a) => (
          <LibraryCard key={a.ref} ad={a} ourName={ourName} onOpen={() => setOpen(a)} />
        ))}
      </div>
      {list.length > shown && (
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="min-h-10 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-300 hover:text-white">
            Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}
          </button>
        </div>
      )}
      {open && (
        <MediaLightbox
          title={`${open.advertiser} · ${open.ref}`}
          kind="image"
          src={open.screenshotUrl}
          onClose={() => setOpen(null)}
          side={<Details ad={open} ourName={ourName} full />}
        />
      )}
    </div>
  );
}

function Details({ ad, ourName, full }: { ad: ResearchAdView; ourName: (id: string) => string | null; full?: boolean }) {
  const ours = ad.similarToOurAdId ? ourName(ad.similarToOurAdId) : null;
  return (
    <>
      {ad.hook && (
        <p className="border-l-2 border-cyan-400/40 pl-2.5 text-sm italic text-neutral-100" title="Their words — for reference only, never to copy">
          “{ad.hook}”
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {ad.angle && (
          <>
            <dt className="text-neutral-500">Angle</dt>
            <dd className="text-neutral-200">{ad.angle}</dd>
          </>
        )}
        {ad.offer && (
          <>
            <dt className="text-neutral-500">Offer</dt>
            <dd className="text-neutral-200">{ad.offer}</dd>
          </>
        )}
        {ad.cta && (
          <>
            <dt className="text-neutral-500">CTA</dt>
            <dd className="text-neutral-200">{ad.cta}</dd>
          </>
        )}
        {ad.landingDomain && (
          <>
            <dt className="text-neutral-500">Lands on</dt>
            <dd className="truncate text-neutral-200">{ad.landingDomain}</dd>
          </>
        )}
      </dl>
      {ad.whyItWorks && (
        <p className="rounded-lg bg-white/[0.04] px-2.5 py-2 text-xs leading-relaxed text-neutral-300">
          <span className="font-bold text-white">Why it likely works: </span>
          {ad.whyItWorks}
        </p>
      )}
      {full && ad.textExcerpt && <p className="whitespace-pre-wrap text-xs text-neutral-400">{ad.textExcerpt}</p>}
      {ours && (
        <button
          type="button"
          onClick={() => document.getElementById(`ad-${ad.similarToOurAdId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="min-h-8 text-left text-[11px] font-semibold text-violet-200 hover:underline"
        >
          Like your ad “{ours}” →
        </button>
      )}
      <div className="flex flex-wrap gap-x-4">
        {ad.libraryUrl && <AdsManagerLink href={ad.libraryUrl} label="Open in Ad Library" />}
        {ad.pageUrl && <AdsManagerLink href={ad.pageUrl} label="Their page" />}
      </div>
    </>
  );
}

function LibraryCard({ ad, ourName, onOpen }: { ad: ResearchAdView; ourName: (id: string) => string | null; onOpen: () => void }) {
  const age = LONGEVITY_CHIP[ad.longevity] ?? LONGEVITY_CHIP.unknown;
  const isVideo = ad.format === "video_9x16" || ad.format === "video_other";
  return (
    <article id={`lib-${ad.ref}`} className="flex scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] md:scroll-mt-20">
      <div className="bg-black/50 px-2 pt-2">
        {ad.screenshotUrl ? (
          <MediaFrame
            kind="image"
            src={ad.screenshotUrl}
            known={ad.screenshot ? { w: ad.screenshot.w, h: ad.screenshot.h } : null}
            trustImage
            backdrop={false}
            onOpen={onOpen}
            label={`Open ${ad.advertiser}'s ad`}
          >
            {isVideo && <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white/90">▶ first frame</span>}
          </MediaFrame>
        ) : (
          <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-xl bg-black/40 px-4 text-center text-xs text-neutral-500">
            <Ico d={<path d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6" />} size={22} />
            No screenshot — open it in the Ad Library
          </div>
        )}
        <div className="h-2" />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{ad.advertiser}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex rounded-full border px-2 py-px text-[10px] font-bold ${age.cls}`}>{age.label}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-px text-[10px] font-bold text-neutral-300">{FORMAT[ad.format] ?? "Ad"}</span>
            {ad.isNew && <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-px text-[10px] font-bold text-violet-200">New since last research</span>}
          </div>
          <p className="mt-1 text-[11px] text-neutral-400" style={NUM_FONT}>
            {ad.daysActive !== null ? `Running ${ad.daysActive} day${ad.daysActive === 1 ? "" : "s"}` : "Start date unknown"}
            {ad.startedRunning ? ` · since ${shortDay(ad.startedRunning)}` : ""}
            {ad.versions && ad.versions > 1 ? ` · ${ad.versions} versions` : ""}
            {ad.platforms.length ? ` · ${ad.platforms.join(", ")}` : ""}
          </p>
        </div>
        <Details ad={ad} ourName={ourName} />
      </div>
    </article>
  );
}
