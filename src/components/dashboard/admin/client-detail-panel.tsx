"use client";

import { useSearchParams } from "next/navigation";
import { useAnalytics } from "@/lib/hooks/use-analytics";
import { useClientActivity } from "@/lib/hooks/use-client-activity";
import { ProfileSidebar } from "@/components/dashboard/ProfileSidebar";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { RecentActivityFeed } from "@/components/dashboard/admin/recent-activity-feed";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { TrafficChart } from "@/components/dashboard/charts/traffic-chart";
import { TopPagesChart } from "@/components/dashboard/charts/top-pages-chart";
import { DeviceChart } from "@/components/dashboard/charts/device-chart";
import { GlassCard } from "@/components/ui/glass-card";
import { compactNumber, formatDateFull } from "@/lib/format";

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
