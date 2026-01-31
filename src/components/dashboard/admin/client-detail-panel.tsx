"use client";

import { useSearchParams } from "next/navigation";
import { useAnalytics } from "@/lib/hooks/use-analytics";
import { useClientActivity } from "@/lib/hooks/use-client-activity";
import { useGHLMetrics } from "@/lib/hooks/use-ghl-metrics";
import { ProfileSidebar } from "@/components/dashboard/ProfileSidebar";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { RecentActivityFeed } from "@/components/dashboard/admin/recent-activity-feed";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { TrafficChart } from "@/components/dashboard/charts/traffic-chart";
import { TopPagesChart } from "@/components/dashboard/charts/top-pages-chart";
import { DeviceChart } from "@/components/dashboard/charts/device-chart";
import { ConversionFunnel } from "@/components/dashboard/charts/conversion-funnel";
import { BenchmarkGauge } from "@/components/dashboard/charts/benchmark-gauge";
import { ResponseTimeChart } from "@/components/dashboard/charts/response-time-chart";
import { PerformanceIndicator } from "@/components/dashboard/charts/performance-indicator";
import { AiHumanSplit } from "@/components/dashboard/charts/ai-human-split";
import { GlassCard } from "@/components/ui/glass-card";
import { compactNumber, formatDateFull, formatDuration, formatConversionRate } from "@/lib/format";

interface ClientDetailPanelProps {
  client: {
    id: string;
    name: string | null;
    email: string;
    companyName: string | null;
    websiteUrl: string | null;
    createdAt: string;
    active: boolean;
    pageViews30d: number;
    uniqueVisitors30d: number;
  };
}

export function ClientDetailPanel({ client }: ClientDetailPanelProps) {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "7d";
  const { data: analytics, loading: analyticsLoading } = useAnalytics(range, client.id);
  const { data: activity, loading: activityLoading } = useClientActivity(client.id);
  const { data: metrics, loading: metricsLoading } = useGHLMetrics(range, client.id);

  const rangeLabel = range === "30d" ? "30 days" : range === "90d" ? "90 days" : "7 days";

  const business = {
    name: client.companyName || client.name || "Unnamed Client",
    type: client.websiteUrl ? "Digital Marketing Client" : "Nexli Client",
    location: client.email,
    joinedDate: formatDateFull(client.createdAt),
  };

  const audienceStats = [
    {
      label: "Page Views",
      value: analyticsLoading ? "..." : compactNumber(analytics?.pageViews ?? client.pageViews30d),
    },
    {
      label: "Unique Visitors",
      value: analyticsLoading ? "..." : compactNumber(analytics?.uniqueVisitors ?? client.uniqueVisitors30d),
    },
    {
      label: "Top Pages",
      value: analyticsLoading ? "..." : (analytics?.topPages?.length ?? 0),
    },
    {
      label: "Devices",
      value: analyticsLoading ? "..." : (analytics?.deviceBreakdown?.length ?? 0),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Gradient banner */}
      <div className="h-32 rounded-2xl bg-gradient-to-r from-blue-600/20 via-cyan-500/10 to-transparent relative overflow-hidden">
        <div className="absolute inset-0 backdrop-blur-[2px]" />
      </div>

      {/* Profile + Stats */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <aside className="xl:col-span-3 -mt-20 relative z-10">
          <ProfileSidebar
            business={business}
            websiteUrl={client.websiteUrl}
            isActive={client.active}
            clientId={client.id}
          />
        </aside>

        <main className="xl:col-span-9 space-y-6">
          {/* Date range control */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${
                  client.active
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                }`}
              >
                {client.active ? "Active" : "Inactive"}
              </span>
            </div>
            <DateRangePicker />
          </div>

          {/* Behance-style big stats */}
          <StatsOverview stats={audienceStats} />

          {/* GHL Metric hero cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Conversion Rate Card */}
            <GlassCard variant="compact">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
                  Lead-to-Consultation Rate
                </h3>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                  Last {rangeLabel}
                </span>
              </div>

              {metricsLoading ? (
                <div className="h-[200px] rounded-xl animate-pulse" style={{ background: "var(--glass-border)" }} />
              ) : (
                <>
                  <p
                    className="text-3xl md:text-4xl font-bold tracking-tight mb-0.5"
                    style={{ color: "var(--text-main)" }}
                  >
                    {formatConversionRate(metrics?.conversion.conversionRate ?? 0)}
                  </p>
                  <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>
                    {metrics?.conversion.bookedConsultations ?? 0} consultations from {metrics?.conversion.totalLeads ?? 0} leads
                  </p>

                  <ConversionFunnel data={metrics?.conversion ?? {
                    totalLeads: 0, respondedLeads: 0, bookedConsultations: 0,
                    conversionRate: 0, previousConversionRate: null, benchmarkLow: 30, benchmarkHigh: 50,
                  }} />

                  <div className="pt-3 mt-3 border-t border-[var(--glass-border)]">
                    <p
                      className="text-[9px] font-black uppercase tracking-[0.2em] mb-1.5"
                      style={{ color: "var(--text-muted)", opacity: 0.5 }}
                    >
                      Industry Benchmark
                    </p>
                    <BenchmarkGauge
                      value={metrics?.conversion.conversionRate ?? 0}
                      benchmarkLow={30}
                      benchmarkHigh={50}
                    />
                  </div>
                </>
              )}
            </GlassCard>

            {/* Speed to Lead Card */}
            <GlassCard variant="compact">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
                  Speed to Lead
                </h3>
                {!metricsLoading && (
                  <PerformanceIndicator
                    rating={metrics?.speedToLead.performanceRating ?? "green"}
                  />
                )}
              </div>

              {metricsLoading ? (
                <div className="h-[200px] rounded-xl animate-pulse" style={{ background: "var(--glass-border)" }} />
              ) : (
                <>
                  <p
                    className="text-3xl md:text-4xl font-bold tracking-tight mb-0.5"
                    style={{ color: "var(--text-main)" }}
                  >
                    {formatDuration(metrics?.speedToLead.averageResponseMinutes ?? 0)}
                  </p>
                  <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>
                    avg. first response
                    {(metrics?.speedToLead.totalMeasured ?? 0) > 0 && (
                      <> (median: {formatDuration(metrics?.speedToLead.medianResponseMinutes ?? 0)})</>
                    )}
                  </p>

                  <ResponseTimeChart data={metrics?.speedToLead ?? {
                    averageResponseMinutes: 0, medianResponseMinutes: 0,
                    distribution: { under5min: 0, from5to30min: 0, over30min: 0 },
                    performanceRating: "green" as const, aiResponses: 0, humanResponses: 0, totalMeasured: 0,
                  }} />

                  {(metrics?.speedToLead.totalMeasured ?? 0) > 0 && (
                    <div className="pt-3 mt-3 border-t border-[var(--glass-border)]">
                      <p
                        className="text-[9px] font-black uppercase tracking-[0.2em] mb-1.5"
                        style={{ color: "var(--text-muted)", opacity: 0.5 }}
                      >
                        Response Breakdown
                      </p>
                      <AiHumanSplit
                        aiCount={metrics?.speedToLead.aiResponses ?? 0}
                        humanCount={metrics?.speedToLead.humanResponses ?? 0}
                      />
                    </div>
                  )}
                </>
              )}
            </GlassCard>
          </div>

          {/* Recent Activity */}
          <RecentActivityFeed
            recentPages={activity?.recentPages ?? []}
            recentLeads={activity?.recentLeads ?? []}
            loading={activityLoading}
          />

          {/* Traffic chart */}
          <GlassCard>
            <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-main)" }}>
              Traffic Trends
            </h3>
            {analyticsLoading ? (
              <div className="h-[240px] rounded-xl animate-pulse" style={{ background: "var(--glass-border)" }} />
            ) : (
              <TrafficChart data={analytics?.dailyData ?? []} />
            )}
          </GlassCard>

          {/* Top Pages + Device breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard>
              <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-main)" }}>
                Top Pages
              </h3>
              {analyticsLoading ? (
                <div className="h-[200px] rounded-xl animate-pulse" style={{ background: "var(--glass-border)" }} />
              ) : (
                <TopPagesChart data={analytics?.topPages ?? []} />
              )}
            </GlassCard>
            <GlassCard>
              <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-main)" }}>
                Device Breakdown
              </h3>
              {analyticsLoading ? (
                <div className="h-[120px] rounded-xl animate-pulse" style={{ background: "var(--glass-border)" }} />
              ) : (
                <DeviceChart data={analytics?.deviceBreakdown ?? []} />
              )}
            </GlassCard>
          </div>
        </main>
      </div>
    </div>
  );
}
