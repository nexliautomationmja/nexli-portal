"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/format";

interface TrafficChartProps {
  data: { date: string; pageViews: number; uniqueVisitors: number }[];
}

export function TrafficChart({ data }: TrafficChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-sm" style={{ color: "var(--text-muted)" }}>
        No traffic data yet. Add the tracking script to your website.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "var(--nav-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: "0.75rem",
            color: "var(--text-main)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="pageViews"
          name="Page Views"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.1}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="uniqueVisitors"
          name="Visitors"
          stroke="#06B6D4"
          fill="#06B6D4"
          fillOpacity={0.1}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
