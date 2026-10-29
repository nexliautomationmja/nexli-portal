"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FacebookLogo, InstagramLogo } from "@/components/launch-pad/icons";
import { TopCreatives } from "@/components/dashboard/top-creatives";
import type { AdsOverviewData, PlatformRow } from "@/app/api/dashboard/ads-overview/route";

/**
 * Admin Overview — Meta ads → leads → booked calls → clients, split into
 * Facebook and Instagram. Data: /api/dashboard/ads-overview.
 */

type Range = "7" | "30" | "90";
type Response = AdsOverviewData | { configured: false; range: Range };

const RANGES: { value: Range; label: string }[] = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
];

const DASH = "—";

function money(cents: number | null, currency: string | null): string {
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

function pct(v: number | null, cap = false): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  const n = cap ? Math.min(v, 1) : v;
  return `${Math.round(n * 1000) / 10}%`;
}

function multiple(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}×`;
}

function PlatformIcon({ k, size = 22 }: { k: PlatformRow["key"]; size?: number }) {
  if (k === "facebook") return <FacebookLogo size={size} />;
  if (k === "instagram") return <InstagramLogo size={size} />;
  return (
    <span
      className="rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
      style={{ width: size, height: size, background: "var(--input-bg)", color: "var(--text-muted)", border: "1px solid var(--card-border)" }}
      aria-hidden="true"
    >
      {k === "total" ? "Σ" : "M"}
    </span>
  );
}

function count(n: number): string {
  return n.toLocaleString("en-US");
}

/** The four numbers Marcel runs the ads on, with the Facebook / Instagram split. */
const HEADLINES: {
  label: string;
  help: string;
  get: (r: PlatformRow, cur: string | null) => string;
}[] = [
  { label: "Cost per click", help: "Spend ÷ link clicks", get: (r, c) => money(r.cpcCents, c) },
  { label: "Cost per lead", help: "Spend ÷ GoHighLevel leads", get: (r, c) => money(r.cplCents, c) },
  { label: "Landing page conversion", help: "Leads ÷ landing page views", get: (r) => pct(r.lpConversion) },
  { label: "Cost per call", help: "Spend ÷ booked calls", get: (r, c) => money(r.costPerBookedCents, c) },
];

function HeadlineTiles({ data }: { data: AdsOverviewData }) {
  const split = data.platforms.filter((p) => p.key === "facebook" || p.key === "instagram");
  const lpByClicks = data.totals.lpBasis === "link_clicks";
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {HEADLINES.map((h) => (
        <div key={h.label} className="glass-card p-4 sm:p-5 flex flex-col">
          <p className="stat-label">{h.label}</p>
          <p className="stat-value mt-1 tabular-nums">{h.get(data.totals, data.currency)}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            {h.label === "Landing page conversion" && lpByClicks ? "Leads ÷ link clicks (no page views reported)" : h.help}
          </p>
          <div className="mt-3 pt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t" style={{ borderColor: "var(--card-border)" }}>
            {split.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums" style={{ color: "var(--text-main)" }}>
                <PlatformIcon k={p.key} size={14} />
                {h.get(p, data.currency)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Every metric, as rows; platforms as columns (fits phones as well as desktops). */
const DETAIL_ROWS: { label: string; get: (r: PlatformRow, cur: string | null) => string; strong?: boolean }[] = [
  { label: "Spend", get: (r, c) => money(r.spendCents, c) },
  { label: "Impressions", get: (r) => count(r.impressions) },
  { label: "CPM (per 1,000 impressions)", get: (r, c) => money(r.cpmCents, c) },
  { label: "Link clicks", get: (r) => count(r.linkClicks) },
  { label: "Click-through rate", get: (r) => pct(r.ctr) },
  { label: "Cost per click", get: (r, c) => money(r.cpcCents, c), strong: true },
  { label: "Landing page views", get: (r) => count(r.landingPageViews) },
  { label: "Landing page conversion", get: (r) => pct(r.lpConversion), strong: true },
  { label: "Leads (GoHighLevel)", get: (r) => count(r.leads) },
  { label: "Cost per lead", get: (r, c) => money(r.cplCents, c), strong: true },
  { label: "Booked calls", get: (r) => count(r.booked) },
  { label: "Cost per call", get: (r, c) => money(r.costPerBookedCents, c), strong: true },
  { label: "Lead → booked call", get: (r) => pct(r.bookedRate) },
  { label: "Leads Meta counted", get: (r) => count(r.metaLeads) },
];

function DetailTable({ data }: { data: AdsOverviewData }) {
  const cols = [...data.platforms, data.totals];
  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm tabular-nums">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
              <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--text-muted)" }}>
                Metric
              </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className="text-right px-4 sm:px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em]"
                  style={{ color: "var(--text-muted)", background: c.key === "total" ? "var(--input-bg)" : undefined }}
                >
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <PlatformIcon k={c.key} size={16} />
                    {c.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DETAIL_ROWS.map((r) => (
              <tr key={r.label} style={{ borderTop: "1px solid var(--card-border)" }}>
                <td className={`px-4 sm:px-5 py-2.5 ${r.strong ? "font-bold" : ""}`} style={{ color: r.strong ? "var(--text-main)" : "var(--text-muted)" }}>
                  {r.label}
                </td>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 sm:px-5 py-2.5 text-right ${r.strong || c.key === "total" ? "font-bold" : "font-medium"}`}
                    style={{ color: "var(--text-main)", background: c.key === "total" ? "var(--input-bg)" : undefined }}
                  >
                    {r.get(c, data.currency)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EXTEND_KEY = "nexli.adsOverview.extended";

function BusinessTiles({ data }: { data: AdsOverviewData }) {
  const b = data.business;
  const coverage = b.setupCoverage;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="glass-card p-4">
        <p className="stat-label">New clients</p>
        <p className="stat-value mt-1">{b.newClients}</p>
        <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
          DRS start date in period
        </p>
      </div>
      <div className="glass-card p-4">
        <p className="stat-label">Close rate</p>
        <p className="stat-value mt-1">{pct(b.closeRate, true)}</p>
        <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
          {b.newClients} of {b.bookedCalls} booked calls
        </p>
      </div>
      <div className="glass-card p-4">
        <p className="stat-label">CAC</p>
        <p className="stat-value mt-1">{money(b.cacCents, data.currency)}</p>
        <p
          className={`text-xs mt-1.5 font-semibold ${
            coverage === null ? "" : coverage >= 1 ? "text-emerald-500" : "text-rose-500"
          }`}
          style={coverage === null ? { color: "var(--text-muted)" } : undefined}
        >
          {coverage === null ? "Setup covers it —" : `Setup covers it ${multiple(coverage)}`}
        </p>
      </div>
      <div className="glass-card p-4">
        <p className="stat-label">Cash ROAS</p>
        <p className="stat-value mt-1">{multiple(b.cashRoas)}</p>
        <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
          {money(b.cashCollectedCents, null)} collected from new clients
        </p>
      </div>
    </div>
  );
}

function ConnectCard() {
  const steps = [
    <>
      In Meta <b>Business Settings → Users → System users</b>, add one (Admin or Employee), use{" "}
      <b>Assign assets</b> to give it your ad account with “View performance”, then{" "}
      <b>Generate token</b> with the <code>ads_read</code> permission (no expiry).
    </>,
    <>
      Copy your <b>Ad account ID</b> from Ads Manager — the number after <code>act_</code>.
    </>,
    <>
      In <b>Vercel → nexli-portal → Settings → Environment Variables</b> (Production), add{" "}
      <code>META_ADS_ACCESS_TOKEN</code> and <code>META_AD_ACCOUNT_ID</code>, then redeploy.
    </>,
    <>
      In each ad’s <b>URL parameters</b>, paste{" "}
      <code className="break-all">
        utm_source={"{{site_source_name}}"}&amp;utm_medium=paid_social&amp;utm_campaign=
        {"{{campaign.name}}"}&amp;utm_content={"{{ad.name}}"}
      </code>{" "}
      — this is what splits Facebook from Instagram leads.
    </>,
  ];
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <FacebookLogo size={20} />
        <InstagramLogo size={20} />
        <h3 className="text-sm font-semibold ml-1" style={{ color: "var(--text-main)" }}>
          Connect your Meta ad account
        </h3>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        See spend, cost per lead and cost per booked call for Facebook and Instagram right here.
      </p>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm" style={{ color: "var(--text-main)" }}>
            <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-blue-500/15 text-blue-500">
              {i + 1}
            </span>
            <span className="leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading Meta ads">
      <div className="glass-card p-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 rounded-md" style={{ background: "var(--input-bg)" }} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-4 h-[104px]">
            <div className="h-3 w-20 rounded mb-3" style={{ background: "var(--input-bg)" }} />
            <div className="h-7 w-24 rounded" style={{ background: "var(--input-bg)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Note({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
        tone === "error"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      }`}
    >
      {children}
    </div>
  );
}

export function AdsOverview() {
  const [range, setRange] = useState<Range>("30");
  const [data, setData] = useState<Response | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Remember the reader's choice (per browser; harmless if storage is blocked).
  // Only used once data has loaded, which never happens in the server render.
  const [extended, setExtended] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(EXTEND_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleExtended = () => {
    setExtended((v) => {
      try {
        localStorage.setItem(EXTEND_KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/ads-overview?range=${range}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok || !body) throw new Error(body?.error || `HTTP ${r.status}`);
        return body as Response;
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
  }, [range]);

  const days = RANGES.find((r) => r.value === range)?.value ?? "30";
  const full = data && data.configured ? (data as AdsOverviewData) : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="section-header !mb-0">Meta ads · last {days} days</p>
        {data?.configured !== false && (
          <div className="inline-flex rounded-xl border border-[var(--glass-border)] overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  if (r.value === range) return;
                  setLoading(true);
                  setFailed(null);
                  setRange(r.value);
                }}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition-all duration-200 ${
                  range === r.value
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-[var(--text-muted)] hover:bg-[var(--input-bg)]"
                }`}
                aria-pressed={range === r.value}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && !data ? (
        <Skeleton />
      ) : failed && !data ? (
        <Note tone="error">Couldn’t load Meta ads performance: {failed}</Note>
      ) : data && !data.configured ? (
        <ConnectCard />
      ) : full ? (
        <div className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {full.metaError && (
            <Note tone="error">
              <b>Meta API error:</b> {full.metaError} — Check the token’s <code>ads_read</code> access.
            </Note>
          )}
          {full.leadsError && <Note tone="warn">{full.leadsError}</Note>}
          <HeadlineTiles data={full} />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={toggleExtended}
              aria-expanded={extended}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors hover:bg-[var(--input-bg)]"
              style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
            >
              {extended ? "Collapse the view" : "Extend the view"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${extended ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
          {full.unattributedLeads > 0 && (
            <Note tone="warn">
              {full.unattributedLeads} Meta lead{full.unattributedLeads === 1 ? "" : "s"} couldn’t be
              attributed to Facebook or Instagram (counted in Total) — add{" "}
              <code>utm_source={"{{site_source_name}}"}</code> to your ads’ URL parameters. Build it in{" "}
              <Link href="/dashboard/client-tracker" className="underline font-semibold">
                the UTM builder
              </Link>
              .
            </Note>
          )}
          {extended && (
            <div className="space-y-3">
              <DetailTable data={full} />
              <BusinessTiles data={full} />
            </div>
          )}
          {full.truncated && (
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Lead counts are capped at the first 1,000 GoHighLevel contacts in this period.
            </p>
          )}
          <TopCreatives range={range} />
        </div>
      ) : null}
    </div>
  );
}
