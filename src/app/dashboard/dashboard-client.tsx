"use client";

import Link from "next/link";
import { useGHL } from "@/lib/hooks/use-ghl";
import { useGHLMetrics } from "@/lib/hooks/use-ghl-metrics";
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

export function OverviewClient({ docStats, isAdmin }: OverviewProps) {
  const { data: ghlData, loading: ghlLoading } = useGHL();
  const { data: ghlMetrics, loading: metricsLoading } = useGHLMetrics("7d");

  return (
    <div className="space-y-8">
      {/* Top stat cards — 4 pillars */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Documents pending */}
        <Link href="/dashboard/documents" className="glass-card-elevated rounded-2xl p-5 hover:border-blue-500/20 transition-all no-underline group" style={{ borderLeft: "3px solid #2563EB" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileIcon className="w-4 h-4 text-blue-400" />
            </div>
            {docStats.new > 0 && (
              <span className="badge badge-blue">
                {docStats.new} new
              </span>
            )}
          </div>
          <p className="stat-value">
            {docStats.total}
          </p>
          <p className="stat-label mt-1">
            Documents
          </p>
        </Link>

        {/* Leads */}
        <Link href="/dashboard/contacts" className="glass-card-elevated rounded-2xl p-5 hover:border-cyan-500/20 transition-all no-underline group" style={{ borderLeft: "3px solid #06B6D4" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UsersIcon className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <p className="stat-value">
            {ghlLoading ? "—" : ghlData?.leadsCount || 0}
          </p>
          <p className="stat-label mt-1">
            Contacts
          </p>
        </Link>

        {/* Pipeline value */}
        <Link href="/dashboard/pipeline" className="glass-card-elevated rounded-2xl p-5 hover:border-emerald-500/20 transition-all no-underline group" style={{ borderLeft: "3px solid #10B981" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <KanbanIcon className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="stat-value">
            {ghlLoading
              ? "—"
              : `$${((ghlData?.pipelineValue || 0) / 1000).toFixed(1)}k`}
          </p>
          <p className="stat-label mt-1">
            Pipeline Value
          </p>
        </Link>

        {/* Conversion rate */}
        <Link href="/dashboard/contacts" className="glass-card-elevated rounded-2xl p-5 hover:border-violet-500/20 transition-all no-underline group" style={{ borderLeft: "3px solid #8B5CF6" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CalendarIcon className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <p className="stat-value">
            {metricsLoading ? "—" : `${ghlMetrics?.conversion?.conversionRate || 0}%`}
          </p>
          <p className="stat-label mt-1">
            Conversion Rate
          </p>
        </Link>
      </div>

      {/* Middle row: Conversion Funnel + Speed to Lead */}
      <div>
        <p className="section-header">Activity</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Conversion Funnel */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="section-header mb-4">
              Conversion Funnel
            </h3>
            {metricsLoading ? (
              <div className="h-32 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ghlMetrics?.conversion ? (
              <div className="space-y-4">
                <FunnelBar
                  label="Total Leads"
                  value={ghlMetrics.conversion.totalLeads}
                  max={ghlMetrics.conversion.totalLeads}
                  color="from-blue-600 to-blue-500"
                />
                <FunnelBar
                  label="Responded"
                  value={ghlMetrics.conversion.respondedLeads}
                  max={ghlMetrics.conversion.totalLeads}
                  color="from-cyan-600 to-cyan-500"
                />
                <FunnelBar
                  label="Booked"
                  value={ghlMetrics.conversion.bookedConsultations}
                  max={ghlMetrics.conversion.totalLeads}
                  color="from-emerald-600 to-emerald-500"
                />
              </div>
            ) : (
              <div className="empty-state">
                <p className="text-sm">
                  Connect GoHighLevel in Settings to see funnel data.
                </p>
              </div>
            )}
          </div>

          {/* Speed to Lead */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="section-header mb-4">
              Speed to Lead
            </h3>
            {metricsLoading ? (
              <div className="h-32 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ghlMetrics?.speedToLead ? (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="text-center flex-1">
                    <p className="stat-value text-2xl">
                      {ghlMetrics.speedToLead.averageResponseMinutes}
                    </p>
                    <p className="stat-label mt-1">
                      Avg Minutes
                    </p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="stat-value text-2xl">
                      {ghlMetrics.speedToLead.medianResponseMinutes}
                    </p>
                    <p className="stat-label mt-1">
                      Median Minutes
                    </p>
                  </div>
                  <div className="text-center flex-1">
                    <div
                      className={`w-4 h-4 rounded-full mx-auto mb-1 ${
                        ghlMetrics.speedToLead.performanceRating === "green"
                          ? "bg-emerald-400"
                          : ghlMetrics.speedToLead.performanceRating === "yellow"
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                    />
                    <p className="stat-label capitalize">
                      {ghlMetrics.speedToLead.performanceRating}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="badge badge-emerald">
                    &lt;5m: {ghlMetrics.speedToLead.distribution.under5min}
                  </span>
                  <span className="badge badge-amber">
                    5-30m: {ghlMetrics.speedToLead.distribution.from5to30min}
                  </span>
                  <span className="badge badge-rose">
                    &gt;30m: {ghlMetrics.speedToLead.distribution.over30min}
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p className="text-sm">
                  Connect GoHighLevel in Settings to see response metrics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Recent Documents + Recent Leads */}
      <div>
        <p className="section-header">Quick Access</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent Documents */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                Recent Documents
              </h3>
              <Link
                href="/dashboard/documents"
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                View All
              </Link>
            </div>
            {docStats.total === 0 ? (
              <div className="empty-state">
                <FileIcon className="empty-state-icon" />
                <p className="text-sm mb-3">
                  No documents yet. Create a secure link to get started.
                </p>
                <Link
                  href="/dashboard/documents/links"
                  className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-colors"
                >
                  Create Secure Link
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: "var(--input-bg)" }}>
                  <span className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                    {docStats.new} pending review
                  </span>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {docStats.reviewed} reviewed
                  </span>
                </div>
                <Link
                  href="/dashboard/documents"
                  className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-blue-400 hover:bg-blue-500/5 transition-colors"
                >
                  Open Document Manager
                </Link>
              </div>
            )}
          </div>

          {/* Recent Leads */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                Recent Leads
              </h3>
              <Link
                href="/dashboard/contacts"
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                View All
              </Link>
            </div>
            {ghlLoading ? (
              <div className="py-8 flex justify-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ghlData?.recentLeads && ghlData.recentLeads.length > 0 ? (
              <div className="space-y-1">
                {ghlData.recentLeads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-[var(--input-bg)] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                        {lead.firstName} {lead.lastName}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {lead.email || lead.phone || "No contact info"}
                      </p>
                    </div>
                    <span className="badge badge-gray">
                      {lead.source || "Direct"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <UsersIcon className="empty-state-icon" />
                <p className="text-sm">
                  Connect GoHighLevel in Settings to see leads.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
          {label}
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
          {value}
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "var(--glass-border)" }}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
