"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { compactNumber } from "@/lib/format";

interface MonthReport {
  label: string;
  pageViews: number;
  uniqueVisitors: number;
  start: string;
  end: string;
}

export default function ReportsPage() {
  const [months, setMonths] = useState<MonthReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/reports")
      .then((r) => r.json())
      .then((d) => setMonths(d.months || []))
      .catch(() => setMonths([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold"
          style={{ color: "var(--text-main)" }}
        >
          Monthly Reports
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Review your performance month-over-month.
        </p>
      </div>

      {/* Monthly Table */}
      <GlassCard>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl animate-pulse"
                style={{ background: "var(--glass-border)" }}
              />
            ))}
          </div>
        ) : months.length === 0 ? (
          <div
            className="text-sm py-12 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            No report data yet. Add the tracking script to your website to
            start collecting data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-[var(--glass-border)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em]">
                    Month
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em]">
                    Page Views
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em]">
                    Unique Visitors
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em]">
                    Views/Visitor
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr
                    key={m.label}
                    className="border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    <td
                      className="py-3 px-4 font-medium"
                      style={{ color: "var(--text-main)" }}
                    >
                      {m.label}
                    </td>
                    <td
                      className="py-3 px-4 text-right font-bold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {compactNumber(m.pageViews)}
                    </td>
                    <td
                      className="py-3 px-4 text-right"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {compactNumber(m.uniqueVisitors)}
                    </td>
                    <td
                      className="py-3 px-4 text-right"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {m.uniqueVisitors > 0
                        ? (m.pageViews / m.uniqueVisitors).toFixed(1)
                        : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
