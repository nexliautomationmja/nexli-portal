"use client";

interface PerformanceIndicatorProps {
  rating: "green" | "yellow" | "red";
}

const ratingConfig = {
  green: {
    label: "Excellent",
    color: "#10B981",
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.2)",
  },
  yellow: {
    label: "Needs Improvement",
    color: "#F59E0B",
    bg: "rgba(245, 158, 11, 0.1)",
    border: "rgba(245, 158, 11, 0.2)",
  },
  red: {
    label: "Critical",
    color: "#EF4444",
    bg: "rgba(239, 68, 68, 0.1)",
    border: "rgba(239, 68, 68, 0.2)",
  },
};

export function PerformanceIndicator({ rating }: PerformanceIndicatorProps) {
  const config = ratingConfig[rating];

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold"
      style={{
        background: config.bg,
        borderColor: config.border,
        color: config.color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: config.color }}
      />
      {config.label}
    </div>
  );
}
