"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TopPagesChartProps {
  data: { url: string; count: number }[];
}

export function TopPagesChart({ data }: TopPagesChartProps) {
  const formatted = data.map((d) => {
    try {
      const path = new URL(d.url).pathname;
      return { ...d, label: path.length > 30 ? path.slice(0, 30) + "..." : path };
    } catch {
      return { ...d, label: d.url.slice(0, 30) };
    }
  });

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm" style={{ color: "var(--text-muted)" }}>
        No page data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} layout="vertical" margin={{ left: 80 }}>
        <XAxis
          type="number"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={80}
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
        <Bar dataKey="count" name="Views" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
