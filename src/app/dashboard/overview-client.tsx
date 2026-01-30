"use client";

import { useGHL } from "@/lib/hooks/use-ghl";
import { compactNumber, formatCurrency } from "@/lib/format";
import { StatCard } from "@/components/ui/stat-card";
import { GlassCard } from "@/components/ui/glass-card";
import { TrafficChart } from "@/components/dashboard/charts/traffic-chart";
import { RecentLeads } from "@/components/dashboard/recent-leads";

interface OverviewClientProps {
  chartData: { date: string; pageViews: number; uniqueVisitors: number }[];
}

export function OverviewClient({ chartData }: OverviewClientProps) {
  const { data: ghl, loading: ghlLoading } = useGHL();

  return (
    <>
      {/* GHL Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="New Leads"
          value={ghlLoading ? "..." : compactNumber(ghl?.leadsCount ?? 0)}
          delta={ghlLoading ? "--" : ghl?.leadsCount ? "from GHL" : "0"}
          deltaType="neutral"
        />
        <StatCard
          label="Pipeline Value"
          value={ghlLoading ? "..." : formatCurrency(ghl?.pipelineValue ?? 0)}
          delta={ghlLoading ? "--" : ghl?.pipelineValue ? "total open" : "$0"}
          deltaType="neutral"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--text-main)" }}
          >
            Website Traffic
          </h3>
          <TrafficChart data={chartData} />
        </GlassCard>

        <GlassCard>
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--text-main)" }}
          >
            Recent Leads
          </h3>
          <RecentLeads />
        </GlassCard>
      </div>
    </>
  );
}
