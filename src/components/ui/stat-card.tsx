"use client";

import { cn } from "@/lib/utils";

type Accent = "blue" | "cyan" | "teal" | "purple" | "emerald";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  accent?: Accent;
}

const accentMap: Record<Accent, { color: string; bg: string; border: string }> = {
  blue: { color: "var(--accent-blue)", bg: "var(--accent-blue-bg)", border: "var(--accent-blue-border)" },
  cyan: { color: "var(--accent-cyan)", bg: "var(--accent-cyan-bg)", border: "var(--accent-cyan-border)" },
  teal: { color: "var(--accent-teal)", bg: "var(--accent-teal-bg)", border: "var(--accent-teal-border)" },
  purple: { color: "var(--accent-purple)", bg: "var(--accent-purple-bg)", border: "var(--accent-purple-border)" },
  emerald: { color: "var(--accent-emerald)", bg: "var(--accent-emerald-bg)", border: "var(--accent-emerald-border)" },
};

export function StatCard({ label, value, delta, deltaType = "neutral", icon, accent }: StatCardProps) {
  const a = accent ? accentMap[accent] : null;

  return (
    <div
      className="glass-card p-5 md:p-6 rounded-xl md:rounded-2xl overflow-hidden"
      style={
        a
          ? { borderLeft: `3px solid ${a.color}`, background: `linear-gradient(135deg, ${a.bg}, transparent 60%), var(--glass-bg)` }
          : undefined
      }
    >
      <div className="flex items-start justify-between mb-3">
        <span
          className="text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)", opacity: 0.5 }}
        >
          {label}
        </span>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center border"
            style={
              a
                ? { background: a.bg, borderColor: a.border, color: a.color }
                : { background: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }
            }
          >
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
