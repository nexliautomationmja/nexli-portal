"use client";

import type { ConversionFunnelData } from "@/lib/types/ghl-metrics";
import { compactNumber } from "@/lib/format";

interface ConversionFunnelProps {
  data: ConversionFunnelData;
}

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  const { totalLeads, respondedLeads, bookedConsultations } = data;

  if (totalLeads === 0) {
    return (
      <div
        className="flex items-center justify-center h-[160px] text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        No lead data yet
      </div>
    );
  }

  const stages = [
    {
      label: "Total Leads",
      count: totalLeads,
      pct: 100,
      color: "#3b82f6",
    },
    {
      label: "Responded",
      count: respondedLeads,
      pct: Math.round((respondedLeads / totalLeads) * 100),
      color: "#06B6D4",
    },
    {
      label: "Booked",
      count: bookedConsultations,
      pct: Math.round((bookedConsultations / totalLeads) * 100),
      color: "#10B981",
    },
  ];

  return (
    <div className="space-y-4">
      {stages.map((stage) => (
        <div key={stage.label}>
          <div className="flex justify-between text-xs mb-1.5">
            <span
              className="font-medium"
              style={{ color: "var(--text-main)" }}
            >
              {stage.label}
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              {compactNumber(stage.count)} ({stage.pct}%)
            </span>
          </div>
          <div
            className="h-3 rounded-full"
            style={{ background: "var(--glass-border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${stage.pct}%`, background: stage.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
