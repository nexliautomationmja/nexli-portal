"use client";

import { formatConversionRate } from "@/lib/format";

interface BenchmarkGaugeProps {
  value: number;
  benchmarkLow: number;
  benchmarkHigh: number;
}

export function BenchmarkGauge({
  value,
  benchmarkLow,
  benchmarkHigh,
}: BenchmarkGaugeProps) {
  const maxScale = 80;
  const position = Math.min(100, Math.max(0, (value / maxScale) * 100));
  const lowPos = (benchmarkLow / maxScale) * 100;
  const highPos = (benchmarkHigh / maxScale) * 100;

  const ratingColor =
    value >= benchmarkLow && value <= benchmarkHigh
      ? "#10B981"
      : value > benchmarkHigh
        ? "#3b82f6"
        : "#EF4444";

  const ratingLabel =
    value >= benchmarkHigh
      ? "Above benchmark"
      : value >= benchmarkLow
        ? "On target"
        : "Below benchmark";

  return (
    <div className="space-y-2">
      <div
        className="relative h-3 rounded-full"
        style={{ background: "var(--glass-border)" }}
      >
        {/* Benchmark zone */}
        <div
          className="absolute top-0 h-full rounded-full opacity-20"
          style={{
            left: `${lowPos}%`,
            width: `${highPos - lowPos}%`,
            background: "#10B981",
          }}
        />
        {/* Current value marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all duration-700"
          style={{
            left: `${position}%`,
            background: ratingColor,
            marginLeft: "-8px",
          }}
        />
      </div>
      <div
        className="flex justify-between text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        <span>0%</span>
        <span className="font-bold" style={{ color: ratingColor }}>
          {formatConversionRate(value)} — {ratingLabel}
        </span>
        <span>{maxScale}%</span>
      </div>
    </div>
  );
}
