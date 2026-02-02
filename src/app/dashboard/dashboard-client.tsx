"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useGHL } from "@/lib/hooks/use-ghl";
import { useAnalytics } from "@/lib/hooks/use-analytics";
import { useGHLMetrics } from "@/lib/hooks/use-ghl-metrics";
import { compactNumber, formatCurrency, formatDuration, formatConversionRate } from "@/lib/format";
import { StatCard } from "@/components/ui/stat-card";
import { GlassCard } from "@/components/ui/glass-card";
import { CategoryTabs } from "@/components/dashboard/category-tabs";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { TrafficChart } from "@/components/dashboard/charts/traffic-chart";
import { TopPagesChart } from "@/components/dashboard/charts/top-pages-chart";
import { DeviceChart } from "@/components/dashboard/charts/device-chart";
import { ConversionFunnel } from "@/components/dashboard/charts/conversion-funnel";
import { BenchmarkGauge } from "@/components/dashboard/charts/benchmark-gauge";
import { ResponseTimeChart } from "@/components/dashboard/charts/response-time-chart";
import { PerformanceIndicator } from "@/components/dashboard/charts/performance-indicator";
import { AiHumanSplit } from "@/components/dashboard/charts/ai-human-split";
import { RecentLeads } from "@/components/dashboard/recent-leads";
import { AIInsightsCard } from "@/components/dashboard/ai-insights-card";
import { LogoFilesWidget } from "@/components/dashboard/logo-files-widget";
import { ChartIcon, UsersIcon } from "@/components/ui/icons";

interface DashboardClientProps {
  pageViews: number;
  uniqueVisitors: number;
  pvDelta: { value: string; type: "positive" | "negative" | "neutral" };
  uvDelta: { value: string; type: "positive" | "negative" | "neutral" };
  chartData: { date: string; pageViews: number; uniqueVisitors: number }[];
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

const emptyConversion = {
  totalLeads: 0,
  respondedLeads: 0,
  bookedConsultations: 0,
  conversionRate: 0,
  previousConversionRate: null,
  benchmarkLow: 30,
  benchmarkHigh: 50,
};

const emptySpeed = {
  averageResponseMinutes: 0,
  medianResponseMinutes: 0,
  distribution: { under5min: 0, from5to30min: 0, over30min: 0 },
  performanceRating: "green" as const,
  aiResponses: 0,
  humanResponses: 0,
  totalMeasured: 0,
};

export function DashboardClient({
  pageViews,
  uniqueVisitors,
  pvDelta,
  uvDelta,
  chartData,
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState("analytics");
  const { data: ghl, loading: ghlLoading } = useGHL();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "7d";
  const { data: analytics, loading: analyticsLoading } = useAnalytics(range);
  const { data: metrics, loading: metricsLoading } = useGHLMetrics(range);

  const rangeLabel = range === "30d" ? "30 days" : range === "90d" ? "90 days" : "7 days";

  return (
    <div className="space-y-6">
      {/* AI Insights */}
      <AIInsightsCard range={range} />

      {/* Hero: Two core metric cards */}
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

              <ConversionFunnel data={metrics?.conversion ?? emptyConversion} />

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

              <ResponseTimeChart data={metrics?.speedToLead ?? emptySpeed} />

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

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Page Views"
          value={compactNumber(pageViews)}
          delta={pvDelta.value}
          deltaType={pvDelta.type}
          accent="blue"
          icon={<EyeIcon className="w-4 h-4" />}
        />
        <StatCard
          label="Unique Visitors"
          value={compactNumber(uniqueVisitors)}
          delta={uvDelta.value}
          deltaType={uvDelta.type}
          accent="cyan"
          icon={<UsersIcon className="w-4 h-4" />}
        />
        <StatCard
          label="New Leads"
          value={ghlLoading ? "..." : compactNumber(ghl?.leadsCount ?? 0)}
          delta={ghlLoading ? "--" : ghl?.leadsCount ? "from GHL" : "0"}
          deltaType="neutral"
          accent="teal"
          icon={<ChartIcon className="w-4 h-4" />}
        />
        <StatCard
          label="Pipeline Value"
          value={ghlLoading ? "..." : formatCurrency(ghl?.pipelineValue ?? 0)}
          delta={ghlLoading ? "--" : ghl?.pipelineValue ? "total open" : "$0"}
          deltaType="neutral"
          accent="purple"
          icon={<DollarIcon className="w-4 h-4" />}
        />
      </div>

      {/* Logo Files */}
      <LogoFilesWidget />

      {/* Tabs + date range picker */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <CategoryTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <DateRangePicker />
      </div>

      {/* Tab content */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                Website Traffic
              </h3>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Last {range}
              </span>
            </div>
            {analyticsLoading ? (
              <div className="h-[240px] rounded-xl animate-pulse" style={{ background: "var(--glass-border)" }} />
            ) : (
              <TrafficChart data={analytics?.dailyData ?? chartData} />
            )}
          </GlassCard>

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
        </div>
      )}

      {activeTab === "leads" && (
        <GlassCard>
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-main)" }}>
            Recent Leads
          </h3>
          <RecentLeads />
        </GlassCard>
      )}

      {activeTab === "pipeline" && (
        <GlassCard>
          <div className="py-12 text-center">
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Pipeline visualization coming soon.
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
              Connect GoHighLevel in Settings to view pipeline data.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
