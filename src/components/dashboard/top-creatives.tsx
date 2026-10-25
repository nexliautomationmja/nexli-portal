"use client";

import { useEffect, useRef, useState } from "react";
import { FacebookLogo, InstagramLogo } from "@/components/launch-pad/icons";
import type { TopCreative, TopCreativesData } from "@/app/api/dashboard/ads-overview/top-creatives/route";

/**
 * Admin Overview — top 4 Meta creatives by spend, shown the way the Ads
 * Library shows an ad (page, copy, media, link bar) with the real video
 * autoplaying muted on the card; click for full size with sound. Falls back
 * to Meta's own preview iframe when the video file isn't readable.
 * Data: /api/dashboard/ads-overview/top-creatives.
 */

type Range = "7" | "30" | "90";
type Platform = "facebook" | "instagram";

const DASH = "—";

function money(cents: number | null, currency: string | null | undefined): string {
  if (cents === null || !Number.isFinite(cents)) return DASH;
  const dollars = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: dollars !== 0 && Math.abs(dollars) < 100 ? 2 : 0,
    }).format(dollars);
  } catch {
    return `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}

function pct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  return `${(Math.round(v * 10000) / 100).toFixed(2)}%`;
}

const RANK_STYLE: Record<number, { bg: string; fg: string; ring: string }> = {
  1: { bg: "linear-gradient(135deg,#fde68a,#f59e0b)", fg: "#422006", ring: "rgba(245,158,11,0.45)" },
  2: { bg: "linear-gradient(135deg,#f1f5f9,#94a3b8)", fg: "#0f172a", ring: "rgba(148,163,184,0.45)" },
  3: { bg: "linear-gradient(135deg,#fed7aa,#b45309)", fg: "#2a1405", ring: "rgba(180,83,9,0.45)" },
  4: { bg: "linear-gradient(135deg,#bfdbfe,#3b82f6)", fg: "#0b1a33", ring: "rgba(59,130,246,0.4)" },
};

function RankBadge({ rank }: { rank: number }) {
  const s = RANK_STYLE[rank] ?? RANK_STYLE[3];
  return (
    <span
      className="inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-full text-xs font-extrabold tabular-nums shadow-sm"
      style={{ background: s.bg, color: s.fg, boxShadow: `0 0 0 3px ${s.ring}` }}
      aria-label={`Rank ${rank}`}
    >
      #{rank}
    </span>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const s = (status || "").toUpperCase();
  const [label, cls] =
    s === "ACTIVE"
      ? ["Active", "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"]
      : s.includes("PAUSED")
        ? ["Paused", "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"]
        : [
            s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "Unknown",
            "bg-[var(--input-bg)] text-[var(--text-muted)] border-[var(--card-border)]",
          ];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

const FORMAT_LABEL: Record<string, string> = {
  MOBILE_FEED_STANDARD: "Facebook feed",
  INSTAGRAM_STANDARD: "Instagram feed",
  INSTAGRAM_REELS: "Instagram Reels",
};

/** Fixed-height media window, like the Ads Library: nothing is cropped. */
const MEDIA_BOX = "relative block w-full h-[360px] sm:h-[400px] overflow-hidden bg-black";

/** Meta's preview iframe (the full post as Meta renders it). */
function MetaPreviewFrame({ c, className }: { c: TopCreative; className?: string }) {
  if (!c.previewUrl) return null;
  return (
    <iframe
      src={c.previewUrl}
      title={`Meta preview of ${c.adName}`}
      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      className={className ?? "absolute inset-0 w-full h-full border-0 bg-white"}
    />
  );
}

/** Pauses card videos that scroll out of view so three reels don't all decode at once. */
function useInViewPlayback() {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function CardMedia({ c, onOpen }: { c: TopCreative; onOpen: () => void }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useInViewPlayback();
  const poster = c.posterUrl || c.thumbnailUrl;
  const isVideo = c.mediaType === "video";
  const playVideo = Boolean(c.videoUrl) && !videoFailed;
  // A video Meta won't hand over: show its cover and send the click to the post.
  const videoElsewhere = isVideo && !playVideo;
  const externalHref: string | null = null; // always play in the page, never send to Facebook

  // Nothing at all to show (no file, no still): Meta's own rendering.
  if (!playVideo && !poster && c.previewUrl) {
    return (
      <div className={MEDIA_BOX} style={{ background: "#fff" }}>
        <MetaPreviewFrame c={c} />
      </div>
    );
  }

  const badge = (
    <span
      className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-white/85 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      {isVideo ? "Video" : c.mediaType === "carousel" ? "Carousel" : "Photo"}
    </span>
  );

  const expandHint = (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover/media:opacity-100 group-focus-visible/media:opacity-100"
        style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.3)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </span>
    </span>
  );

  // Photo: shown at its own size and shape, edge to edge.
  if (!isVideo) {
    return (
      <button type="button" onClick={onOpen} aria-label={`View ${c.adName} full size`} className="group/media relative block w-full bg-black">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- Meta CDN URL, signed and short-lived
          <img src={poster} alt="" referrerPolicy="no-referrer" className="block w-full h-auto" />
        ) : (
          <span className="flex h-60 items-center justify-center text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
            No preview
          </span>
        )}
        {badge}
        {expandHint}
      </button>
    );
  }

  // Video: a 9:16 reel frame, centred, with its own blurred cover either side.
  const reel = (
    <>
      {poster && (
        <span
          aria-hidden="true"
          className="absolute inset-0 scale-125"
          style={{
            backgroundImage: `url(${poster})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(26px) brightness(0.6)",
          }}
        />
      )}
      <span className="relative mx-auto block h-[min(560px,70vh)] max-w-full overflow-hidden" style={{ aspectRatio: "9 / 16" }}>
        {playVideo ? (
          <video
            ref={videoRef}
            src={c.videoUrl ?? undefined}
            poster={poster ?? undefined}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
            className="h-full w-full object-cover pointer-events-none"
          />
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- Meta CDN URL, signed and short-lived
          <img src={poster} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : null}
      </span>
      {badge}
      {videoElsewhere ? (
        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-sm ring-2 ring-white/70 transition-transform duration-200 group-hover/media:scale-110"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
          <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-white/90" style={{ background: "rgba(0,0,0,0.55)" }}>
            Play
          </span>
        </span>
      ) : (
        expandHint
      )}
    </>
  );

  const reelBox = "group/media relative block w-full overflow-hidden bg-black";
  return externalHref ? (
    <a href={externalHref} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${c.adName} on Facebook`} className={reelBox}>
      {reel}
    </a>
  ) : (
    <button type="button" onClick={onOpen} aria-label={`Watch ${c.adName} full size`} className={reelBox}>
      {reel}
    </button>
  );
}

/** Full-size view with sound and a scrub bar. */
function Lightbox({ c, onClose }: { c: TopCreative; onClose: () => void }) {
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const poster = c.posterUrl || c.thumbnailUrl;
  const useVideo = Boolean(c.videoUrl) && !videoFailed;
  const useImage = !useVideo && Boolean(poster) && c.mediaType !== "video";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Ad creative: ${c.adName}`}
    >
      <div
        className={
          c.mediaType === "video" || !(c.posterUrl || c.thumbnailUrl)
            ? "relative flex h-[min(85vh,calc(92vw*16/9))] max-w-[92vw] items-center"
            : "relative flex max-h-[88vh] max-w-[92vw] items-center"
        }
        style={c.mediaType === "video" || !(c.posterUrl || c.thumbnailUrl) ? { aspectRatio: "9 / 16" } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {useVideo ? (
          <video
            src={c.videoUrl ?? undefined}
            poster={poster ?? undefined}
            controls
            autoPlay
            loop
            playsInline
            onError={() => setVideoFailed(true)}
            className="h-full w-full rounded-2xl object-contain bg-black"
          />
        ) : useImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- Meta CDN URL
          <img src={poster ?? ""} alt={c.adName} referrerPolicy="no-referrer" className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain" />
        ) : c.previewUrl ? (
          <MetaPreviewFrame c={c} className="h-full w-full rounded-2xl border-0 bg-white" />
        ) : (
          <p className="text-sm text-white/70">This ad has no preview Meta will share.</p>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20"
          style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.25)" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** Primary text, clamped to 3 lines like a feed post; "See more" expands it. */
function AdCopy({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <div className="px-3 pt-2 text-xs leading-relaxed" style={{ color: "var(--text-main)" }}>
      <p
        ref={ref}
        className="whitespace-pre-line"
        style={
          expanded
            ? { opacity: 0.85 }
            : { opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }
        }
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 text-[11px] font-semibold hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="px-1 py-2 text-center" title={title}>
      <dt className="text-[9px] font-black uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: "var(--text-main)" }}>
        {value}
      </dd>
    </div>
  );
}

const NO_UTM = "No GoHighLevel leads carry utm_content = this ad's name (older ads may lack UTMs).";

function CreativeCard({
  c,
  platform,
  currency,
  leadsError,
}: {
  c: TopCreative;
  platform: Platform;
  currency: string | null | undefined;
  leadsError: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const noMatch = c.booked === null;
  const tip = leadsError || NO_UTM;
  const pageName = c.pageName || "Nexli";

  return (
    <article className="glass-card overflow-hidden flex flex-col min-w-0 !p-0">
      {/* Rank · ad name · status */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <RankBadge rank={c.rank} />
        <span
          className="truncate text-[10px] font-black uppercase tracking-[0.14em]"
          style={{ color: "var(--text-muted)" }}
          title={c.adName}
        >
          {c.adName}
        </span>
        <span className="ml-auto shrink-0">
          <StatusPill status={c.status} />
        </span>
      </div>

      {/* Page row */}
      <div className="flex items-center gap-2 px-3 pt-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
        <img src="/logos/nexli-avatar.png" alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold leading-tight" style={{ color: "var(--text-main)" }}>
            {pageName}
          </span>
          <span className="block text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
            Sponsored
          </span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 opacity-70" title="Runs on Facebook and Instagram">
          <FacebookLogo size={13} />
          <InstagramLogo size={13} />
        </span>
      </div>

      {c.primaryText && <AdCopy text={c.primaryText} />}

      <div className="mt-2.5">
        <CardMedia key={`${c.adId}:${platform}`} c={c} onOpen={() => setOpen(true)} />
      </div>
      {c.previewFellBack && c.previewFormat && !c.videoUrl && (
        <p className="px-3 pt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Meta can’t render this ad for {platform === "instagram" ? "Instagram" : "Facebook"}. Showing the{" "}
          {FORMAT_LABEL[c.previewFormat] ?? c.previewFormat} version.
        </p>
      )}

      {/* Link bar */}
      {(c.headline || c.linkDomain || c.ctaLabel) && (
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "var(--input-bg)" }}>
          <span className="min-w-0 flex-1">
            {c.linkDomain && (
              <span className="block text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                {c.linkDomain}
              </span>
            )}
            {c.headline && (
              <span className="block truncate text-xs font-bold leading-tight" style={{ color: "var(--text-main)" }} title={c.headline}>
                {c.headline}
              </span>
            )}
          </span>
          {c.ctaLabel && (
            <span
              className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold"
              style={{ background: "var(--card-border)", color: "var(--text-main)" }}
            >
              {c.ctaLabel}
            </span>
          )}
        </div>
      )}

      {/* Real numbers for the selected range */}
      <dl className="grid grid-cols-3 border-t" style={{ borderColor: "var(--card-border)" }}>
        <Metric label="Spend" value={money(c.spendCents, currency)} />
        <Metric label="Leads" value={String(c.leads)} title="Lead actions Meta counted" />
        <Metric label="Per lead" value={money(c.cplCents, currency)} />
        <Metric label="Booked" value={noMatch ? DASH : String(c.booked)} title={noMatch ? tip : `${c.booked} of ${c.ghlLeads} GoHighLevel leads`} />
        <Metric label="Per booked" value={noMatch ? DASH : money(c.costPerBookedCents, currency)} title={noMatch ? tip : undefined} />
        <Metric label="CTR" value={pct(c.ctr)} />
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t px-3 py-2.5" style={{ borderColor: "var(--card-border)" }}>
        <span
          className="w-full truncate text-[11px]"
          style={{ color: "var(--text-muted)" }}
          title={[c.campaignName, c.adsetName].filter(Boolean).join(" › ")}
        >
          {c.campaignName || DASH}
          {c.adsetName ? ` › ${c.adsetName}` : ""}
        </span>
        <a
          href={c.adsManagerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 transition-colors"
        >
          Open in Ads Manager ↗
        </a>
        {c.permalinkUrl && (
          <a
            href={c.permalinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
            style={{ color: "var(--text-main)" }}
          >
            View post ↗
          </a>
        )}
      </div>

      {open && <Lightbox c={c} onClose={() => setOpen(false)} />}
    </article>
  );
}

const PLATFORMS: { value: Platform; label: string; Icon: typeof FacebookLogo }[] = [
  { value: "facebook", label: "Facebook", Icon: FacebookLogo },
  { value: "instagram", label: "Instagram", Icon: InstagramLogo },
];

export function TopCreatives({ range }: { range: Range }) {
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [data, setData] = useState<TopCreativesData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reqKey, setReqKey] = useState(`${range}:facebook`);

  // Mark loading during render when the inputs change (no setState in effect body).
  const key = `${range}:${platform}`;
  if (key !== reqKey) {
    setReqKey(key);
    setLoading(true);
    setFailed(null);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/ads-overview/top-creatives?range=${range}&format=${platform}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok || !body) throw new Error(body?.error || `HTTP ${r.status}`);
        return body as TopCreativesData;
      })
      .then((body) => {
        if (!cancelled) {
          setData(body);
          setFailed(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailed(err instanceof Error ? err.message : "Request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, platform]);

  if (data && !data.configured) return null;

  const creatives = data?.creatives ?? [];

  return (
    <section className="pt-2" aria-labelledby="top-creatives-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 id="top-creatives-title" className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
          Top 4 creatives by spend
        </h3>
        <div className="inline-flex rounded-xl border border-[var(--glass-border)] overflow-hidden" role="group" aria-label="Preview platform">
          {PLATFORMS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlatform(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                platform === value ? "bg-blue-500/20 text-blue-400" : "text-[var(--text-muted)] hover:bg-[var(--input-bg)]"
              }`}
              aria-pressed={platform === value}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3 animate-pulse" aria-busy="true" aria-label="Loading top creatives">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4 space-y-3">
              <div className="h-7 w-12 rounded-full" style={{ background: "var(--input-bg)" }} />
              <div className="h-[360px] w-full rounded-xl" style={{ background: "var(--input-bg)" }} />
              <div className="h-4 w-3/4 rounded" style={{ background: "var(--input-bg)" }} />
            </div>
          ))}
        </div>
      ) : failed && !data ? (
        <div className="rounded-xl border px-4 py-3 text-xs border-rose-500/30 bg-rose-500/10 text-rose-500">
          Couldn’t load top creatives: {failed}
        </div>
      ) : data?.error ? (
        <div className="rounded-xl border px-4 py-3 text-xs border-rose-500/30 bg-rose-500/10 text-rose-500">
          <b>Meta API error:</b> {data.error}
        </div>
      ) : creatives.length === 0 ? (
        <div className="glass-card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          No ad spend in this period
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {data?.leadsError && (
            <div className="rounded-xl border px-4 py-3 text-xs border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {data.leadsError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
            {creatives.map((c) => (
              <CreativeCard key={c.adId} c={c} platform={platform} currency={data?.currency} leadsError={data?.leadsError} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
