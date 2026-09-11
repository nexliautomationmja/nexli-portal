"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChartIcon } from "@/components/ui/icons";

interface Bucket {
  key: string;
  label: string;
  total: number;
  booked: number;
  won: number;
}

interface RecentLead {
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

interface AdAnalyticsData {
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

const dateRanges = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "All", value: "all" },
];

const EMPTY: AdAnalyticsData = {
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function rate(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function AdAnalyticsSection() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [data, setData] = useState<AdAnalyticsData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: string, refresh: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/dashboard/ad-analytics?days=${range}${refresh ? "&refresh=1" : ""}`
      );
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.message || body.error || `Request failed (${r.status})`);
        setData({ ...EMPTY, range });
        return;
      }
      setData(body as AdAnalyticsData);
    } catch {
      setError("Couldn't reach the analytics API. Check your connection and reload.");
      setData({ ...EMPTY, range });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days, false);
  }, [days, load]);

  const { summary, diagnostics } = data;
  const profileUrl = (id: string) =>
    data.ghlLocationId
      ? `https://app.gohighlevel.com/v2/location/${data.ghlLocationId}/contacts/detail/${id}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
            Ad Analytics
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Which campaigns and creatives drive booked calls, from the UTM data on your
            GoHighLevel contacts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-[var(--card-border)] overflow-hidden">
            {dateRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setDays(range.value)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background:
                    days === range.value
                      ? "linear-gradient(135deg, #2563EB, #06B6D4)"
                      : "transparent",
                  color: days === range.value ? "#fff" : "var(--text-muted)",
                }}
              >
                {range.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days, true)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--card-border)] transition-colors disabled:opacity-40"
            style={{ color: "var(--text-muted)" }}
            title="Re-scan GoHighLevel now instead of using the 10-minute cache"
          >
            Refresh
          </button>
        </div>
      </div>

      {!loading && !data.connected && (
        <Notice
          title="Connect GoHighLevel to see ad analytics"
          detail={
            <>
              Ad Analytics reads UTM attribution from your GHL contacts. Add your Location ID in{" "}
              <Link href="/dashboard/settings" className="underline">
                Settings
              </Link>{" "}
              and hit Connect.
            </>
          }
        />
      )}

      {!loading && error && (
        <Notice title="GoHighLevel didn't return contacts" detail={error} />
      )}

      {!loading && !error && data.connected && diagnostics.scanned > 0 && diagnostics.withUtm === 0 && (
        <Notice
          title={`None of the ${diagnostics.scanned} contacts added in this window carry UTM data`}
          detail="Open one of those leads in GoHighLevel and check where the UTM values live. They need to be in the contact's Attribution panel or in custom fields named utm_source, utm_campaign and utm_content. If the values are only in the contact's notes or in a workflow, they can't be reported on."
        />
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Ad Leads", value: String(summary.totalLeads) },
          { label: "Booked Calls", value: String(summary.bookedCalls) },
          { label: "Booking Rate", value: rate(summary.bookedCalls, summary.totalLeads) },
          { label: "Won", value: String(summary.won) },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </p>
            <p className="stat-value" style={{ color: "var(--text-main)" }}>
              {loading ? "..." : stat.value}
            </p>
          </div>
        ))}
      </div>

      {!loading && data.connected && !error && (
        <p className="text-xs -mt-2" style={{ color: "var(--text-muted)" }}>
          Scanned {diagnostics.scanned.toLocaleString("en-US")} contact
          {diagnostics.scanned === 1 ? "" : "s"} added since {formatDate(diagnostics.since)};{" "}
          {diagnostics.withUtm.toLocaleString("en-US")} with UTM attribution.
          {diagnostics.truncated ? " Scan capped at 1,000 contacts." : ""}
          {data.computedAt ? ` Updated ${new Date(data.computedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.` : ""}
        </p>
      )}

      <BucketTable
        title="By Campaign (Angle)"
        firstCol="Campaign"
        rows={data.campaigns}
        loading={loading}
        empty="No campaign data yet. Leads whose link carried utm_campaign will appear here."
      />

      <BucketTable
        title="By Creative (Ad)"
        firstCol="Creative"
        rows={data.creatives}
        loading={loading}
        empty="No creative data yet. Use utm_content in your ad URLs to track individual ads."
      />

      <BucketTable
        title="By Source"
        firstCol="Source"
        rows={data.sources}
        loading={loading}
        empty="No source data yet. Leads whose link carried utm_source will appear here."
      />

      {/* Recent Leads */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-[var(--card-border)]">
          <p className="section-header mb-0">Recent Ad Leads</p>
        </div>
        {loading ? (
          <Spinner />
        ) : data.recentLeads.length === 0 ? (
          <EmptyState message="No leads from ads yet. Contacts that arrived through a UTM-tagged link will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  {["Name", "Email", "Source", "Campaign", "Creative", "Status", "Added"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentLeads.map((lead) => {
                  const url = profileUrl(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-main)" }}>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                            title="Open in GoHighLevel"
                          >
                            {lead.name}
                          </a>
                        ) : (
                          lead.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                        {lead.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                        {lead.source || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                        {lead.campaign || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                        {lead.content || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {lead.won ? (
                          <Pill text="Won" color="text-emerald-500" bg="bg-emerald-500/10" />
                        ) : lead.booked ? (
                          <Pill text="Booked" color="text-blue-500" bg="bg-blue-500/10" />
                        ) : (
                          <Pill text="Lead" color="text-gray-400" bg="bg-gray-400/10" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDate(lead.dateAdded)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BucketTable({
  title,
  firstCol,
  rows,
  loading,
  empty,
}: {
  title: string;
  firstCol: string;
  rows: Bucket[];
  loading: boolean;
  empty: string;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-[var(--card-border)]">
        <p className="section-header mb-0">{title}</p>
      </div>
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message={empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                {[firstCol, "Leads", "Booked", "Booking Rate", "Won"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-main)" }}>
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                    {row.total}
                  </td>
                  <td className="px-4 py-3 text-sm text-blue-500 font-semibold">{row.booked}</td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                    {rate(row.booked, row.total)}
                  </td>
                  <td className="px-4 py-3 text-sm text-emerald-500 font-semibold">{row.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${color} ${bg}`}>
      {text}
    </span>
  );
}

function Notice({ title, detail }: { title: string; detail: ReactNode }) {
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{ borderColor: "rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.08)" }}
    >
      <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
        {title}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="p-12 text-center">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-3 w-10 h-10" style={{ color: "var(--text-muted)" }}>
        <ChartIcon className="w-10 h-10" />
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
        No data yet
      </p>
      <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
        {message}
      </p>
    </div>
  );
}
