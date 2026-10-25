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

function PlatformIcon({ k }: { k: PlatformRow["key"] }) {
  if (k === "facebook") return <FacebookLogo size={22} />;
  if (k === "instagram") return <InstagramLogo size={22} />;
  return (
    <span
      className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold"
      style={{ background: "var(--input-bg)", color: "var(--text-muted)", border: "1px solid var(--card-border)" }}
      aria-hidden="true"
    >
      {k === "total" ? "Σ" : "M"}
    </span>
  );
}

const COLUMNS: { label: string; get: (r: PlatformRow, cur: string | null) => string }[] = [
  { label: "Spend", get: (r, c) => money(r.spendCents, c) },
  { label: "Leads", get: (r) => String(r.leads) },
  { label: "Cost per lead", get: (r, c) => money(r.cplCents, c) },
  { label: "Booked calls", get: (r) => String(r.booked) },
  { label: "Cost per booked call", get: (r, c) => money(r.costPerBookedCents, c) },
  { label: "Lead → booked", get: (r) => pct(r.bookedRate) },
];

const GRID = "grid grid-cols-[minmax(140px,1.4fr)_repeat(6,minmax(0,1fr))] gap-3 items-center";

function PlatformTable({ data }: { data: AdsOverviewData }) {
  const rows = [...data.platforms, data.totals];
  return (
    <>
      {/* ≥640px: table */}
      <div className="hidden sm:block glass-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div
              className={`${GRID} px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em]`}
              style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--card-border)" }}
            >
              <span>Platform</span>
              {COLUMNS.map((c) => (
                <span key={c.label} className="text-right">
                  {c.label}
                </span>
              ))}
            </div>
            {rows.map((r) => {
              const isTotal = r.key === "total";
              return (
                <div
                  key={r.key}
                  className={`${GRID} px-5 py-3.5 text-sm tabular-nums`}
                  style={{
                    color: "var(--text-main)",
                    borderTop: isTotal ? "1px solid var(--card-border)" : undefined,
                    background: isTotal ? "var(--input-bg)" : undefined,
                    fontWeight: isTotal ? 700 : 500,
                  }}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <PlatformIcon k={r.key} />
                    <span className="truncate">{r.label}</span>
                  </span>
                  {COLUMNS.map((c) => (
                    <span key={c.label} className="text-right">
                      {c.get(r, data.currency)}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* <640px: stacked cards */}
      <div className="sm:hidden space-y-3">
        {rows.map((r) => (
          <div
            key={r.key}
            className="glass-card p-4"
            style={r.key === "total" ? { background: "var(--input-bg)" } : undefined}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <PlatformIcon k={r.key} />
              <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                {r.label}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {COLUMNS.map((c) => (
                <div key={c.label}>
                  <dt className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {c.label}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-main)" }}>
                    {c.get(r, data.currency)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

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
          <PlatformTable data={full} />
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
          <BusinessTiles data={full} />
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
