"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAnalytics } from "@/lib/hooks/use-analytics";
import { useClientActivity } from "@/lib/hooks/use-client-activity";
import { useGHLMetrics } from "@/lib/hooks/use-ghl-metrics";
import { ProfileSidebar } from "@/components/dashboard/ProfileSidebar";
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
import { AIInsightsCard } from "@/components/dashboard/ai-insights-card";
import { BrandFilesSection } from "@/components/dashboard/admin/brand-files-section";
import { compactNumber, formatDateFull, formatDuration, formatConversionRate } from "@/lib/format";

interface ClientDetailPanelProps {
  client: {
    id: string;
    name: string | null;
    email: string;
    companyName: string | null;
    websiteUrl: string | null;
    ghlLocationId?: string | null;
    createdAt: string;
    active: boolean;
    pageViews30d: number;
    uniqueVisitors30d: number;
  };
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function Users2Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 19a6 6 0 0 0-12 0" />
      <circle cx="8" cy="9" r="4" />
      <path d="M22 19a6 6 0 0 0-6-6 4 4 0 1 0 0-8" />
    </svg>
  );
}

export function ClientDetailPanel({ client }: ClientDetailPanelProps) {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "7d";
  const [slide, setSlide] = useState(0);
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
            ghlLocationId={client.ghlLocationId}
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

          {/* Stats Carousel */}
          <GlassCard className="!p-8 relative overflow-hidden">
            {/* Header with icon, title, and nav */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  {slide === 0 ? <TrendingUpIcon className="w-5 h-5" /> : <Users2Icon className="w-5 h-5" />}
                </div>
                <h3 className="text-xl font-bold text-[var(--text-main)]">
                  {slide === 0 ? "Lead Performance" : "Your Audience"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Dots */}
                <div className="flex items-center gap-1.5 mr-2">
                  {[0, 1].map((i) => (
                    <button
                      key={i}
                      onClick={() => setSlide(i)}
                      className="w-2 h-2 rounded-full transition-all duration-300"
                      style={{
                        background: slide === i ? "var(--text-main)" : "var(--glass-border)",
                        opacity: slide === i ? 1 : 0.5,
                      }}
                    />
                  ))}
                </div>
                {/* Arrows */}
                <button
                  onClick={() => setSlide(0)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: slide === 0 ? "var(--glass-border)" : "rgba(255,255,255,0.05)",
                    color: "var(--text-muted)",
                    opacity: slide === 0 ? 0.3 : 1,
                  }}
                  disabled={slide === 0}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSlide(1)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: slide === 1 ? "var(--glass-border)" : "rgba(255,255,255,0.05)",
                    color: "var(--text-muted)",
                    opacity: slide === 1 ? 0.3 : 1,
                  }}
                  disabled={slide === 1}
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Slide track */}
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${slide * 100}%)` }}
              >
                {/* Slide 1: Lead Performance */}
                <div className="w-full flex-shrink-0">
                  {metricsLoading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="text-center">
                          <div className="h-16 rounded-xl animate-pulse mx-auto w-24" style={{ background: "var(--glass-border)" }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="text-center group">
                          <p className="text-5xl md:text-6xl font-bold text-[var(--text-main)] mb-3 group-hover:scale-110 transition-transform duration-300">
                            {formatConversionRate(metrics?.conversion.conversionRate ?? 0)}
                          </p>
                          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                            Conversion Rate
                          </p>
                        </div>
                        <div className="text-center group">
                          <p className="text-5xl md:text-6xl font-bold text-[var(--text-main)] mb-3 group-hover:scale-110 transition-transform duration-300">
                            {compactNumber(metrics?.conversion.totalLeads ?? 0)}
                          </p>
                          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                            Total Leads
                          </p>
                        </div>
                        <div className="text-center group">
                          <p className="text-5xl md:text-6xl font-bold text-[var(--text-main)] mb-3 group-hover:scale-110 transition-transform duration-300">
                            {compactNumber(metrics?.conversion.bookedConsultations ?? 0)}
                          </p>
                          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                            Consultations
                          </p>
                        </div>
                        <div className="text-center group">
                          <p className="text-5xl md:text-6xl font-bold text-[var(--text-main)] mb-3 group-hover:scale-110 transition-transform duration-300">
                            {formatDuration(metrics?.speedToLead.averageResponseMinutes ?? 0)}
                          </p>
                          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                            Speed to Lead
                          </p>
                        </div>
                      </div>

                      {/* Mini detail row */}
                      <div className="mt-6 pt-6 border-t border-[var(--glass-border)] grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                              Conversion Funnel
                            </p>
                          </div>
                          <ConversionFunnel data={metrics?.conversion ?? {
                            totalLeads: 0, respondedLeads: 0, bookedConsultations: 0,
                            conversionRate: 0, previousConversionRate: null, benchmarkLow: 30, benchmarkHigh: 50,
                          }} />
                          <div className="mt-3">
                            <BenchmarkGauge
                              value={metrics?.conversion.conversionRate ?? 0}
                              benchmarkLow={30}
                              benchmarkHigh={50}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                              Response Time
                            </p>
                            <PerformanceIndicator
                              rating={metrics?.speedToLead.performanceRating ?? "green"}
                            />
                          </div>
                          <ResponseTimeChart data={metrics?.speedToLead ?? {
                            averageResponseMinutes: 0, medianResponseMinutes: 0,
                            distribution: { under5min: 0, from5to30min: 0, over30min: 0 },
                            performanceRating: "green" as const, aiResponses: 0, humanResponses: 0, totalMeasured: 0,
                          }} />
                          {(metrics?.speedToLead.totalMeasured ?? 0) > 0 && (
                            <div className="mt-3">
                              <AiHumanSplit
                                aiCount={metrics?.speedToLead.aiResponses ?? 0}
                                humanCount={metrics?.speedToLead.humanResponses ?? 0}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Slide 2: Your Audience */}
                <div className="w-full flex-shrink-0">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {audienceStats.map((stat, index) => (
                      <div key={index} className="text-center group">
                        <p className="text-5xl md:text-6xl font-bold text-[var(--text-main)] mb-3 group-hover:scale-110 transition-transform duration-300">
                          {stat.value}
                        </p>
                        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* AI Insights */}
          <AIInsightsCard range={range} clientId={client.id} />

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

          {/* Brand Files */}
          <BrandFilesSection clientId={client.id} />
        </main>
      </div>
    </div>
  );
}
