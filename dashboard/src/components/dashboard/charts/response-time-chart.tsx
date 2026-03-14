"use client";

import type { SpeedToLeadData } from "@/lib/types/ghl-metrics";

interface ResponseTimeChartProps {
  data: SpeedToLeadData;
}

export function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  const { distribution, totalMeasured } = data;

  if (totalMeasured === 0) {
    return (
      <div
        className="flex items-center justify-center h-[120px] text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        No response data yet
      </div>
    );
  }

  const buckets = [
    {
      label: "Under 5 min",
      count: distribution.under5min,
      pct: Math.round((distribution.under5min / totalMeasured) * 100),
      color: "#10B981",
    },
    {
      label: "5–30 min",
      count: distribution.from5to30min,
      pct: Math.round((distribution.from5to30min / totalMeasured) * 100),
      color: "#F59E0B",
    },
    {
      label: "30+ min",
      count: distribution.over30min,
      pct: Math.round((distribution.over30min / totalMeasured) * 100),
      color: "#EF4444",
    },
  ];

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => (
        <div key={bucket.label}>
          <div className="flex justify-between text-xs mb-1">
            <span
              className="font-medium"
              style={{ color: "var(--text-main)" }}
            >
              {bucket.label}
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              {bucket.count} ({bucket.pct}%)
            </span>
          </div>
          <div
            className="h-2 rounded-full"
            style={{ background: "var(--glass-border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${bucket.pct}%`, background: bucket.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
