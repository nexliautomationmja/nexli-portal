"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}

export function StatCard({ label, value, delta, deltaType = "neutral", icon }: StatCardProps) {
  return (
    <div className="glass-card p-5 md:p-6 rounded-xl md:rounded-2xl">
      <div className="flex items-start justify-between mb-3">
        <span
          className="text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)", opacity: 0.5 }}
        >
          {label}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
            {icon}
          </div>
        )}
      </div>

      <p
        className="text-2xl md:text-3xl font-bold tracking-tight"
        style={{ color: "var(--text-main)" }}
      >
        {value}
      </p>

      {delta && (
        <p
          className={cn(
            "text-xs font-semibold mt-1",
            deltaType === "positive" && "text-green-400",
            deltaType === "negative" && "text-red-400",
            deltaType === "neutral" && "text-[var(--text-muted)]"
          )}
        >
          {deltaType === "positive" && "+"}{delta}
          <span className="font-normal ml-1" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
            vs prev. period
          </span>
        </p>
      )}
    </div>
  );
}
