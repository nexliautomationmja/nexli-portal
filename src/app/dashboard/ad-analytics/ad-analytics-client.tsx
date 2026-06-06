"use client";

import { useState, useEffect } from "react";
import { ChartIcon } from "@/components/ui/icons";

interface Summary {
  totalLeads: number;
  qualified: number;
  raw: number;
  disqualified: number;
  bookedCalls: number;
  showedCalls: number;
  opportunities: number;
  purchases: number;
}

interface CampaignRow {
  campaign: string | null;
  total: number;
  qualified: number;
  booked: number;
  purchased: number;
}

interface CreativeRow {
  creative: string | null;
  total: number;
  qualified: number;
  booked: number;
  purchased: number;
}

interface LeadRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  firmName: string | null;
  leadScore: string | null;
  formSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmSource: string | null;
  createdAt: string;
}

const scoreConfig: Record<string, { label: string; color: string; bg: string }> = {
  qualified: { label: "Qualified", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  raw: { label: "Raw", color: "text-gray-400", bg: "bg-gray-400/10" },
  disqualified: { label: "Disqualified", color: "text-red-500", bg: "bg-red-500/10" },
};

const dateRanges = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "All", value: "all" },
];

export function AdAnalyticsClient() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [summary, setSummary] = useState<Summary>({
    totalLeads: 0,
    qualified: 0,
    raw: 0,
    disqualified: 0,
    bookedCalls: 0,
    showedCalls: 0,
    opportunities: 0,
    purchases: 0,
  });
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [recentLeads, setRecentLeads] = useState<LeadRow[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/ad-analytics?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.summary || summary);
        setCampaigns(data.campaigns || []);
        setCreatives(data.creatives || []);
        setRecentLeads(data.recentLeads || []);
      })
      .catch(() => {
        setCampaigns([]);
        setCreatives([]);
        setRecentLeads([]);
      })
      .finally(() => setLoading(false));
  }, [days]);

  function qualRate(qualified: number, total: number): string {
    if (total === 0) return "0%";
    return `${Math.round((qualified / total) * 100)}%`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatSource(source: string | null): string {
    if (!source) return "\u2014";
    return source
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-main)" }}
          >
            Ad Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Track which campaigns and creatives drive qualified leads.
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-[var(--card-border)] overflow-hidden">
          {dateRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setDays(range.value)}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: days === range.value ? "linear-gradient(135deg, #2563EB, #06B6D4)" : "transparent",
                color: days === range.value ? "#fff" : "var(--text-muted)",
              }}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: summary.totalLeads },
          { label: "Qualified", value: summary.qualified },
          { label: "Booked Calls", value: summary.bookedCalls },
          { label: "Purchases", value: summary.purchases },
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

      {/* Campaign Performance */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-[var(--card-border)]">
          <p className="section-header mb-0">By Campaign (Angle)</p>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState message="No campaign data yet. UTM-tagged ad traffic will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  {["Campaign", "Total", "Qualified", "Booked", "Purchased", "Qual Rate"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((row) => (
                  <tr
                    key={row.campaign}
                    className="border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-main)" }}>
                      {row.campaign || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                      {row.total}
                    </td>
                    <td className="px-4 py-3 text-sm text-emerald-500 font-semibold">
                      {row.qualified}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                      {row.booked}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                      {row.purchased}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                      {qualRate(row.qualified, row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creative Performance */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-[var(--card-border)]">
          <p className="section-header mb-0">By Creative (Ad)</p>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : creatives.length === 0 ? (
          <EmptyState message="No creative data yet. Use utm_content in your ad URLs to track individual ads." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  {["Creative", "Total", "Qualified", "Booked", "Purchased", "Qual Rate"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {creatives.map((row) => (
                  <tr
                    key={row.creative}
                    className="border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-main)" }}>
                      {row.creative || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                      {row.total}
                    </td>
                    <td className="px-4 py-3 text-sm text-emerald-500 font-semibold">
                      {row.qualified}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                      {row.booked}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                      {row.purchased}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                      {qualRate(row.qualified, row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Leads */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-[var(--card-border)]">
          <p className="section-header mb-0">Recent Leads</p>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : recentLeads.length === 0 ? (
          <EmptyState message="No leads from ads yet. Leads will appear here once UTM-tagged traffic converts." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  {["Name", "Email", "Score", "Campaign", "Creative", "Form", "Date"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead) => {
                  const sc = scoreConfig[lead.leadScore || "raw"] || scoreConfig.raw;
                  const name = [lead.firstName, lead.lastName]
                    .filter(Boolean)
                    .join(" ") || "\u2014";
                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-main)" }}>
                        {name}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                        {lead.email || "\u2014"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${sc.color} ${sc.bg}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                        {lead.utmCampaign || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-main)" }}>
                        {lead.utmContent || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                        {formatSource(lead.formSource)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDate(lead.createdAt)}
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
