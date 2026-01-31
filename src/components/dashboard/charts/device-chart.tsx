"use client";

interface DeviceChartProps {
  data: { deviceType: string; count: number }[];
}

export function DeviceChart({ data }: DeviceChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-sm" style={{ color: "var(--text-muted)" }}>
        No device data yet
      </div>
    );
  }

  const colors: Record<string, string> = {
    desktop: "#3b82f6",
    mobile: "#06B6D4",
    tablet: "#8b5cf6",
  };

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = Math.round((d.count / total) * 100);
        return (
          <div key={d.deviceType}>
            <div className="flex justify-between text-xs mb-1">
              <span className="capitalize font-medium" style={{ color: "var(--text-main)" }}>
                {d.deviceType || "Unknown"}
              </span>
              <span style={{ color: "var(--text-muted)" }}>{pct}%</span>
            </div>
            <div
              className="h-2 rounded-full"
              style={{ background: "var(--glass-border)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: colors[d.deviceType] || "#6b7280",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
