"use client";

import { useSearchParams } from "next/navigation";
import { useAnalytics } from "@/lib/hooks/use-analytics";
import { StatCard } from "@/components/ui/stat-card";
import { GlassCard } from "@/components/ui/glass-card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { TrafficChart } from "@/components/dashboard/charts/traffic-chart";
import { TopPagesChart } from "@/components/dashboard/charts/top-pages-chart";
import { DeviceChart } from "@/components/dashboard/charts/device-chart";
import { compactNumber } from "@/lib/format";

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "7d";
  const { data, loading } = useAnalytics(range);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ color: "var(--text-main)" }}
          >
            Website Analytics
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Track your website traffic and visitor behavior.
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Page Views"
          value={loading ? "..." : compactNumber(data?.pageViews ?? 0)}
          delta={loading ? "--" : data?.pageViewsDelta.value ?? "0%"}
          deltaType={loading ? "neutral" : data?.pageViewsDelta.type ?? "neutral"}
          accent="blue"
        />
        <StatCard
          label="Unique Visitors"
          value={loading ? "..." : compactNumber(data?.uniqueVisitors ?? 0)}
          delta={loading ? "--" : data?.uniqueVisitorsDelta.value ?? "0%"}
          deltaType={loading ? "neutral" : data?.uniqueVisitorsDelta.type ?? "neutral"}
          accent="cyan"
        />
        <StatCard
          label="Avg. Views/Day"
          value={
            loading
              ? "..."
              : compactNumber(
                  data?.dailyData.length
                    ? Math.round(
                        data.pageViews / data.dailyData.length
                      )
                    : 0
                )
          }
          deltaType="neutral"
          accent="teal"
        />
        <StatCard
          label="Bounce Rate"
          value="--"
          delta="coming soon"
          deltaType="neutral"
          accent="purple"
        />
      </div>

      {/* Traffic Chart */}
      <GlassCard>
        <h3
          className="text-sm font-bold mb-4"
          style={{ color: "var(--text-main)" }}
        >
          Traffic Over Time
        </h3>
        {loading ? (
          <div
            className="h-[240px] rounded-xl animate-pulse"
            style={{ background: "var(--glass-border)" }}
          />
        ) : (
          <TrafficChart data={data?.dailyData ?? []} />
        )}
      </GlassCard>

      {/* Bottom row: Top Pages + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--text-main)" }}
          >
            Top Pages
          </h3>
          {loading ? (
            <div
              className="h-[200px] rounded-xl animate-pulse"
              style={{ background: "var(--glass-border)" }}
            />
          ) : (
            <TopPagesChart data={data?.topPages ?? []} />
          )}
        </GlassCard>

        <GlassCard>
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--text-main)" }}
          >
            Device Breakdown
          </h3>
          {loading ? (
            <div
              className="h-[120px] rounded-xl animate-pulse"
              style={{ background: "var(--glass-border)" }}
            />
          ) : (
            <DeviceChart data={data?.deviceBreakdown ?? []} />
          )}
        </GlassCard>
      </div>

      {/* Top Referrers Table */}
      <GlassCard>
        <h3
          className="text-sm font-bold mb-4"
          style={{ color: "var(--text-main)" }}
        >
          Top Referrers
        </h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 rounded-xl animate-pulse"
                style={{ background: "var(--glass-border)" }}
              />
            ))}
          </div>
        ) : !data?.topReferrers?.length ? (
          <div
            className="text-sm py-8 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            No referrer data yet
          </div>
        ) : (
          <div className="space-y-2">
            {data.topReferrers.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl border border-[var(--glass-border)]"
              >
                <span
                  className="text-sm truncate max-w-[70%]"
                  style={{ color: "var(--text-main)" }}
                >
                  {r.referrer || "Direct / None"}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: "var(--text-muted)" }}
                >
                  {compactNumber(r.count)} views
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
