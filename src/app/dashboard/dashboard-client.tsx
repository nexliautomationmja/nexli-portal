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
    <div className="space-y-6">
      {/* Top stat cards — 4 pillars */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Documents pending */}
        <Link href="/dashboard/documents" className="glass-card rounded-2xl p-4 hover:border-blue-500/30 transition-colors no-underline">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileIcon className="w-4 h-4 text-blue-400" />
            </div>
            {docStats.new > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">
                {docStats.new} new
              </span>
            )}
          </div>
          <p className="text-2xl font-black" style={{ color: "var(--text-main)" }}>
            {docStats.total}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>
            Documents
          </p>
        </Link>

        {/* Leads */}
        <Link href="/dashboard/contacts" className="glass-card rounded-2xl p-4 hover:border-blue-500/30 transition-colors no-underline">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <UsersIcon className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <p className="text-2xl font-black" style={{ color: "var(--text-main)" }}>
            {ghlLoading ? "—" : ghlData?.leadsCount || 0}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>
            Contacts
          </p>
        </Link>

        {/* Pipeline value */}
        <Link href="/dashboard/pipeline" className="glass-card rounded-2xl p-4 hover:border-blue-500/30 transition-colors no-underline">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <KanbanIcon className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-black" style={{ color: "var(--text-main)" }}>
            {ghlLoading
              ? "—"
              : `$${((ghlData?.pipelineValue || 0) / 1000).toFixed(1)}k`}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>
            Pipeline Value
          </p>
        </Link>

        {/* Conversion rate */}
        <Link href="/dashboard/contacts" className="glass-card rounded-2xl p-4 hover:border-blue-500/30 transition-colors no-underline">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-black" style={{ color: "var(--text-main)" }}>
            {metricsLoading ? "—" : `${ghlMetrics?.conversion?.conversionRate || 0}%`}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>
            Conversion Rate
          </p>
        </Link>
      </div>

      {/* Middle row: Conversion Funnel + Speed to Lead */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
            Conversion Funnel
          </h3>
          {metricsLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ghlMetrics?.conversion ? (
            <div className="space-y-3">
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
                color="from-green-600 to-green-500"
              />
            </div>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
              Connect GoHighLevel in Settings to see funnel data.
            </p>
          )}
        </div>

        {/* Speed to Lead */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
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
                  <p className="text-3xl font-black" style={{ color: "var(--text-main)" }}>
                    {ghlMetrics.speedToLead.averageResponseMinutes}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Avg Minutes
                  </p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-3xl font-black" style={{ color: "var(--text-main)" }}>
                    {ghlMetrics.speedToLead.medianResponseMinutes}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Median Minutes
                  </p>
                </div>
                <div className="text-center flex-1">
                  <div
                    className={`w-4 h-4 rounded-full mx-auto mb-1 ${
                      ghlMetrics.speedToLead.performanceRating === "green"
                        ? "bg-green-400"
                        : ghlMetrics.speedToLead.performanceRating === "yellow"
                        ? "bg-yellow-400"
                        : "bg-red-400"
                    }`}
                  />
                  <p className="text-[10px] uppercase tracking-widest capitalize" style={{ color: "var(--text-muted)" }}>
                    {ghlMetrics.speedToLead.performanceRating}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg bg-green-500/10 text-green-400">
                  &lt;5m: {ghlMetrics.speedToLead.distribution.under5min}
                </span>
                <span className="px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400">
                  5-30m: {ghlMetrics.speedToLead.distribution.from5to30min}
                </span>
                <span className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400">
                  &gt;30m: {ghlMetrics.speedToLead.distribution.over30min}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
              Connect GoHighLevel in Settings to see response metrics.
            </p>
          )}
        </div>
      </div>

      {/* Bottom row: Recent Documents + Recent Leads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Documents */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Recent Documents
            </h3>
            <Link
              href="/dashboard/documents"
              className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:underline"
            >
              View All
            </Link>
          </div>
          {docStats.total === 0 ? (
            <div className="py-6 text-center">
              <FileIcon className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No documents yet. Create a secure link to get started.
              </p>
              <Link
                href="/dashboard/documents/links"
                className="inline-block mt-3 px-4 py-1.5 rounded-lg text-xs font-bold text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-colors"
              >
                Create Secure Link
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between py-2 px-2 rounded-lg">
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  {docStats.new} pending review
                </span>
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  {docStats.reviewed} reviewed
                </span>
              </div>
              <Link
                href="/dashboard/documents"
                className="block w-full text-center py-2 rounded-lg text-xs font-bold text-blue-400 hover:bg-blue-500/5 transition-colors"
              >
                Open Document Manager
              </Link>
            </div>
          )}
        </div>

        {/* Recent Leads */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Recent Leads
            </h3>
            <Link
              href="/dashboard/contacts"
              className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:underline"
            >
              View All
            </Link>
          </div>
          {ghlLoading ? (
            <div className="py-6 flex justify-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ghlData?.recentLeads && ghlData.recentLeads.length > 0 ? (
            <div className="space-y-2">
              {ghlData.recentLeads.slice(0, 5).map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-blue-500/5 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                      {lead.firstName} {lead.lastName}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {lead.email || lead.phone || "No contact info"}
                    </p>
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {lead.source || "Direct"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <UsersIcon className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Connect GoHighLevel in Settings to see leads.
              </p>
            </div>
          )}
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
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--text-main)" }}>
          {label}
        </span>
        <span className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
          {value}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
