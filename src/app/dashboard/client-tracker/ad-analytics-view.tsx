"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Megaphone, RefreshCw } from "lucide-react";
import {
  Chip,
  DataTable,
  EmptyState,
  KpiGrid,
  KpiTile,
  MiniStat,
  NUM_FONT,
  Notice,
  PeriodChip,
  Section,
  Segmented,
  type Column,
} from "@/components/rainmaker";
import { dateOrDash } from "@/lib/format";

export interface Bucket {
  key: string;
  label: string;
  total: number;
  booked: number;
  won: number;
}

export interface RecentLead {
  id: string;
  name: string;
  email: string | null;
  source: string | null;
  campaign: string | null;
  content: string | null;
  booked: boolean;
  won: boolean;
  dateAdded: string;
}

export interface AdAnalyticsData {
  connected: boolean;
  range: string;
  ghlLocationId: string | null;
  summary: { totalLeads: number; bookedCalls: number; won: number };
  campaigns: Bucket[];
  creatives: Bucket[];
  sources: Bucket[];
  recentLeads: RecentLead[];
  diagnostics: {
    scanned: number;
    withUtm: number;
    mode: "search" | "list" | "none";
    truncated: boolean;
    since: string;
  };
  computedAt: string;
}

export const EMPTY_AD_ANALYTICS: AdAnalyticsData = {
  connected: true,
  range: "30",
  ghlLocationId: null,
  summary: { totalLeads: 0, bookedCalls: 0, won: 0 },
  campaigns: [],
  creatives: [],
  sources: [],
  recentLeads: [],
  diagnostics: { scanned: 0, withUtm: 0, mode: "none", truncated: false, since: "" },
  computedAt: "",
};

const RANGES = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "all", label: "All" },
] as const;

const BREAKDOWNS = [
  { value: "campaigns", label: "By campaign", short: "Campaign", empty: "No campaign data yet. Leads whose link carried utm_campaign will appear here." },
  { value: "creatives", label: "By creative", short: "Creative", empty: "No creative data yet. Use utm_content in your ad URLs to track individual ads." },
  { value: "sources", label: "By source", short: "Source", empty: "No source data yet. Leads whose link carried utm_source will appear here." },
] as const;
type Breakdown = (typeof BREAKDOWNS)[number]["value"];

const rate = (part: number, total: number) => (total === 0 ? "0%" : `${Math.round((part / total) * 100)}%`);
const n = (v: number) => v.toLocaleString("en-US");

function leadStatus(l: RecentLead) {
  return l.won ? { tone: "green" as const, label: "Won" } : l.booked ? { tone: "blue" as const, label: "Booked" } : { tone: "neutral" as const, label: "Lead" };
}

export function AdAnalyticsView({
  days,
  data,
  loading,
  error,
  onDays,
  onRefresh,
}: {
  days: string;
  data: AdAnalyticsData;
  loading: boolean;
  error: string | null;
  onDays: (d: string) => void;
  onRefresh: () => void;
}) {
  const [breakdown, setBreakdown] = useState<Breakdown>("campaigns");
  const { summary, diagnostics } = data;
  const period = days === "all" ? "All time" : `Last ${days} days`;
  const profileUrl = (id: string) => (data.ghlLocationId ? `https://app.gohighlevel.com/v2/location/${data.ghlLocationId}/contacts/detail/${id}` : null);
  const current = BREAKDOWNS.find((b) => b.value === breakdown)!;

  const bucketCols: Column<Bucket>[] = [
    { key: "name", header: current.short, sticky: true, className: "max-w-[320px]", cell: (b) => <span className="block truncate font-semibold text-white">{b.label}</span> },
    { key: "leads", header: "Leads", align: "right", cell: (b) => n(b.total) },
    { key: "booked", header: "Booked", align: "right", cell: (b) => n(b.booked) },
    { key: "rate", header: "Booking rate", align: "right", cell: (b) => <span className="text-cyan-300">{rate(b.booked, b.total)}</span> },
    { key: "won", header: "Won", align: "right", cell: (b) => (b.won > 0 ? <span className="font-semibold text-emerald-300">{n(b.won)}</span> : <span className="text-neutral-500">0</span>) },
  ];

  const leadName = (l: RecentLead) => {
    const url = profileUrl(l.id);
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 font-semibold text-white hover:text-cyan-200 hover:underline">
        <span className="truncate">{l.name}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-neutral-400" aria-label="Opens in GoHighLevel" />
      </a>
    ) : (
      <span className="block truncate font-semibold text-white">{l.name}</span>
    );
  };
  const leadCols: Column<RecentLead>[] = [
    { key: "name", header: "Name", sticky: true, className: "max-w-[220px]", cell: leadName },
    { key: "email", header: "Email", className: "max-w-[220px]", cell: (l) => <span className="block truncate text-neutral-300">{l.email ?? "—"}</span> },
    { key: "source", header: "Source", cell: (l) => l.source ?? <span className="text-neutral-500">—</span> },
    { key: "campaign", header: "Campaign", className: "max-w-[200px]", cell: (l) => <span className="block truncate">{l.campaign ?? "—"}</span> },
    { key: "creative", header: "Creative", className: "max-w-[200px]", cell: (l) => <span className="block truncate">{l.content ?? "—"}</span> },
    {
      key: "status",
      header: "Status",
      cell: (l) => {
        const s = leadStatus(l);
        return (
          <Chip tone={s.tone} size="xs" dot>
            {s.label}
          </Chip>
        );
      },
    },
    { key: "added", header: "Added", className: "whitespace-nowrap", cell: (l) => dateOrDash(l.dateAdded) },
  ];

  const updated = data.computedAt ? new Date(data.computedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;

  return (
    <Section
      id="ad-analytics"
      eyebrow="Ad analytics"
      title="Which ads book calls"
      sub="From the UTM tags on your GoHighLevel contacts: which campaigns and creatives turn into booked calls."
      right={
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <Segmented value={days} options={RANGES} onChange={onDays} ariaLabel="Ad analytics date range" busyValue={loading ? days : null} numeric />
          <div className="flex items-center gap-2 text-[11px] text-neutral-400" style={NUM_FONT}>
            {updated && <span>Updated {updated} · cached 10 min</span>}
            <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex min-h-8 items-center gap-1 font-semibold text-cyan-300 hover:underline disabled:opacity-50">
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!loading && !data.connected && (
          <Notice tone="info" title="Connect GoHighLevel to see ad analytics">
            Ad analytics reads UTM attribution from your GoHighLevel contacts. Add your Location ID in{" "}
            <Link href="/dashboard/settings" className="font-semibold underline">
              Settings
            </Link>{" "}
            and hit Connect.
          </Notice>
        )}
        {!loading && error && (
          <Notice tone="error" title="GoHighLevel didn't return contacts">
            {error}
          </Notice>
        )}
        {!loading && !error && data.connected && diagnostics.scanned > 0 && diagnostics.withUtm === 0 && (
          <Notice tone="warn" title={`None of the ${n(diagnostics.scanned)} contacts added in this window carry UTM data`}>
            Open one of those leads in GoHighLevel and check where the UTM values live. They need to be in the contact&apos;s Attribution panel or in custom fields named utm_source,
            utm_campaign and utm_content. Values only in notes or a workflow can&apos;t be reported on.
          </Notice>
        )}

        <KpiGrid>
          <KpiTile label="Ad leads" value={n(summary.totalLeads)} loading={loading} chip={<PeriodChip>{period}</PeriodChip>} />
          <KpiTile label="Booked calls" value={n(summary.bookedCalls)} loading={loading} />
          <KpiTile label="Booking rate" value={rate(summary.bookedCalls, summary.totalLeads)} tone="cyan" loading={loading} sub="booked ÷ leads" />
          <KpiTile label="Won" value={n(summary.won)} tone={summary.won > 0 ? "green" : "neutral"} loading={loading} sub="became clients" />
        </KpiGrid>

        {!loading && data.connected && !error && (
          <p className="text-xs text-neutral-400" style={NUM_FONT}>
            Scanned {n(diagnostics.scanned)} contact{diagnostics.scanned === 1 ? "" : "s"} added since {dateOrDash(diagnostics.since)}; {n(diagnostics.withUtm)} with UTM attribution.
            {diagnostics.truncated ? " The scan stops at 1,000 contacts." : ""}
          </p>
        )}

        <div className="pt-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white">What&apos;s working</h3>
            <Segmented
              kind="tabs"
              size="sm"
              value={breakdown}
              onChange={setBreakdown}
              ariaLabel="Breakdown"
              options={BREAKDOWNS.map((b) => ({ value: b.value, label: b.label, short: b.short }))}
            />
          </div>
          <DataTable
            caption={current.label}
            breakpoint="md"
            columns={bucketCols}
            rows={data[breakdown]}
            rowKey={(b) => b.key}
            loading={loading}
            card={(b) => (
              <div>
                <div className="truncate font-semibold text-white">{b.label}</div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <MiniStat label="Leads" value={n(b.total)} />
                  <MiniStat label="Booked" value={n(b.booked)} />
                  <MiniStat label="Rate" value={rate(b.booked, b.total)} tone="cyan" />
                  <MiniStat label="Won" value={n(b.won)} tone={b.won > 0 ? "green" : "neutral"} />
                </div>
              </div>
            )}
            empty={<EmptyState icon={<Megaphone className="h-5 w-5" aria-hidden="true" />} title="Nothing to break down yet" body={current.empty} />}
          />
        </div>

        <div className="pt-2">
          <h3 className="mb-3 text-sm font-bold text-white">Recent ad leads</h3>
          <DataTable
            caption="Recent ad leads"
            columns={leadCols}
            rows={data.recentLeads}
            rowKey={(l) => l.id}
            loading={loading}
            card={(l) => {
              const s = leadStatus(l);
              return (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">{leadName(l)}</div>
                    <Chip tone={s.tone} size="xs" dot>
                      {s.label}
                    </Chip>
                  </div>
                  {l.email && <div className="truncate text-xs text-neutral-400">{l.email}</div>}
                  <div className="mt-2 text-[11px] text-neutral-400">
                    {[l.source, l.campaign, l.content].filter(Boolean).join(" · ") || "No UTM values"} · added {dateOrDash(l.dateAdded)}
                  </div>
                </div>
              );
            }}
            empty={
              <EmptyState
                icon={<Megaphone className="h-5 w-5" aria-hidden="true" />}
                title="No leads from ads yet"
                body="Contacts that arrived through a UTM-tagged link will appear here."
              />
            }
          />
        </div>
      </div>
    </Section>
  );
}
