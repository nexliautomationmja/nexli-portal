"use client";

import { useState } from "react";
import { CTA_CLASSES, SECONDARY_BTN, SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { SP, SvgIcon } from "@/components/creative-studio/canvas";
import { count, money } from "@/lib/ads/format";
import type { AdRow, AdsSnapshot } from "@/lib/ads/types";
import type { AnalysisView } from "@/lib/ads/runs";
import type { ResearchAdView, ResearchSummaryRow, ResearchView } from "@/lib/ads/research-service";
import type { ResearchBrief } from "@/lib/ads/research-parse";
import { when } from "@/components/ads/analysis-bits";
import { Glass, Ico } from "@/components/ads/parts";
import { LiveRun, RESEARCH_COPY, WaitingPanel } from "@/components/ads/analysis-panel";
import { LibraryGallery } from "@/components/ads/library-gallery";
import { photosHref, videosHref } from "@/components/ads/handoff";

/**
 * Ad Library research inside the Creatives section: run it (Manus browses the
 * public Ad Library), watch it work, then the takeaways, ready-to-make briefs
 * for Creative Studio, the competitor gallery, Nexli's own ads worth
 * replicating, who's advertising, and earlier runs.
 */

const SOURCE: Record<string, { label: string; cls: string }> = {
  competitor: { label: "Competitor pattern", cls: "border-blue-400/30 bg-blue-500/15 text-blue-200" },
  ours: { label: "Your winner", cls: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200" },
  gap: { label: "Gap to own", cls: "border-violet-400/30 bg-violet-500/15 text-violet-200" },
};

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });

function Insights({ title, tone, items }: { title: string; tone: string; items: { title: string; detail: string; adRefs: string[] }[] }) {
  return (
    <div className="bg-[#0b1220] p-4 sm:p-5">
      <p className={`text-[11px] font-black uppercase tracking-[0.15em] ${tone}`}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-500">Nothing stood out.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((it, i) => (
            <li key={i}>
              <p className="text-sm font-semibold text-white">{it.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">{it.detail}</p>
              {it.adRefs.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {it.adRefs.map((r) => (
                    <button key={r} type="button" onClick={() => scrollTo(`lib-${r}`)} className="min-h-7 rounded-md border border-white/10 bg-white/[0.05] px-2 text-[11px] font-semibold text-cyan-200 hover:border-cyan-400/40" style={NUM_FONT}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BriefCard({ b, ads, s, studioKey }: { b: ResearchBrief; ads: ResearchAdView[]; s: AdsSnapshot; studioKey: string }) {
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const src = SOURCE[b.source] ?? SOURCE.gap;
  const photoCount = b.format === "photo" ? b.count : Math.min(20, Math.max(3, b.count + 1));
  const videoCount = b.format === "video" ? Math.min(10, b.count) : Math.min(10, Math.max(2, Math.ceil(b.count / 2)));
  const photo = (
    <button type="button" onClick={() => (window.location.href = photosHref(studioKey, b.prompt, photoCount, undefined, "ads-research"))} className={b.format === "photo" ? CTA_CLASSES : `${SECONDARY_BTN} !min-h-10 !py-2`}>
      {b.format === "photo" && <SvgIcon d={SP.image} size={14} />} Make {photoCount} photo ads
    </button>
  );
  const video = (
    <button type="button" onClick={() => (window.location.href = videosHref(studioKey, b.prompt, videoCount, "ads-research"))} className={b.format === "video" ? CTA_CLASSES : `${SECONDARY_BTN} !min-h-10 !py-2`}>
      {b.format === "video" && <SvgIcon d={SP.film} size={14} />} Make {videoCount} videos
    </button>
  );
  const basedOn = [
    ...b.basedOnRefs.map((r) => ({ key: r, img: ads.find((a) => a.ref === r)?.screenshotUrl ?? null, label: ads.find((a) => a.ref === r)?.advertiser ?? r, go: () => scrollTo(`lib-${r}`) })),
    ...b.basedOnOurAdIds.map((id) => {
      const ad = s.ads.find((a) => a.id === id);
      return { key: id, img: ad?.creative.thumbnailUrl ?? null, label: ad?.name ?? "Your ad", go: () => scrollTo(`ad-${id}`) };
    }),
  ].slice(0, 4);
  return (
    <article className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex rounded-full border px-2 py-px text-[10px] font-black uppercase tracking-wider ${src.cls}`}>{src.label}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{b.format === "video" ? "Video" : "Photo ads"}</span>
      </div>
      <h4 className="mt-1.5 text-[15px] font-bold leading-snug text-white">{b.title}</h4>
      {b.angle && <p className="mt-1 text-xs text-neutral-300">{b.angle}</p>}
      {b.hookLines.length > 0 && (
        <ul className="mt-2 space-y-1">
          {b.hookLines.map((h, i) => (
            <li key={i} className="border-l-2 border-violet-400/40 pl-2 text-xs italic text-violet-100/90">
              “{h}”
            </li>
          ))}
        </ul>
      )}
      {basedOn.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Based on</span>
          {basedOn.map((x) => (
            <button key={x.key} type="button" onClick={x.go} title={x.label} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/40 hover:border-cyan-400/40">
              {x.img ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed screenshot / Meta still
                <img src={x.img} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Ico d={<path d="M3 5h18v14H3z" />} size={12} className="text-neutral-500" />
              )}
            </button>
          ))}
        </div>
      )}
      {b.why && <p className="mt-2 text-xs text-neutral-400">{b.why}</p>}
      {b.flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {b.flags.map((f) => (
            <span key={f} className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
              {f}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">Creative Studio prompt</p>
        <p className={`mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-200 ${full ? "" : "line-clamp-4"}`}>{b.prompt}</p>
        <button type="button" onClick={() => setFull((x) => !x)} className="mt-1 min-h-8 text-[11px] font-semibold text-cyan-300 hover:underline">
          {full ? "Show less" : "Show the full prompt"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {b.format === "photo" ? (
          <>
            {photo}
            {video}
          </>
        ) : (
          <>
            {video}
            {photo}
          </>
        )}
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(b.prompt).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="min-h-10 px-2 text-xs font-semibold text-cyan-300 hover:underline"
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
    </article>
  );
}

export function ResearchPanel({
  state,
  manusConfigured,
  hasConnector,
  competitorsCount,
  s,
  studioKey,
  busy,
  starting,
  tz,
  onResearch,
  onAct,
  onRetry,
  onOpenReport,
  onVariations,
  summaryRef,
}: {
  state: { active: AnalysisView | null; latest: ResearchView | null; history: ResearchSummaryRow[] };
  manusConfigured: boolean;
  hasConnector: boolean;
  competitorsCount: number;
  s: AdsSnapshot;
  studioKey: string;
  busy: boolean;
  starting: boolean;
  tz: string;
  onResearch: () => void;
  onAct: (id: string, action: "reply" | "allow" | "stop", text?: string) => void;
  onRetry: (id: string) => void;
  onOpenReport: (id: string) => void;
  onVariations: (ad: AdRow, idea: string | null) => void;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [viewing, setViewing] = useState<ResearchView | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const shown = viewing ?? state.latest;
  const active = state.active;
  const lastFailed =
    state.history[0] && (state.history[0].status === "failed" || state.history[0].status === "stopped") && (!state.latest || new Date(state.history[0].createdAt) > new Date(state.latest.finishedAt ?? 0)) ? state.history[0] : null;
  const ourName = (id: string) => s.ads.find((a) => a.id === id)?.name ?? null;

  async function openEarlier(id: string) {
    setLoadingId(id);
    try {
      const r = await fetch(`/api/dashboard/ads/analysis/${id}`);
      const d = await r.json().catch(() => null);
      if (r.ok && d?.research) {
        setViewing(d.research as ResearchView);
        setTimeout(() => document.getElementById("research")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    } finally {
      setLoadingId(null);
    }
  }

  if (!manusConfigured) {
    return (
      <Glass className="p-5">
        <p className="text-sm text-neutral-300">Manus isn&apos;t connected yet — add MANUS_API_KEY in Vercel to research the Ad Library.</p>
      </Glass>
    );
  }

  const result = shown?.result ?? null;
  return (
    <div className="space-y-4">
      {active && (active.status === "waiting" ? <WaitingPanel a={active} busy={busy} copy={RESEARCH_COPY} onAct={(action, text) => onAct(active.id, action, text)} /> : <LiveRun a={active} busy={busy} copy={RESEARCH_COPY} onStop={() => onAct(active.id, "stop")} />)}

      {!active && lastFailed && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-100">The last research didn&apos;t finish</p>
            <p className="text-xs text-rose-200/80">{lastFailed.error ?? "It stopped before Manus answered."}</p>
          </div>
          <button type="button" disabled={busy} onClick={() => onRetry(lastFailed.id)} className="min-h-10 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/20">
            Try again
          </button>
        </div>
      )}

      {!shown && !active && (
        <div className="rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-600/[0.12] via-[#0b1220] to-blue-600/[0.08] p-5 sm:p-6">
          <p className="text-sm font-bold text-white">What Manus does</p>
          <ul className="mt-2 space-y-1.5 text-sm text-neutral-300">
            {[
              "Searches the Meta Ad Library for ads aimed at CPA firm owners and offers like yours",
              "Finds the ones that have run longest — the best public sign an ad works",
              "Compares them with your own creatives and spots gaps nobody owns",
              "Writes ready-to-make briefs you can send straight to Creative Studio",
            ].map((x) => (
              <li key={x} className="flex gap-2">
                <Ico d={<path d="M20 6 9 17l-5-5" />} size={14} className="mt-0.5 shrink-0 text-violet-300" />
                {x}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onResearch} disabled={busy} className={CTA_CLASSES}>
              <SvgIcon d={SP.search} size={15} /> {starting ? "Starting Manus…" : "Research the Ad Library"}
            </button>
            <span className="text-xs text-neutral-500">20–45 minutes · uses Manus credits</span>
          </div>
          <p className="mt-3 text-[11px] text-neutral-500">
            {competitorsCount ? `It will always check the ${competitorsCount} competitor${competitorsCount > 1 ? "s" : ""} you listed in Goals.` : (
              <>
                Know competitors already?{" "}
                <a href="#goals" className="font-semibold text-cyan-300 hover:underline">
                  Add them in Goals
                </a>{" "}
                and Manus always checks them.
              </>
            )}
            {hasConnector ? " Manus will also use its Ad Library connector." : ""}
          </p>
        </div>
      )}

      {shown && result && (
        <>
          <div ref={summaryRef} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
            <div className="p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-violet-400/30 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-violet-200">Ad Library research</span>
                {viewing && (
                  <button type="button" onClick={() => setViewing(null)} className="min-h-8 text-[11px] font-semibold text-cyan-300 hover:underline">
                    Showing {when(viewing.finishedAt, tz)} · back to the latest
                  </button>
                )}
              </div>
              <h3 className="mt-2 text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl" style={SYNE}>
                {result.headline}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">{result.summary}</p>
              <p className="mt-2 text-[11px] text-neutral-500" style={NUM_FONT}>
                {when(shown.finishedAt, tz)} · {count(result.ads.length)} ads · {result.briefs.length} briefs
                {result.screenshots ? ` · ${result.screenshots.found} of ${result.screenshots.expected} screenshots` : ""}
                {result.searched.blocked.length ? ` · ${result.searched.blocked.length} pages blocked` : ""}
              </p>
              {!hasConnector && result.searched.blocked.length > 0 && (
                <p className="mt-1 text-[11px] text-neutral-500">Tip: an Ad Library connector in Manus (Manus → Connectors) helps when pages are blocked — the next research uses it automatically.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {shown.hasReport && (
                  <button type="button" onClick={() => onOpenReport(shown.id)} className={CTA_CLASSES}>
                    <SvgIcon d={SP.file} size={15} /> Read the full report
                  </button>
                )}
                <button type="button" onClick={onResearch} disabled={busy || Boolean(active)} className={SECONDARY_BTN}>
                  {active ? "Research running…" : starting ? "Starting Manus…" : "Research again"}
                </button>
                <a href={`/api/dashboard/ads/analysis/${shown.id}/pack`} className={`${SECONDARY_BTN} inline-flex items-center gap-1.5`}>
                  <SvgIcon d={SP.download} size={14} /> What Manus saw
                </a>
              </div>
            </div>
            {(result.marketPatterns.length > 0 || result.gaps.length > 0) && (
              <div className="grid gap-px border-t border-white/5 bg-white/5 md:grid-cols-2">
                <Insights title="What's working in the market" tone="text-emerald-300" items={result.marketPatterns} />
                <Insights title="Gaps you can own" tone="text-violet-300" items={result.gaps} />
              </div>
            )}
            {result.dataNotes.length > 0 && <p className="border-t border-white/5 px-4 py-3 text-[11px] text-amber-200/80 sm:px-6">Notes: {result.dataNotes.join(" · ")}</p>}
          </div>

          {result.briefs.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-bold text-white" style={SYNE}>
                Make these next
              </h4>
              <div className="grid items-start gap-3 md:grid-cols-2">
                {result.briefs.map((b) => (
                  <BriefCard key={b.key} b={b} ads={result.ads} s={s} studioKey={studioKey} />
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-bold text-white" style={SYNE}>
              Competitor ads that last
            </h4>
            <LibraryGallery ads={result.ads} ourName={ourName} />
          </div>

          {result.replicateOurs.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-bold text-white" style={SYNE}>
                Your ads worth replicating
              </h4>
              <div className="grid gap-2 md:grid-cols-2">
                {result.replicateOurs.map((r) => {
                  const ad = s.ads.find((a) => a.id === r.ourAdId);
                  return (
                    <Glass key={r.ourAdId} className="flex gap-3 p-3">
                      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-black/40">
                        {ad?.creative.thumbnailUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- Meta CDN still
                          <img src={ad.creative.thumbnailUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{ad?.name ?? "Your ad"}</p>
                        {ad?.l30 && (
                          <p className="text-[11px] text-neutral-400" style={NUM_FONT}>
                            {count(ad.l30.booked)} booked · {money(ad.l30.costPerBookedCents)} per booked call (30 days)
                          </p>
                        )}
                        <p className="mt-1 text-xs text-neutral-300">{r.why}</p>
                        {r.howToExtend && <p className="mt-1 text-xs text-neutral-400">How: {r.howToExtend}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-x-3">
                          {ad && (
                            <button type="button" onClick={() => onVariations(ad, r.howToExtend || null)} className="min-h-8 text-[11px] font-bold text-cyan-300 hover:underline">
                              Make variations
                            </button>
                          )}
                          <button type="button" onClick={() => scrollTo(`ad-${r.ourAdId}`)} className="min-h-8 text-[11px] font-semibold text-neutral-400 hover:text-white">
                            Show the ad
                          </button>
                        </div>
                      </div>
                    </Glass>
                  );
                })}
              </div>
            </div>
          )}

          {result.competitors.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-bold text-white" style={SYNE}>
                Who&apos;s advertising
              </h4>
              <Glass className="divide-y divide-white/5">
                {result.competitors.map((c) => (
                  <div key={c.name} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">
                        {c.libraryUrl ? (
                          <a href={c.libraryUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {c.name} ↗
                          </a>
                        ) : (
                          c.name
                        )}
                      </p>
                      <p className="text-xs text-neutral-400">{c.offer}</p>
                      {c.notes && <p className="mt-0.5 text-[11px] text-neutral-500">{c.notes}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]" style={NUM_FONT}>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-bold text-neutral-300">{c.type.replace(/_/g, " ")}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-bold text-neutral-300">{c.relevance} relevance</span>
                      {c.longestRunningDays !== null && <span className="text-neutral-400">longest {c.longestRunningDays} days</span>}
                      {c.activeAdsSeen !== null && <span className="text-neutral-400">{c.activeAdsSeen} active ads</span>}
                    </div>
                  </div>
                ))}
              </Glass>
            </div>
          )}
        </>
      )}

      {state.history.length > 1 && (
        <details className="rounded-2xl border border-white/10 bg-white/[0.03]">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-neutral-300">Earlier research ({state.history.length})</summary>
          <div className="divide-y divide-white/5 border-t border-white/5">
            {state.history.map((h) => (
              <button
                key={h.id}
                type="button"
                disabled={h.status !== "done" || loadingId === h.id}
                onClick={() => void openEarlier(h.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03] disabled:cursor-default"
              >
                <span className="w-28 shrink-0 text-[11px] text-neutral-500" style={NUM_FONT}>
                  {when(h.finishedAt ?? h.createdAt, tz)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-neutral-200">{h.status === "done" ? h.headline : (h.error ?? h.status)}</span>
                {h.status === "done" && (
                  <span className="shrink-0 text-[11px] text-neutral-400" style={NUM_FONT}>
                    {h.ads} ads · {h.briefs} briefs
                  </span>
                )}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
