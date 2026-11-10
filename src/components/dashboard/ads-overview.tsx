"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FacebookLogo, InstagramLogo } from "@/components/launch-pad/icons";
import { TopCreatives } from "@/components/dashboard/top-creatives";
import { ChevronDown } from "lucide-react";
import { Button, KpiGrid, KpiTile, NUM_FONT, Notice, SectionHead, Segmented, Skeleton, Surface } from "@/components/rainmaker";
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
      className="flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[10px] font-bold text-neutral-300"
      style={{ width: size, height: size }}
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
    <KpiGrid>
      {HEADLINES.map((h) => (
        <KpiTile
          key={h.label}
          label={h.label}
          value={h.get(data.totals, data.currency)}
          sub={h.label === "Landing page conversion" && lpByClicks ? "Leads ÷ link clicks (no page views reported)" : h.help}
          footer={
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/10 pt-3">
              {split.map((p) => (
                <span key={p.key} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white" style={NUM_FONT}>
                  <PlatformIcon k={p.key} size={14} />
                  <span className="sr-only">{p.label}: </span>
                  {h.get(p, data.currency)}
                </span>
              ))}
            </div>
          }
        />
      ))}
    </KpiGrid>
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
    <Surface elevated className="cs-scroll overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm" style={NUM_FONT}>
        <caption className="sr-only">Meta ads, every metric by platform</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-white/10 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-400 sm:px-5">
              Metric
            </th>
            {cols.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`border-b border-white/10 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-neutral-400 sm:px-5 ${c.key === "total" ? "bg-white/[0.04]" : ""}`}
              >
                <span className="inline-flex items-center justify-end gap-1.5">
                  <PlatformIcon k={c.key} size={16} />
                  {c.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DETAIL_ROWS.map((r) => (
            <tr key={r.label} className="transition-colors hover:bg-white/[0.02]">
              <td className={`border-t border-white/5 px-4 py-2.5 sm:px-5 ${r.strong ? "font-bold text-white" : "text-neutral-400"}`}>{r.label}</td>
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`border-t border-white/5 px-4 py-2.5 text-right sm:px-5 ${r.strong || c.key === "total" ? "font-bold text-white" : "font-medium text-neutral-200"} ${c.key === "total" ? "bg-white/[0.04]" : ""}`}
                >
                  {r.get(c, data.currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}

const EXTEND_KEY = "nexli.adsOverview.extended";

function BusinessTiles({ data }: { data: AdsOverviewData }) {
  const b = data.business;
  const coverage = b.setupCoverage;
  return (
    <KpiGrid>
      <KpiTile label="New clients" value={b.newClients} sub="DRS start date in period" />
      <KpiTile label="Close rate" value={pct(b.closeRate, true)} sub={`${b.newClients} of ${b.bookedCalls} booked calls`} />
      <KpiTile
        label="CAC"
        value={money(b.cacCents, data.currency)}
        sub={
          coverage === null ? (
            "Setup covers it —"
          ) : (
            <span className={`font-semibold ${coverage >= 1 ? "text-emerald-300" : "text-rose-300"}`}>Setup covers it {multiple(coverage)}</span>
          )
        }
      />
      <KpiTile label="Cash ROAS" value={multiple(b.cashRoas)} sub={`${money(b.cashCollectedCents, null)} collected from new clients`} />
    </KpiGrid>
  );
}

function ConnectCard() {
  const steps = [
    <>
      In Meta <b className="text-white">Business Settings → Users → System users</b>, add one (Admin or Employee), use <b className="text-white">Assign assets</b> to give it your ad
      account with “View performance”, then <b className="text-white">Generate token</b> with the <code className="rounded bg-white/10 px-1">ads_read</code> permission (no expiry).
    </>,
    <>
      Copy your <b className="text-white">Ad account ID</b> from Ads Manager: the number after <code className="rounded bg-white/10 px-1">act_</code>.
    </>,
    <>
      In <b className="text-white">Vercel → nexli-portal → Settings → Environment Variables</b> (Production), add <code className="rounded bg-white/10 px-1">META_ADS_ACCESS_TOKEN</code> and{" "}
      <code className="rounded bg-white/10 px-1">META_AD_ACCOUNT_ID</code>, then redeploy.
    </>,
    <>
      In each ad’s <b className="text-white">URL parameters</b>, paste{" "}
      <code className="break-all rounded bg-white/10 px-1">
        utm_source={"{{site_source_name}}"}&amp;utm_medium=paid_social&amp;utm_campaign=
        {"{{campaign.name}}"}&amp;utm_content={"{{ad.name}}"}
      </code>{" "}
      : this is what splits Facebook from Instagram leads.
    </>,
  ];
  return (
    <Surface className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <FacebookLogo size={20} />
        <InstagramLogo size={20} />
        <h3 className="ml-1 text-sm font-bold text-white">Connect your Meta ad account</h3>
      </div>
      <p className="mb-4 text-xs text-neutral-400">See spend, cost per lead and cost per booked call for Facebook and Instagram right here.</p>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm text-neutral-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/15 text-xs font-bold text-cyan-200">{i + 1}</span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </Surface>
  );
}

function LoadingBlocks() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading Meta ads">
      <KpiGrid>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[150px]" />
        ))}
      </KpiGrid>
      <Skeleton className="h-64" />
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

  const rangeOptions = RANGES.map((r) => ({ value: r.value, label: r.label.toUpperCase() }));

  return (
    <div>
      <SectionHead
        eyebrow="Meta ads"
        tone="lime"
        title={`Ads · last ${days} days`}
        sub="Facebook vs Instagram: what a click, a lead and a booked call cost you."
        right={
          data?.configured !== false ? (
            <Segmented
              value={range}
              options={rangeOptions}
              ariaLabel="Meta ads date range"
              busyValue={loading && data ? range : null}
              numeric
              onChange={(v) => {
                if (v === range) return;
                setLoading(true);
                setFailed(null);
                setRange(v);
              }}
            />
          ) : undefined
        }
      />

      {loading && !data ? (
        <LoadingBlocks />
      ) : failed && !data ? (
        <Notice tone="error">Couldn’t load Meta ads performance: {failed}</Notice>
      ) : data && !data.configured ? (
        <ConnectCard />
      ) : full ? (
        <div className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {full.metaError && (
            <Notice tone="error" title="Meta API error">
              {full.metaError}. Check the token’s <code className="rounded bg-white/10 px-1">ads_read</code> access.
            </Notice>
          )}
          {full.leadsError && <Notice tone="warn">{full.leadsError}</Notice>}
          <HeadlineTiles data={full} />
          <div className="flex justify-center">
            <Button variant="secondary" size="sm" onClick={toggleExtended} aria-expanded={extended}>
              {extended ? "Collapse the view" : "Extend the view"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${extended ? "rotate-180" : ""}`} aria-hidden="true" />
            </Button>
          </div>
          {full.unattributedLeads > 0 && (
            <Notice tone="warn">
              {full.unattributedLeads} Meta lead{full.unattributedLeads === 1 ? "" : "s"} couldn’t be attributed to Facebook or Instagram (counted in Total). Add{" "}
              <code className="rounded bg-white/10 px-1">utm_source={"{{site_source_name}}"}</code> to your ads’ URL parameters. Build it in{" "}
              <Link href="/dashboard/client-tracker#utm" className="font-semibold underline">
                the UTM builder
              </Link>
              .
            </Notice>
          )}
          {extended && (
            <div className="space-y-3">
              <DetailTable data={full} />
              <BusinessTiles data={full} />
            </div>
          )}
          {full.truncated && <p className="text-[11px] text-neutral-400">Lead counts are capped at the first 1,000 GoHighLevel contacts in this period.</p>}
          <TopCreatives range={range} />
        </div>
      ) : null}
    </div>
  );
}
