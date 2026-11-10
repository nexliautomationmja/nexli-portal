"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMediaQuery } from "@/lib/use-media";

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

const TICK = { fill: "#a3a3a3", fontSize: 11, fontFamily: "var(--font-plus-jakarta), sans-serif" };

/** Monthly revenue on the dark canvas: emerald area with a soft gradient, quiet grid, figure ticks. */
export function RevenueChart({ data }: RevenueChartProps) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const formatted = data.map((d) => ({ ...d, label: formatMonth(d.month), displayRevenue: d.revenue / 100 }));

  if (data.length === 0) {
    return <div className="flex h-[240px] items-center justify-center px-6 text-center text-sm text-neutral-400">No paid invoices yet. Revenue shows here month by month once invoices are paid.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="rm-revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
        <Tooltip
          cursor={{ stroke: "rgba(255,255,255,0.15)" }}
          contentStyle={{ background: "#0b1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.75rem", color: "#f8fafc", fontSize: 12 }}
          labelStyle={{ color: "#a3a3a3" }}
          formatter={(value) => [formatCurrency(Number(value || 0) * 100), "Revenue"]}
          labelFormatter={(label) => String(label)}
        />
        <Area isAnimationActive={!reduceMotion} type="monotone" dataKey="displayRevenue" name="Revenue" stroke="#34d399" fill="url(#rm-revenue-fill)" strokeWidth={2} activeDot={{ r: 4, stroke: "#0b1220", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
