"use client";

import { useEffect, useState } from "react";
import { FacebookLogo, InstagramLogo } from "@/components/launch-pad/icons";
import type { TopCreative, TopCreativesData } from "@/app/api/dashboard/ads-overview/top-creatives/route";

/**
 * Admin Overview — top 3 Meta creatives by spend, rendered by Meta's own Ad
 * Previews iframe (plays like Ads Manager). Thumbnail + play overlay first;
 * the iframe loads on click so three video players never load at once.
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

/** Phone-post-sized frame: full width on mobile, capped at 320×560 (same ratio) on wider screens. */
const FRAME = "relative w-full aspect-[320/560] sm:max-w-[320px] mx-auto rounded-xl overflow-hidden";

function Preview({ c, platform }: { c: TopCreative; platform: Platform }) {
  const [open, setOpen] = useState(false);
  const isVideo = c.mediaType === "video";

  if (open && c.previewUrl) {
    return (
      <div className={FRAME} style={{ background: "#fff", border: "1px solid var(--card-border)" }}>
        <iframe
          src={c.previewUrl}
          title={`Meta preview of ${c.adName}`}
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          allow="autoplay; encrypted-media; picture-in-picture"
          loading="lazy"
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => c.previewUrl && setOpen(true)}
      disabled={!c.previewUrl}
      className={`${FRAME} group block text-left disabled:cursor-not-allowed`}
      style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)" }}
      aria-label={c.previewUrl ? `Play ${c.adName} as it appears on ${platform === "instagram" ? "Instagram" : "Facebook"}` : "Preview unavailable"}
    >
      {c.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Meta CDN URL, signed and short-lived
        <img
          src={c.thumbnailUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center opacity-60">
          {platform === "instagram" ? <InstagramLogo size={40} /> : <FacebookLogo size={40} />}
        </span>
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" aria-hidden="true" />
      {c.previewUrl ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/70 transition-transform duration-200 group-hover:scale-110">
            {isVideo ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </span>
        </span>
      ) : null}
      <span className="absolute left-3 right-3 bottom-3 text-[11px] font-semibold text-white drop-shadow">
        {c.previewUrl
          ? isVideo
            ? "Play as in Ads Manager"
            : c.mediaType === "carousel"
              ? "Open carousel preview"
              : "Open live preview"
          : c.previewError
            ? `Preview unavailable: ${c.previewError}`
            : "Preview unavailable"}
      </span>
    </button>
  );
}

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title}>
      <dt className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-main)" }}>
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
  const noMatch = c.booked === null;
  const tip = leadsError || NO_UTM;
  return (
    <article className="glass-card p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <RankBadge rank={c.rank} />
        <StatusPill status={c.status} />
      </div>

      <Preview key={`${c.adId}:${platform}`} c={c} platform={platform} />
      {c.previewFellBack && c.previewFormat && (
        <p className="text-[11px] -mt-1" style={{ color: "var(--text-muted)" }}>
          Meta can’t render this ad for {platform === "instagram" ? "Instagram" : "Facebook"} — showing the{" "}
          {FORMAT_LABEL[c.previewFormat] ?? c.previewFormat} version.
        </p>
      )}

      <div className="min-w-0">
        <h4 className="text-sm font-bold truncate" style={{ color: "var(--text-main)" }} title={c.adName}>
          {c.adName}
        </h4>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }} title={[c.campaignName, c.adsetName].filter(Boolean).join(" › ")}>
          {c.campaignName || DASH}
          {c.adsetName ? ` › ${c.adsetName}` : ""}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5">
        <Metric label="Spend" value={money(c.spendCents, currency)} />
        <Metric label="Leads" value={String(c.leads)} title="Lead actions Meta counted" />
        <Metric label="CPL" value={money(c.cplCents, currency)} />
        <Metric label="Booked" value={noMatch ? DASH : String(c.booked)} title={noMatch ? tip : `${c.booked} of ${c.ghlLeads} GoHighLevel leads`} />
        <Metric label="Cost/booked" value={noMatch ? DASH : money(c.costPerBookedCents, currency)} title={noMatch ? tip : undefined} />
        <Metric label="CTR" value={pct(c.ctr)} />
      </dl>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
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
        {c.previewUrl && (
          <a
            href={c.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
            style={{ color: "var(--text-main)" }}
          >
            Open preview ↗
          </a>
        )}
      </div>
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
          Top 3 creatives by spend
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-pulse" aria-busy="true" aria-label="Loading top creatives">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card p-4 space-y-3">
              <div className="h-7 w-12 rounded-full" style={{ background: "var(--input-bg)" }} />
              <div className={FRAME} style={{ background: "var(--input-bg)" }} />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {creatives.map((c) => (
              <CreativeCard key={c.adId} c={c} platform={platform} currency={data?.currency} leadsError={data?.leadsError} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
