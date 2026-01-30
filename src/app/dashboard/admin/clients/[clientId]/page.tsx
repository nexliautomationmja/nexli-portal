"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAnalytics } from "@/lib/hooks/use-analytics";
import { StatCard } from "@/components/ui/stat-card";
import { GlassCard } from "@/components/ui/glass-card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { TrafficChart } from "@/components/dashboard/charts/traffic-chart";
import { TopPagesChart } from "@/components/dashboard/charts/top-pages-chart";
import { DeviceChart } from "@/components/dashboard/charts/device-chart";
import { compactNumber } from "@/lib/format";

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "7d";
  const { data, loading } = useAnalytics(range, clientId);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm mb-2" style={{ color: "var(--text-muted)" }}>
            <Link href="/dashboard/admin" className="hover:text-blue-400 transition-colors">
              All Clients
            </Link>
            <span>/</span>
            <span style={{ color: "var(--text-main)" }}>Client Analytics</span>
          </div>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ color: "var(--text-main)" }}
          >
            Client Analytics
          </h1>
          <p
            className="mt-1 text-xs font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {clientId}
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

      {/* Top Pages + Devices */}
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
    </div>
  );
}
