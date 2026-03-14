"use client";

import Link from "next/link";
import { useGHL } from "@/lib/hooks/use-ghl";
import { useGHLMetrics } from "@/lib/hooks/use-ghl-metrics";
import { useInvoiceAnalytics } from "@/lib/hooks/use-invoice-analytics";
import { usePortalActivity } from "@/lib/hooks/use-portal-activity";
import { RevenueChart } from "@/components/dashboard/charts/revenue-chart";
import {
  FileIcon,
  UsersIcon,
  CalendarIcon,
  KanbanIcon,
} from "@/components/ui/icons";

interface OverviewProps {
  docStats: {
    total: number;
    new: number;
    reviewed: number;
    archived: number;
  };
  isAdmin: boolean;
}

function formatCentsToDollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const activityTypeConfig = {
  payment: { color: "bg-emerald-500", label: "Payment" },
  document: { color: "bg-blue-500", label: "Document" },
  engagement: { color: "bg-violet-500", label: "Engagement" },
  login: { color: "bg-gray-400", label: "Login" },
} as const;

export function OverviewClient({ docStats, isAdmin }: OverviewProps) {
  const { data: ghlData, loading: ghlLoading } = useGHL();
  const { data: ghlMetrics, loading: metricsLoading } = useGHLMetrics("7d");
  const { data: analytics, loading: analyticsLoading } = useInvoiceAnalytics();
  const { data: portalActivity, loading: activityLoading } = usePortalActivity();

  return (
    <div className="space-y-6">
      {/* Core stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/dashboard/documents" className="glass-card p-4 no-underline hover:bg-[var(--input-bg)] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <FileIcon className="w-5 h-5 text-[var(--text-muted)]" />
            {docStats.new > 0 && (
              <span className="badge badge-blue">{docStats.new} new</span>
            )}
          </div>
          <p className="stat-value">{docStats.total}</p>
          <p className="stat-label mt-1">Documents</p>
        </Link>

        <Link href="/dashboard/contacts" className="glass-card p-4 no-underline hover:bg-[var(--input-bg)] transition-colors">
          <div className="mb-2">
            <UsersIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <p className="stat-value">{ghlLoading ? "—" : ghlData?.leadsCount || 0}</p>
          <p className="stat-label mt-1">Contacts</p>
        </Link>

        <Link href="/dashboard/pipeline" className="glass-card p-4 no-underline hover:bg-[var(--input-bg)] transition-colors">
          <div className="mb-2">
            <KanbanIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <p className="stat-value">
            {ghlLoading ? "—" : `$${((ghlData?.pipelineValue || 0) / 1000).toFixed(1)}k`}
          </p>
          <p className="stat-label mt-1">Pipeline Value</p>
        </Link>

        <Link href="/dashboard/contacts" className="glass-card p-4 no-underline hover:bg-[var(--input-bg)] transition-colors">
          <div className="mb-2">
            <CalendarIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <p className="stat-value">
            {metricsLoading ? "—" : `${ghlMetrics?.conversion?.conversionRate || 0}%`}
          </p>
          <p className="stat-label mt-1">Conversion Rate</p>
        </Link>
      </div>

      {/* Revenue Section */}
      <div>
        <p className="section-header">Revenue</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="glass-card p-4">
            <p className="stat-label">Collected</p>
            <p className="stat-value text-emerald-500">
              {analyticsLoading ? "—" : formatCentsToDollars(analytics?.stats.totalCollected ?? 0)}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="stat-label">Outstanding</p>
            <p className="stat-value">
              {analyticsLoading ? "—" : formatCentsToDollars(analytics?.stats.totalOutstanding ?? 0)}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="stat-label">Overdue</p>
            <p className="stat-value text-rose-500">
              {analyticsLoading ? "—" : analytics?.stats.overdueCount ?? 0}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="stat-label">Avg Days to Pay</p>
            <p className="stat-value">
              {analyticsLoading ? "—" : `${analytics?.stats.avgDaysToPay ?? 0}d`}
            </p>
          </div>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-main)" }}>
            Monthly Revenue
          </h3>
          {analyticsLoading ? (
            <div className="h-[240px] flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <RevenueChart data={analytics?.chartData ?? []} />
          )}
        </div>
      </div>

      {/* Activity row */}
      <div>
        <p className="section-header">Activity</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Conversion Funnel */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-main)" }}>
              Conversion Funnel
            </h3>
            {metricsLoading ? (
              <div className="h-32 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ghlMetrics?.conversion ? (
              <div className="space-y-3">
                <FunnelBar label="Total Leads" value={ghlMetrics.conversion.totalLeads} max={ghlMetrics.conversion.totalLeads} color="bg-blue-500" />
                <FunnelBar label="Responded" value={ghlMetrics.conversion.respondedLeads} max={ghlMetrics.conversion.totalLeads} color="bg-cyan-500" />
                <FunnelBar label="Booked" value={ghlMetrics.conversion.bookedConsultations} max={ghlMetrics.conversion.totalLeads} color="bg-emerald-500" />
              </div>
            ) : (
              <div className="empty-state">
                <p className="text-sm">Connect GoHighLevel in Settings to see funnel data.</p>
              </div>
            )}
          </div>

          {/* Speed to Lead */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-main)" }}>
              Speed to Lead
            </h3>
            {metricsLoading ? (
              <div className="h-32 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ghlMetrics?.speedToLead ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-center flex-1">
                    <p className="text-xl font-bold" style={{ color: "var(--text-main)" }}>
                      {ghlMetrics.speedToLead.averageResponseMinutes}
                    </p>
                    <p className="stat-label mt-1">Avg Minutes</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-xl font-bold" style={{ color: "var(--text-main)" }}>
                      {ghlMetrics.speedToLead.medianResponseMinutes}
                    </p>
                    <p className="stat-label mt-1">Median Minutes</p>
                  </div>
                  <div className="text-center flex-1">
                    <div
                      className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                        ghlMetrics.speedToLead.performanceRating === "green"
                          ? "bg-emerald-400"
                          : ghlMetrics.speedToLead.performanceRating === "yellow"
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                    />
                    <p className="stat-label capitalize">{ghlMetrics.speedToLead.performanceRating}</p>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="badge badge-emerald">&lt;5m: {ghlMetrics.speedToLead.distribution.under5min}</span>
                  <span className="badge badge-amber">5-30m: {ghlMetrics.speedToLead.distribution.from5to30min}</span>
                  <span className="badge badge-rose">&gt;30m: {ghlMetrics.speedToLead.distribution.over30min}</span>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p className="text-sm">Connect GoHighLevel in Settings to see response metrics.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <p className="section-header">Quick Access</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Portal Activity */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                Portal Activity
              </h3>
            </div>
            {activityLoading ? (
              <div className="py-8 flex justify-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : portalActivity.length > 0 ? (
              <div className="space-y-0.5">
                {portalActivity.slice(0, 8).map((item, i) => {
                  const config = activityTypeConfig[item.type];
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-[var(--input-bg)] transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: "var(--text-main)" }}>
                          <span className="font-medium">{item.actorName || "Someone"}</span>{" "}
                          {item.description}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {timeAgo(item.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p className="text-sm">No recent activity. Activity will show up as clients interact with your portal.</p>
              </div>
            )}
          </div>

          {/* Recent Leads */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                Recent Leads
              </h3>
              <Link href="/dashboard/contacts" className="text-xs font-semibold text-blue-500 hover:underline">
                View All
              </Link>
            </div>
            {ghlLoading ? (
              <div className="py-8 flex justify-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ghlData?.recentLeads && ghlData.recentLeads.length > 0 ? (
              <div className="space-y-0.5">
                {ghlData.recentLeads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--input-bg)] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                        {lead.firstName} {lead.lastName}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {lead.email || lead.phone || "No contact info"}
                      </p>
                    </div>
                    <span className="badge badge-gray">{lead.source || "Direct"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <UsersIcon className="empty-state-icon" />
                <p className="text-sm">Connect GoHighLevel in Settings to see leads.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm" style={{ color: "var(--text-main)" }}>{label}</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{value}</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
