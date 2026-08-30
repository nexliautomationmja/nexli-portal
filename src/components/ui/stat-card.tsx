"use client";

import { cn } from "@/lib/utils";

type StatAccent = "blue" | "cyan" | "teal" | "violet" | "emerald" | "amber" | "neutral";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  /** Rainmaker accent color for the icon chip. */
  accent?: StatAccent;
}

export function StatCard({
  label,
  value,
  delta,
  deltaType = "neutral",
  icon,
  accent = "blue",
}: StatCardProps) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between mb-1">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className={cn("icon-chip w-8 h-8", `icon-chip-${accent}`)}>
            {icon}
          </span>
        )}
      </div>
      <p className="stat-value">{value}</p>
      {delta && (
        <p
          className={cn(
            "text-xs font-semibold mt-2",
            deltaType === "positive" && "text-emerald-500",
            deltaType === "negative" && "text-rose-500",
            deltaType === "neutral" && "text-[var(--text-muted)]"
          )}
        >
          {deltaType === "positive" && "+"}{delta}
          <span className="font-normal ml-1 text-[var(--text-muted)] opacity-60">
            vs prev. period
          </span>
        </p>
      )}
    </div>
  );
}
