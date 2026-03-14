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

interface RevenueChartProps {
  data: { month: string; revenue: number; count: number }[];
}

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function RevenueChart({ data }: RevenueChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
    displayRevenue: d.revenue / 100,
  }));

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-[240px] text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        No invoice data yet. Revenue will appear here once invoices are paid.
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
          width={60}
          tickFormatter={(v) => `$${v.toLocaleString()}`}
        />
        <Tooltip
          contentStyle={{
            background: "var(--nav-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: "0.75rem",
            color: "var(--text-main)",
            fontSize: 12,
          }}
          formatter={(value) => [formatCurrency(Number(value || 0) * 100), "Revenue"]}
          labelFormatter={(label) => String(label)}
        />
        <Area
          type="monotone"
          dataKey="displayRevenue"
          name="Revenue"
          stroke="#10B981"
          fill="#10B981"
          fillOpacity={0.1}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
