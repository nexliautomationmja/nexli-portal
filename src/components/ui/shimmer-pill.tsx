"use client";

import { cn } from "@/lib/utils";

const SHIMMER_CONIC =
  "conic-gradient(from 0deg at 50% 50%, #3B82F6, #8B5CF6, #06B6D4, #F59E0B, #3B82F6)";

/**
 * Animated shimmer-border pill — the Launch Pad "🚀 LAUNCH PAD" badge as a
 * reusable, theme-aware component. A conic gradient rotates around the pill
 * edge (global `shimmer` keyframes); the inner pill uses the nav background
 * so it works in light and dark themes.
 */
export function ShimmerPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center rounded-full overflow-hidden p-[1.5px]",
        className
      )}
    >
      <span
        className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] opacity-80"
        style={{ background: SHIMMER_CONIC }}
      />
      <span
        className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] blur-md opacity-40"
        style={{ background: SHIMMER_CONIC }}
      />
      <span
        className="relative z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{ background: "var(--nav-bg)" }}
      >
        {children}
      </span>
    </div>
  );
}
